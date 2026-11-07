"""How sure is your heart risk? An interactive comparison of three risk models."""

from __future__ import annotations

from dataclasses import replace

import charts
import pandas as pd
import streamlit as st

from heartrisk import MODELS, Profile, score, simulate
from heartrisk.models.qrisk3 import DISCLAIMER as QRISK3_DISCLAIMER

REPO_URL = "https://github.com/Anika-Lakhani/south-asian-heart-risk"
N_DOTS = 20

st.set_page_config(page_title="How sure is your heart risk?", page_icon="🫀", layout="centered")

# ---------------------------------------------------------------- inputs

ANCESTRY = {
    "Indian": "indian",
    "Pakistani": "pakistani",
    "Bangladeshi": "bangladeshi",
    "Sri Lankan, Nepali, or other Asian": "other_asian",
    "White": "white",
    "Black Caribbean": "black_caribbean",
    "Black African or African American": "black_african",
    "Chinese": "chinese",
    "Other": "other",
}
SMOKING = {
    "Never smoked": "never",
    "Used to smoke": "former",
    "Smoke under 10 a day": "light",
    "Smoke 10–19 a day": "moderate",
    "Smoke 20+ a day": "heavy",
}
DIABETES = {"No": "none", "Type 1": "type1", "Type 2": "type2"}
CONDITIONS = {
    "Atrial fibrillation": "atrial_fibrillation",
    "Chronic kidney disease (stage 3–5)": "chronic_kidney_disease",
    "Rheumatoid arthritis": "rheumatoid_arthritis",
    "Lupus (SLE)": "lupus",
    "Migraine": "migraine",
    "Severe mental illness": "severe_mental_illness",
    "Taking atypical antipsychotics": "atypical_antipsychotics",
    "Taking regular steroid tablets": "corticosteroids",
    "Erectile dysfunction": "erectile_dysfunction",
}

DEFAULTS = {
    "age": 48,
    "sex": "Male",
    "ancestry": "Pakistani",
    "total_cholesterol": 200,
    "hdl_cholesterol": 38,
    "systolic_bp": 132,
    "on_bp_meds": False,
    "smoking": "Never smoked",
    "diabetes": "No",
    "bmi": 26.0,
    "family_history": False,
    "on_statin": False,
    "egfr": 90,
    "conditions": [],
    "bp_readings": 1,
    "lipid_tests": 1,
}

EXAMPLES = {
    "Pakistani man, 48": {},
    "Indian woman, 55, treated blood pressure": {
        "age": 55,
        "sex": "Female",
        "ancestry": "Indian",
        "total_cholesterol": 220,
        "hdl_cholesterol": 50,
        "systolic_bp": 142,
        "on_bp_meds": True,
        "bmi": 27.0,
    },
    "Bangladeshi man, 60, smoker with diabetes": {
        "age": 60,
        "ancestry": "Bangladeshi",
        "total_cholesterol": 190,
        "hdl_cholesterol": 36,
        "systolic_bp": 138,
        "smoking": "Smoke 10–19 a day",
        "diabetes": "Type 2",
        "bmi": 25.0,
    },
    "White woman, 45, for comparison": {
        "age": 45,
        "sex": "Female",
        "ancestry": "White",
        "total_cholesterol": 200,
        "hdl_cholesterol": 60,
        "systolic_bp": 118,
        "bmi": 24.0,
    },
}

for key, value in DEFAULTS.items():
    st.session_state.setdefault(key, value)


def load_example() -> None:
    for key, value in {**DEFAULTS, **EXAMPLES[st.session_state.example]}.items():
        st.session_state[key] = value


with st.sidebar:
    st.selectbox("Start from an example", list(EXAMPLES), key="example", on_change=load_example)
    st.divider()
    st.number_input("Age", 25, 84, key="age")
    st.radio("Sex", ["Female", "Male"], key="sex", horizontal=True)
    st.selectbox("Ancestry", list(ANCESTRY), key="ancestry")
    st.number_input("Total cholesterol (mg/dL)", 100, 400, key="total_cholesterol")
    st.number_input("HDL cholesterol (mg/dL)", 15, 120, key="hdl_cholesterol")
    st.number_input("Systolic blood pressure (mmHg)", 80, 220, key="systolic_bp")
    st.checkbox("Taking blood pressure medication", key="on_bp_meds")
    st.selectbox("Smoking", list(SMOKING), key="smoking")
    st.radio("Diabetes", list(DIABETES), key="diabetes", horizontal=True)
    st.number_input("BMI", 15.0, 50.0, step=0.5, key="bmi")
    st.checkbox("Parent or sibling had a heart attack or angina before 60", key="family_history")
    with st.expander("More details"):
        st.checkbox("Taking a statin", key="on_statin")
        st.number_input("Kidney function, eGFR (mL/min)", 15, 140, key="egfr")
        st.multiselect("Other conditions (used by QRISK3)", list(CONDITIONS), key="conditions")
        st.number_input(
            "Blood pressure readings averaged",
            1,
            6,
            key="bp_readings",
            help="Averaging several readings shrinks measurement noise.",
        )
        st.number_input("Cholesterol tests averaged", 1, 4, key="lipid_tests")

