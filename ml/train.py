"""Train and evaluate models of self-reported heart disease on BRFSS 2025.

Compares an interpretable logistic regression with a gradient-boosted tree
model, using the survey weights throughout so results describe US adults
aged 30-79. Writes metrics, figures, and the model card.

Usage: python ml/train.py   (after python ml/prepare.py)
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.compose import ColumnTransformer  # noqa: E402
from sklearn.ensemble import HistGradientBoostingClassifier  # noqa: E402
from sklearn.impute import SimpleImputer  # noqa: E402
from sklearn.inspection import permutation_importance  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import (  # noqa: E402
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import (  # noqa: E402
    OneHotEncoder,
    OrdinalEncoder,
    SplineTransformer,
)

HERE = Path(__file__).parent
DATA = HERE / "data" / "brfss2025.csv.gz"
REPORTS = HERE / "reports"
FIGURES = REPORTS / "figures"
SEED = 2790

NUMERIC = ["age", "bmi"]
BINARY = ["female", "kidney_disease", "physically_active"]
CATEGORICAL = ["race", "smoking", "diabetes", "high_bp", "high_cholesterol"]
FEATURES = NUMERIC + BINARY + CATEGORICAL
TARGET = "heart_disease"

# Two validated categorical slots (blue, orange) and chart ink.
BLUE, ORANGE, INK, MUTED, GRID = "#2a78d6", "#eb6834", "#0b0b0b", "#898781", "#e1e0d9"

RACE_LABELS = {
    "white": "White",
    "black": "Black",
    "hispanic": "Hispanic",
    "asian": "Asian",
    "aian": "American Indian / Alaska Native",
    "other": "Other / multiracial",
}


def logistic_model():
    """Additive model: smooth curves for age and BMI, one term per category."""
    numeric = make_pipeline(
        SimpleImputer(strategy="median", add_indicator=True),
        ColumnTransformer(
            [("spline", SplineTransformer(n_knots=5, degree=3), [0, 1])],
            remainder="passthrough",
        ),
    )
    features = ColumnTransformer(
        [
            ("numeric", numeric, NUMERIC),
            ("binary", "passthrough", BINARY),
            ("categorical", OneHotEncoder(drop="first", handle_unknown="ignore"), CATEGORICAL),
        ]
    )
    return make_pipeline(features, LogisticRegression(C=1.0, max_iter=2000))


def boosted_model():
    features = ColumnTransformer(
        [
            ("numeric", "passthrough", NUMERIC + BINARY),
            ("categorical", OrdinalEncoder(), CATEGORICAL),
        ]
    )
    n_numeric = len(NUMERIC + BINARY)
    categorical_mask = [False] * n_numeric + [True] * len(CATEGORICAL)
    return make_pipeline(
        features,
        HistGradientBoostingClassifier(
            categorical_features=categorical_mask,
            learning_rate=0.05,
            max_iter=400,
            early_stopping=True,
            random_state=SEED,
        ),
    )


def fit(model, X, y, w):
    step = model.steps[-1][0]
    return model.fit(X, y, **{f"{step}__sample_weight": w})


@dataclass
class Scores:
    auroc: float
    auroc_ci: tuple[float, float]
    average_precision: float
    brier: float
    observed: float
    predicted: float
    n: int


def weighted_scores(y, p, w, rng, n_boot=200) -> Scores:
    """Survey-weighted metrics, with a bootstrap 95% interval for AUROC."""
    y, p, w = np.asarray(y), np.asarray(p), np.asarray(w)
    boot = []
    for _ in range(n_boot):
        i = rng.integers(0, len(y), len(y))
        if y[i].min() != y[i].max():
            boot.append(roc_auc_score(y[i], p[i], sample_weight=w[i]))
    return Scores(
        auroc=roc_auc_score(y, p, sample_weight=w),
        auroc_ci=(float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))),
        average_precision=average_precision_score(y, p, sample_weight=w),
        brier=brier_score_loss(y, p, sample_weight=w),
        observed=float(np.average(y, weights=w)),
        predicted=float(np.average(p, weights=w)),
        n=len(y),
    )


def calibration_curve(y, p, w, bins=10):
    """Weighted observed rate vs mean prediction, in deciles of predicted risk."""
    edges = np.quantile(p, np.linspace(0, 1, bins + 1))
    which = np.clip(np.searchsorted(edges, p, side="right") - 1, 0, bins - 1)
    points = []
    for b in range(bins):
        m = which == b
        points.append((np.average(p[m], weights=w[m]), np.average(y[m], weights=w[m])))
    return np.array(points)


def style(ax):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color("#c3c2b7")
    ax.tick_params(colors=MUTED, labelsize=9)
    ax.grid(color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)


def plot_calibration(curves, path):
    fig, ax = plt.subplots(figsize=(5.2, 4.6), dpi=200)
    top = max(c[:, :].max() for c in curves.values()) * 1.08
    ax.plot([0, top], [0, top], color=MUTED, linewidth=1, linestyle=(0, (4, 3)), label="Perfect")
    for (name, curve), color in zip(curves.items(), (BLUE, ORANGE), strict=True):
        ax.plot(
            curve[:, 0],
            curve[:, 1],
            color=color,
            linewidth=2,
            marker="o",
            markersize=5,
            markeredgecolor="white",
            markeredgewidth=1.5,
            label=name,
        )
    ax.set_xlim(0, top)
    ax.set_ylim(0, top)
    ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, decimals=0))
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1, decimals=0))
    ax.set_xlabel("Predicted share with heart disease", color=INK, fontsize=10)
    ax.set_ylabel("Observed share (survey-weighted)", color=INK, fontsize=10)
    ax.set_title("Calibration on held-out respondents", color=INK, fontsize=11, loc="left")
    style(ax)
    ax.legend(frameon=False, fontsize=9, labelcolor=INK)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def plot_subgroups(rows, path):
    """AUROC with 95% intervals by race for both models."""
    labels = [RACE_LABELS[r["group"]] for r in rows]
    y = np.arange(len(rows))
    fig, ax = plt.subplots(figsize=(6.4, 3.8), dpi=200)
    for offset, key, color, name in (
        (-0.15, "logistic", BLUE, "Logistic regression"),
        (0.15, "boosted", ORANGE, "Gradient boosting"),
    ):
        auc = np.array([r[key]["auroc"] for r in rows])
        lo = np.array([r[key]["auroc_ci"][0] for r in rows])
        hi = np.array([r[key]["auroc_ci"][1] for r in rows])
        ax.errorbar(
            auc,
            y + offset,
            xerr=[auc - lo, hi - auc],
            fmt="o",
            color=color,
            markersize=6,
            markeredgecolor="white",
            markeredgewidth=1.5,
            elinewidth=2,
            capsize=0,
            label=name,
        )
    ax.set_yticks(
        y, [f"{lbl}  (n={r['logistic']['n']:,})" for lbl, r in zip(labels, rows, strict=True)]
    )
    ax.invert_yaxis()
    ax.set_xlabel("AUROC (95% bootstrap interval)", color=INK, fontsize=10)
    ax.set_title("AUROC by race/ethnicity", color=INK, fontsize=11, loc="left", pad=26)
    style(ax)
    ax.tick_params(axis="y", colors=INK)
    ax.legend(
        frameon=False,
        fontsize=9,
        labelcolor=INK,
        ncol=2,
        loc="lower left",
        bbox_to_anchor=(0, 1.0),
        borderaxespad=0.2,
    )
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def explain(model, person: pd.DataFrame, background: pd.DataFrame):
    """Each feature's push on the log-odds for one person, vs an average respondent.

    For an additive model this is exact: swap one feature at a time from the
    background's typical value to the person's value.
    """

    def logit(df):
        p = model.predict_proba(df)[:, 1]
        return np.log(p / (1 - p))

    typical = {}
    for col in FEATURES:
        s = background[col]
        typical[col] = s.median() if col in NUMERIC else s.mode().iloc[0]
    base = pd.DataFrame([typical])
    base_logit = logit(base)[0]
    contributions = {}
    for col in FEATURES:
        swapped = base.copy()
        swapped[col] = person[col].values
        contributions[col] = float(logit(swapped)[0] - base_logit)
    return base_logit, contributions, typical


def describe(col, value):
    if col == "female":
        return "female" if value == 1 else "male"
    if col in ("kidney_disease", "physically_active"):
        return "yes" if value == 1 else "no"
    if col == "race":
        return RACE_LABELS.get(value, value)
    if col in NUMERIC:
        return f"{value:g}"
    return str(value)


def plot_explanation(contributions, person, typical, person_label, path):
    items = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)
    items = [kv for kv in items if abs(kv[1]) > 0.005]
    # Each bar compares the person's answer with the typical respondent's.
    names = [
        f"{'sex' if k == 'female' else k.replace('_', ' ')}: {describe(k, person[k].iloc[0])}"
        f"  (typical: {describe(k, typical[k])})"
        for k, _ in items
    ]
    values = np.array([v for _, v in items])
    fig, ax = plt.subplots(figsize=(7.2, 0.42 * len(items) + 1.4), dpi=200)
    colors = [BLUE if v > 0 else "#86b6ef" for v in values]
    ax.barh(names, values, color=colors, height=0.55)
    ax.axvline(0, color="#c3c2b7", linewidth=1)
    ax.invert_yaxis()
    ax.set_xlabel("Change in log-odds vs a typical respondent", color=INK, fontsize=10)
    ax.set_title(f"What drives the estimate\n{person_label}", color=INK, fontsize=11, loc="left")
    style(ax)
    ax.tick_params(axis="y", colors=INK)
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main() -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(DATA)
    train, test = train_test_split(
        df, test_size=0.2, random_state=SEED, stratify=df[[TARGET, "race"]]
    )
    rng = np.random.default_rng(SEED)

    models = {"logistic": logistic_model(), "boosted": boosted_model()}
    names = {"logistic": "Logistic regression", "boosted": "Gradient boosting"}
    predictions, overall, curves = {}, {}, {}
    for key, model in models.items():
        fit(model, train[FEATURES], train[TARGET], train["weight"])
        p = model.predict_proba(test[FEATURES])[:, 1]
        predictions[key] = p
        overall[key] = weighted_scores(test[TARGET], p, test["weight"], rng)
        curves[names[key]] = calibration_curve(
            test[TARGET].to_numpy(), p, test["weight"].to_numpy()
        )
        print(
            f"{names[key]}: AUROC {overall[key].auroc:.3f} "
            f"[{overall[key].auroc_ci[0]:.3f}, {overall[key].auroc_ci[1]:.3f}], "
            f"Brier {overall[key].brier:.4f}"
        )

    subgroups = []
    for column, groups in (("race", list(RACE_LABELS)), ("female", [0.0, 1.0])):
        for group in groups:
            m = (test[column] == group).to_numpy()
            subgroups.append(
                {
                    "column": column,
                    "group": group,
                    **{
                        key: weighted_scores(
                            test[TARGET][m], predictions[key][m], test["weight"][m], rng
                        ).__dict__
                        for key in models
                    },
                }
            )

    importance = permutation_importance(
        models["logistic"],
        test[FEATURES],
        test[TARGET],
        scoring="roc_auc",
        sample_weight=test["weight"],
        n_repeats=5,
        random_state=SEED,
    )
    importances = dict(
        sorted(
            zip(FEATURES, importance.importances_mean.round(4).tolist(), strict=True),
            key=lambda kv: -kv[1],
        )
    )

    # The app's default example: a 48-year-old Pakistani man. BRFSS only has "Asian".
    person = pd.DataFrame(
        [
            {
                "age": 48,
                "bmi": 26.0,
                "female": 0.0,
                "kidney_disease": 0.0,
                "physically_active": 1.0,
                "race": "asian",
                "smoking": "never",
                "diabetes": "no",
                "high_bp": "no",
                "high_cholesterol": "yes",
            }
        ]
    )
    base_logit, contributions, typical = explain(models["logistic"], person, train)
    person_risk = float(models["logistic"].predict_proba(person)[0, 1])

    plot_calibration(curves, FIGURES / "calibration.png")
    plot_subgroups([s for s in subgroups if s["column"] == "race"], FIGURES / "subgroups.png")
    plot_explanation(
        contributions,
        person,
        typical,
        "48-year-old Asian man, high cholesterol",
        FIGURES / "explanation.png",
    )

    metrics = {
        "data": {
            "source": "CDC BRFSS 2025",
            "respondents": len(df),
            "train": len(train),
            "test": len(test),
            "weighted_prevalence": float(np.average(df[TARGET], weights=df["weight"])),
            "asian_respondents": int((df["race"] == "asian").sum()),
        },
        "overall": {k: v.__dict__ for k, v in overall.items()},
        "subgroups": subgroups,
        "permutation_importance_auroc": importances,
        "example": {
            "risk": person_risk,
            "base_log_odds": base_logit,
            "contributions": contributions,
            "typical": {k: describe(k, v) for k, v in typical.items()},
        },
    }
    (REPORTS / "metrics.json").write_text(json.dumps(metrics, indent=2, default=float) + "\n")
    write_model_card(metrics)
    print(f"Wrote {REPORTS}")


def write_model_card(m) -> None:
    o = m["overall"]
    lg, bt = o["logistic"], o["boosted"]

    def auc(s):
        return f"{s['auroc']:.3f} ({s['auroc_ci'][0]:.3f}–{s['auroc_ci'][1]:.3f})"

    race_rows = "\n".join(
        f"| {RACE_LABELS[s['group']]} | {s['logistic']['n']:,} | {auc(s['logistic'])} | "
        f"{s['logistic']['observed']:.1%} | {s['logistic']['predicted']:.1%} |"
        for s in m["subgroups"]
        if s["column"] == "race"
    )
    sex_rows = "\n".join(
        f"| {'Female' if s['group'] == 1.0 else 'Male'} | {s['logistic']['n']:,} | "
        f"{auc(s['logistic'])} | {s['logistic']['observed']:.1%} | "
        f"{s['logistic']['predicted']:.1%} |"
        for s in m["subgroups"]
        if s["column"] == "female"
    )
    top = list(m["permutation_importance_auroc"].items())[:5]
    importance = ", ".join(
        f"{'sex' if k == 'female' else k.replace('_', ' ')} ({v:.3f})" for k, v in top
    )
    # Groups where the mean prediction misses the observed rate by over 1 point.
    misses = [
        f"{RACE_LABELS[s['group']]} ({s['logistic']['predicted']:.1%} predicted vs "
        f"{s['logistic']['observed']:.1%} observed)"
        for s in m["subgroups"]
        if s["column"] == "race"
        and abs(s["logistic"]["predicted"] - s["logistic"]["observed"]) > 0.01
    ]
    calibration_note = (
        "Ranking holds up across groups (overlapping AUROC intervals), but **calibration "
        "doesn't**: the mean prediction misses by more than a percentage point for "
        + "; ".join(misses)
        + ". Small groups have wide uncertainty, but under-prediction for some groups is the "
        "kind of error that matters most in a risk tool."
        if misses
        else "Calibration is within a percentage point for every group."
    )
    d = m["data"]
    t = m["example"]["typical"]
    card = TEMPLATE.format(
        n=d["respondents"],
        train=d["train"],
        test=d["test"],
        prevalence=d["weighted_prevalence"],
        asian=d["asian_respondents"],
        lg_auc=auc(lg),
        bt_auc=auc(bt),
        lg_ap=lg["average_precision"],
        bt_ap=bt["average_precision"],
        lg_brier=lg["brier"],
        bt_brier=bt["brier"],
        lg_obs=lg["observed"],
        lg_pred=lg["predicted"],
        bt_pred=bt["predicted"],
        race_rows=race_rows,
        sex_rows=sex_rows,
        importance=importance,
        calibration_note=calibration_note,
        example_risk=m["example"]["risk"],
        race_effect=m["example"]["contributions"]["race"],
        typical_desc=(
            f"{t['age']}-year-old {t['race'].lower()} {t['female']}, BMI {float(t['bmi']):.0f}, "
            f"{t['smoking']} smoker, no diabetes, high blood pressure, or high cholesterol"
        ),
    )
    (HERE / "MODEL_CARD.md").write_text(card)


TEMPLATE = """\
# Model card: self-reported heart disease (BRFSS 2025)

