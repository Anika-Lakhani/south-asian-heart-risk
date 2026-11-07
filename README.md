# South Asian Heart Risk

An interactive cardiovascular risk calculator that shows how a person's 10-year heart risk changes depending on which clinical model you ask — and why that matters for South Asians.

> **Status:** rebuilding from an earlier prototype ([heart-health](https://github.com/Anika-Lakhani/heart-health)). See the roadmap below.

## Why this exists

People of South Asian descent (Indian, Pakistani, Bangladeshi, Sri Lankan, Nepali) develop heart disease earlier and at higher rates than most other groups, often without the classic risk profile. Yet the risk tools doctors use most often don't see them:

- The **ACC/AHA Pooled Cohort Equations** (the standard US calculator) only distinguish "white" and "African American" patients. South Asians are scored as white.
- The **2018 ACC/AHA cholesterol guideline** acknowledges the gap by listing South Asian ancestry as a "risk-enhancing factor" — but leaves the adjustment to clinician judgment.
- The UK's **QRISK3** does model Indian, Pakistani, and Bangladeshi ethnicity directly, and often gives noticeably different answers.
- The newer **AHA PREVENT** equations drop race entirely.

This project puts those models side by side for the same person, explains what drives each score, and adds a machine-learning model trained on CDC survey data — with an honest look at what that data can and can't say about South Asians.

## Planned features

- **Side-by-side risk scores** from Pooled Cohort Equations, PREVENT, and QRISK3, each implemented from the published coefficients and tested against reference values.
- **What-if sliders** to see how lowering blood pressure, cholesterol, or quitting smoking changes each score.
- **ML risk model** trained on CDC BRFSS survey data, with calibration, held-out evaluation, and per-person explanations (SHAP).
- **Model card** documenting performance, limitations, and the fact that US survey data doesn't separate South Asians from other Asian groups.

## Roadmap

1. **Risk equations** — implement PCE, PREVENT, and QRISK3 as a tested Python package.
2. **Streamlit app** — questionnaire, side-by-side results, what-if sliders.
3. **ML model** — reproducible training pipeline on BRFSS, evaluation report, SHAP explanations, model card.
4. **Ship it** — CI (lint + tests), live deployment, screenshots.

## Disclaimer

This is an educational project, not a medical device. It does not provide medical advice. Talk to a clinician about your heart health.