s = st.session_state
try:
    profile = Profile(
        age=s.age,
        sex=s.sex.lower(),
        ethnicity=ANCESTRY[s.ancestry],
        total_cholesterol=s.total_cholesterol,
        hdl_cholesterol=s.hdl_cholesterol,
        systolic_bp=s.systolic_bp,
        on_bp_meds=s.on_bp_meds,
        smoking=SMOKING[s.smoking],
        diabetes=DIABETES[s.diabetes],
        bmi=s.bmi,
        egfr=s.egfr,
        on_statin=s.on_statin,
        family_history_cvd=s.family_history,
        **{CONDITIONS[c]: True for c in s.conditions},
    )
except ValueError as error:
    st.error(f"Please check your entries: {error}")
    st.stop()


@st.cache_data(show_spinner=False)
def run(profile: Profile, bp_readings: int, lipid_tests: int):
    sim = simulate(profile, bp_readings=bp_readings, lipid_tests=lipid_tests)
    return score(profile), sim


results, sim = run(profile, s.bp_readings, s.lipid_tests)
palette = charts.DARK if st.context.theme.type == "dark" else charts.LIGHT

OUTCOME_PLAIN = {
    "pce": "a heart attack, a stroke, or death from heart disease",
    "prevent": "a heart attack or stroke",
    "qrisk3": "a heart attack, a stroke, or a mini-stroke (TIA)",
}

# ---------------------------------------------------------------- page

st.title("How sure is your heart risk?")
st.write(
    "Doctors estimate your chance of a heart attack or stroke with risk calculators. "
    "But **different calculators give different answers**, especially for South Asians. "
    "And **one blood pressure or cholesterol reading is a noisy snapshot**. This page shows "
    "both kinds of uncertainty, so you can see how solid your number really is."
)

st.subheader("Your 10-year risk, three ways")
columns = st.columns(len(results))
for column, (key, result) in zip(columns, results.items(), strict=True):
    low, high = sim.interval(key)
    with column:
        st.metric(result.model.name, f"{result.risk:.1%}", border=True)
        st.caption(f"Likely range {low:.1%}–{high:.1%}  \nPredicts {result.model.outcome}")
        if result.out_of_range:
            fields = ", ".join(f.replace("_", " ") for f in result.out_of_range)
            st.caption(f"⚠️ Your {fields} is outside what this model was built on.")

# ---------------------------------------------------------------- uncertainty

st.subheader("How sure is that number?")
st.write(
    "We re-scored you thousands of times, each time imagining your blood pressure and "
    "cholesterol had been measured on a different day. The spread is how much your risk "
    "could move from measurement noise alone."
)

left, right = st.columns([3, 2])
view = left.segmented_control(
    "Show it as", ["Dots", "Ranges", "In words"], default="Dots", key="view"
)
THRESHOLDS = {
    "5%: borderline (US)": 0.05,
    "7.5%: discuss a statin (US)": 0.075,
    "10%: offer a statin (UK)": 0.10,
    "20%: high (US)": 0.20,
}
threshold = THRESHOLDS[
    right.selectbox("Compare against", list(THRESHOLDS), index=1, key="threshold")
]

x_max = charts.x_domain_max([sim.interval(k, 0.98)[1] for k in MODELS], threshold)
dots = {key: sim.quantile_dots(key, N_DOTS) for key in MODELS}

if view == "Dots" or view is None:
    stacks = [charts.stack_dots(d, x_max)["stack"].max() for d in dots.values()]
    max_stack = int(max(stacks))
    for i, (key, result) in enumerate(results.items()):
        above = int((dots[key] >= threshold).sum())
        st.markdown(
            f"**{result.model.name}**: {above} of {N_DOTS} re-measurements at or above "
            f"{threshold:.1%}"
        )
        st.altair_chart(
            charts.dotplot(
                dots[key], threshold, x_max, max_stack, palette, show_axis=i == len(results) - 1
            ),
            width="stretch",
        )
    st.caption(
        f"Each dot is one equally likely outcome out of {N_DOTS}. {palette.loud_name} dots are at "
        "or above the dashed line."
    )
elif view == "Ranges":
    rows = pd.DataFrame(
        [
            {
                "model": result.model.name,
                "risk": result.risk,
                "low90": sim.interval(key, 0.9)[0],
                "high90": sim.interval(key, 0.9)[1],
                "low50": sim.interval(key, 0.5)[0],
                "high50": sim.interval(key, 0.5)[1],
            }
            for key, result in results.items()
        ]
    )
    st.altair_chart(charts.range_bands(rows, threshold, x_max, palette), width="stretch")
    st.caption(
        "Outer band: 90% of re-measurements. Inner band: the middle 50%. "
        "Diamond: the estimate from your entered values. Dashed line: the threshold."
    )