> Generated by [`ml/train.py`](train.py) from [`reports/metrics.json`](reports/metrics.json).
> Edit the template in `train.py`, not this file.

## What it predicts, and what it doesn't

The model estimates the share of US adults with a given risk profile who report
**having ever been told they had a heart attack or coronary heart disease**
(BRFSS variable `_MICHD`).

That is **prevalence, not future risk.** BRFSS is a one-time survey, so it can't
say who will develop heart disease over the next 10 years. The model's numbers
are therefore **not comparable** to the PCE, PREVENT, or QRISK3 estimates in the
app, and the app doesn't show them. The model is an analysis of what population
survey data can and can't tell us, especially about South Asians.

## Data

- **Source:** CDC Behavioral Risk Factor Surveillance System, 2025 public file
  (telephone survey of US adults).
- **Population:** respondents aged 30–79 with an answer to the outcome question:
  {n:,} people. 80/20 random split, stratified by outcome and race:
  {train:,} training, {test:,} held out.
- **Survey weights** (`_LLCPWT`) are used in training and every metric, so results
  describe US adults rather than just the people who answered. Weighted share
  reporting heart disease: {prevalence:.1%}.
- **Missing answers:** "don't know" for smoking, blood pressure, and cholesterol is
  kept as its own category, and missing BMI is imputed with a missing-value flag.
  Dropping incomplete rows instead would have removed 20% of respondents, and
  removed non-white respondents more often (Asian respondents 24.5% vs white
  19.1%).

