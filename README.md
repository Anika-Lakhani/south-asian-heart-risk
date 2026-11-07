# South Asian Heart Risk

[![CI](https://github.com/Anika-Lakhani/south-asian-heart-risk/actions/workflows/ci.yml/badge.svg)](https://github.com/Anika-Lakhani/south-asian-heart-risk/actions/workflows/ci.yml)

**Your 10-year heart risk depends on which calculator you ask, and on which day your blood pressure was measured.** This project makes both kinds of uncertainty visible, with a focus on South Asians, the group standard US calculators handle worst.

> **Status:** Phases 1–2 of 4 done: validated risk models, a measurement-uncertainty engine, and an interactive app. Deployment and an ML model are next. See the [roadmap](#roadmap).

## The problem

People of South Asian descent develop heart disease earlier and at higher rates than most other groups. But the risk calculators clinicians use disagree sharply about them:

| Model | Who it was built on | How it treats South Asians |
|---|---|---|
| **Pooled Cohort Equations** (ACC/AHA 2013): the standard US calculator | US cohorts, white and African American adults | Scored as white |
| **PREVENT** (AHA 2023) | 6M+ US adults | Race is not an input |
| **QRISK3** (UK, 2017) | 7.9M UK primary-care patients | Separate terms for Indian, Pakistani, and Bangladeshi |

The 2018 ACC/AHA cholesterol guideline acknowledges the gap by calling South Asian ancestry a "risk-enhancing factor", but leaves the adjustment to the clinician.

Here's one 48-year-old man (total cholesterol 200, HDL 38, SBP 132, BMI 26, non-smoker, no diabetes), scored by this package:

| Ancestry | PCE | PREVENT | QRISK3 | Chance QRISK3 is really ≥ 7.5%* |
|---|---|---|---|---|
| White | 4.0% | 2.4% | 4.7% | 0% |
| Indian | 4.0% | 2.4% | 6.2% | 11% |
| Pakistani | 4.0% | 2.4% | 7.5% | 49% |
| Bangladeshi | 4.0% | 2.4% | 7.9% | 62% |

\* Share of simulated re-measurements of his blood pressure and cholesterol that put QRISK3 at or above 7.5%, the US threshold for discussing a statin.

The same man gets a 2.4%–7.9% spread depending on the model. A single clinic reading also can't say which side of a treatment threshold he's on. The models also predict slightly different outcomes (see [caveats](#caveats)), but the gap is too large to explain away.

## Where this came from

This grew out of a Harvard CS 2790r (HCI) project with Sanjna Kedia and Krisha Patel on **communicating risk and uncertainty to patients**. The core finding from that literature: static error bars get misread, while interactive displays and frequency framings such as quantile dotplots ([Kay et al. 2016](https://doi.org/10.1145/2858036.2858558), [Fernandes et al. 2018](https://doi.org/10.1145/3173574.3173718)) help people understand uncertainty and keep their trust ([Yang et al. 2024](https://doi.org/10.1145/3613904.3642371)). This rebuild applies that to a real clinical gap, with risk models that are published and validated rather than invented.

One principle carries over from the original design: **probabilities are shown as computed.** No "subjective correction" is applied to make risks feel more intuitive, because patients deserve their actual numbers.

## The app

The app scores you with all three models, then shows how much each number could move, in your choice of three formats from the original study design:

- **Dots**: a quantile dotplot. Each of 20 dots is one equally likely re-measurement, and the dots past the treatment threshold are highlighted, so "10 of 20" is something you can count.
- **Ranges**: 90% and middle-50% bands around each estimate.
- **In words**: a plain-language summary for each model.

It also shows the same person scored as white (only QRISK3 changes), plus what-if sliders for blood pressure, cholesterol, and smoking. It follows the system light/dark theme, with blue palettes that pass colorblind-safety checks in both modes.

```bash
pip install -e ".[app]"
streamlit run app/streamlit_app.py
```

## Using the package

```bash
pip install -e ".[dev]"
```

```python
from heartrisk import Profile, score, simulate

me = Profile(
    age=48,
    sex="male",
    ethnicity="pakistani",
    total_cholesterol=200,
    hdl_cholesterol=38,
    systolic_bp=132,
    bmi=26,
)

for key, result in score(me).items():
    print(f"{result.model.name}: {result.risk:.1%} ({result.model.outcome})")

sim = simulate(me)  # 4,000 plausible re-measurements
sim.interval("qrisk3", level=0.9)  # (0.057, 0.097)
sim.prob_above("qrisk3", 0.075)  # 0.49
sim.quantile_dots("qrisk3", n_dots=20)  # data for a quantile dotplot

simulate(me, bp_readings=3)  # averaging readings narrows the spread
```

All model functions are vectorized with NumPy, so scoring thousands of samples is a single call.

## How it's validated

Every model is tested against reference values published by its authors:

- **QRISK3**: all 48 reference profiles scored by ClinRisk's original C implementation match to 0.1%. The coefficient tables are generated from ClinRisk's source by [`scripts/gen_qrisk3_tables.py`](scripts/gen_qrisk3_tables.py), not typed by hand.
- **PREVENT**: matches Table S25 of the paper's supplement (total CVD, ASCVD, heart failure).
- **PCE**: matches the worked example in the 2013 guideline for all four sex/race groups.

Measurement variability defaults are approximate literature values (SBP within-person SD ≈ 12 mmHg; total and HDL cholesterol biological CV ≈ 6% and 7%). They're configurable via `MeasurementVariability`.

```bash
pytest          # 77 tests, including the app's interactions
ruff check .
```

## Roadmap

1. ✅ **Risk models + uncertainty engine.** PCE, PREVENT, and QRISK3 as a tested, vectorized package, plus Monte Carlo propagation of measurement noise.
2. ✅ **Interactive app.** Questionnaire, side-by-side model results, three uncertainty displays (quantile dotplots, interval bands, plain-language summaries), an ancestry comparison, and what-if sliders.
3. **ML model.** Reproducible training on CDC BRFSS survey data, with held-out evaluation, calibration, per-person SHAP explanations, and a model card. The model card will be upfront that US survey data doesn't separate South Asians from other Asians.
4. **Ship it.** Live deployment, screenshots, and a short write-up.

## Caveats

- **The outcomes differ.** PCE predicts hard ASCVD (heart attack, coronary death, stroke). PREVENT predicts ASCVD. QRISK3 predicts CVD including TIA, a slightly broader outcome. Some of the gap comes from that.
- **The populations differ.** QRISK3 is calibrated to UK patients. Its South Asian terms describe British South Asians, who may differ from South Asians in the US.
- **QRISK3 inputs the US models don't use** (Townsend deprivation score, SBP variability, and several conditions) default to neutral values unless provided.

## Sources

- Goff DC Jr, et al. 2013 ACC/AHA Guideline on the Assessment of Cardiovascular Risk. *Circulation* 2014;129:S49–S73.
- Khan SS, et al. Development and Validation of the American Heart Association's PREVENT Equations. *Circulation* 2024;149:430–449.
- Hippisley-Cox J, Coupland C, Brindle P. Development and validation of QRISK3 risk prediction algorithms. *BMJ* 2017;357:j2099.
- Grundy SM, et al. 2018 AHA/ACC Guideline on the Management of Blood Cholesterol. *Circulation* 2019;139:e1082–e1143.
- Muntner P, et al. Reproducibility of visit-to-visit variability of blood pressure measured as part of routine clinical care. *J Hypertens* 2011;29:2332–2338.

## License

MIT, except [`src/heartrisk/models/qrisk3.py`](src/heartrisk/models/qrisk3.py), which implements ClinRisk's QRISK3-2017 algorithm and is LGPL-3.0-or-later like the original. See [LICENSE](LICENSE) and [LICENSES/](LICENSES/).

## Disclaimer

This is an educational project, not a medical device, and it does not give medical advice. Talk to a clinician about your heart health.

*QRISK3 disclaimer, as ClinRisk requires:* QRISK3-2017 was developed by ClinRisk Ltd., who released the code under the GNU Lesser General Public License to enable others to implement the algorithm faithfully. ClinRisk Ltd. stress that it is the responsibility of the end user to check that the source they receive produces the same results as the original code found at [qrisk.org](https://qrisk.org). Inaccurate implementations of risk scores can lead to wrong patients being given the wrong treatment.