else:
    for key, result in results.items():
        low, high = sim.interval(key)
        above = int((dots[key] >= threshold).sum())
        st.markdown(
            f"**{result.model.name}** puts your chance of {OUTCOME_PLAIN[key]} in the next "
            f"10 years at **{result.risk:.1%}**. If your blood pressure and cholesterol were "
            f"measured again, it would usually land between {low:.1%} and {high:.1%}. "
            f"In **{above} of {N_DOTS}** re-measurements it's at or above {threshold:.1%}."
        )

# ---------------------------------------------------------------- disagreement

st.subheader("Why the models disagree")
st.write(
    "**Pooled Cohort Equations** is the standard US calculator. It was built only on white "
    "and African American adults, and scores everyone else as white. **PREVENT**, the "
    "newer US model, leaves out race entirely. **QRISK3**, from the UK, has its own terms "
    "for Indian, Pakistani, and Bangladeshi patients."
)
if profile.ethnicity != "white":
    as_white = score(replace(profile, ethnicity="white"))
    comparison = pd.DataFrame(
        {
            "Model": [r.model.name for r in results.values()],
            f"As {s.ancestry}": [f"{r.risk:.1%}" for r in results.values()],
            "Same person, as white": [f"{r.risk:.1%}" for r in as_white.values()],
        }
    )
    st.dataframe(comparison, hide_index=True, width="stretch")
    st.caption("Only QRISK3 changes. The US models can't see ancestry at all.")
st.caption(
    "The models also predict slightly different outcomes. QRISK3 includes mini-strokes "
    "(TIAs), which accounts for some of its higher numbers. And QRISK3 was built on UK "
    "patients, who may differ from South Asians in the US."
)

# ---------------------------------------------------------------- what-if

st.subheader("What if…")
st.write("Move the sliders to see how changes would shift each model's estimate.")
c1, c2 = st.columns(2)


def clamp(value: float, low: int, high: int) -> int:
    return int(min(max(value, low), high))


new_sbp = c1.slider("Systolic blood pressure", 90, 200, clamp(profile.systolic_bp, 90, 200))
new_tc = c2.slider("Total cholesterol", 120, 320, clamp(profile.total_cholesterol, 120, 320))
new_hdl = c1.slider("HDL cholesterol", 20, 100, clamp(profile.hdl_cholesterol, 20, 100))
quit_smoking = c2.checkbox("Quit smoking", disabled=not profile.current_smoker)

try:
    changed = replace(
        profile,
        systolic_bp=new_sbp,
        total_cholesterol=new_tc,
        hdl_cholesterol=new_hdl,
        smoking="former" if quit_smoking else profile.smoking,
    )
except ValueError as error:
    st.warning(f"That combination isn't valid: {error}")
else:
    after = score(changed)
    rows = pd.DataFrame(
        {
            "model": [r.model.name for r in results.values()],
            "now": [r.risk for r in results.values()],
            "what_if": [r.risk for r in after.values()],
        }
    )
    st.altair_chart(charts.what_if(rows, threshold, x_max, palette), width="stretch")
    lines = [
        f"{r.model.name}: {r.risk:.1%} → {after[k].risk:.1%} "
        f"({(after[k].risk - r.risk) * 100:+.1f} points)"
        for k, r in results.items()
    ]
    st.caption("  \n".join(lines))

# ---------------------------------------------------------------- table + about

with st.expander("Show all the numbers"):
    table = pd.DataFrame(
        [
            {
                "Model": r.model.name,
                "Predicts": r.model.outcome,
                "Estimate": f"{r.risk:.1%}",
                "90% range": "{:.1%}–{:.1%}".format(*sim.interval(k, 0.9)),
                f"Chance ≥ {threshold:.1%}": f"{sim.prob_above(k, threshold):.0%}",
                "Outside validated range": ", ".join(r.out_of_range) or "—",
            }
            for k, r in results.items()
        ]
    )
    st.dataframe(table, hide_index=True, width="stretch")

with st.expander("About this tool"):
    st.markdown(
        f"""
Every model here is implemented from its published equations and tested against reference
values from its authors. Measurement noise assumes a blood pressure reading varies by about
12 mmHg between visits, and cholesterol by about 6–7%. [Source code and methods]({REPO_URL}).

This grew out of a Harvard CS 2790r project on communicating risk and uncertainty to
patients. Probabilities are shown exactly as computed, with no adjustment to make them
"feel" more intuitive.

**This is an educational tool, not medical advice.** Talk to a clinician about your heart
health.
"""
    )
    st.caption(f"QRISK3 disclaimer: {QRISK3_DISCLAIMER}")

st.caption(
    f"Educational only, not medical advice. QRISK3 © ClinRisk Ltd. "
    f"[Source and methods]({REPO_URL})."
)