**Features:** age, sex, race/ethnicity, BMI, smoking, diabetes, ever told high
blood pressure, ever told high cholesterol, kidney disease, physical activity.

**Deliberately excluded:** general health rating, stroke history, and blood
pressure or cholesterol medication. People often start these medications, or
rate their health lower, *after* a heart attack. Including them would make the
model look better by learning the consequences of heart disease, not its risk
factors. The same reverse causation can't be fully removed from "ever told high
cholesterol/blood pressure", which is the most important caveat on these results.

## Results on held-out respondents

| | Logistic regression | Gradient boosting |
|---|---|---|
| AUROC (95% CI) | {lg_auc} | {bt_auc} |
| Average precision | {lg_ap:.3f} | {bt_ap:.3f} |
| Brier score | {lg_brier:.4f} | {bt_brier:.4f} |
| Mean predicted vs observed | {lg_pred:.1%} vs {lg_obs:.1%} | {bt_pred:.1%} vs {lg_obs:.1%} |

**The logistic regression is the chosen model.** It's additive, so every
person's estimate splits exactly into one contribution per answer, and it's
small enough to run in a browser. Gradient boosting adds little on this data;
see the table above.

![Calibration](reports/figures/calibration.png)

### By race/ethnicity (logistic regression)

| Group | Held-out n | AUROC (95% CI) | Observed | Mean predicted |
|---|---|---|---|---|
{race_rows}

{calibration_note}

### By sex (logistic regression)

| Group | Held-out n | AUROC (95% CI) | Observed | Mean predicted |
|---|---|---|---|---|
{sex_rows}

![Subgroup AUROC](reports/figures/subgroups.png)

**Most important features** (drop in AUROC when shuffled): {importance}.

## Explaining one estimate

For a 48-year-old Asian man with a BMI of 26 who has never smoked, is physically
active, and has been told his cholesterol is high, the model estimates
**{example_risk:.1%}**. Because the model is additive, the estimate splits exactly
into one push per answer. The chart compares each answer with a typical
respondent ({typical_desc}).

![Explanation](reports/figures/explanation.png)

**Note the race bar.** In this data, being Asian *lowers* the estimate
({race_effect:+.2f} log-odds vs white). Clinical research finds the opposite for
South Asians, and QRISK3 *raises* risk for Indian, Pakistani, and Bangladeshi
patients. The likely explanation is that BRFSS's single "Asian" group is mostly
East and Southeast Asian adults, so a pooled category averages South Asian risk
away. This is the clearest data-driven argument for the app: a model trained on
standard US data would tell a South Asian user their ancestry is protective.

## Limitations

- **No South Asian category.** BRFSS publishes a single "Asian, non-Hispanic"
  group ({asian:,} respondents aged 30–79, about 3% of the sample), which mixes
  South Asian, East Asian, and Southeast Asian adults. Their heart disease risk
  is known to differ, so this model **cannot** say anything specific about South
  Asians. That gap in US data is part of why the app compares clinical
  calculators instead.
- **Self-report.** Diagnoses are as remembered by respondents, and people who
  died of heart disease are never surveyed (survivorship bias).
- **Prevalence, not incidence**, as described above.
- **Telephone survey.** Response rates are low and the weights only partly
  correct for who doesn't answer.

## Intended use

Education and analysis. Not for clinical decisions or individual risk
assessment.
"""


if __name__ == "__main__":
    main()
