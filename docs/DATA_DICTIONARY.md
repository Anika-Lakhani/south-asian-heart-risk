# Data dictionary: South Asian Heart Risk open dataset

Anonymous answers donated through the [Heart Risk Check](https://anika-lakhani.github.io/south-asian-heart-risk/)
app. Released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See the
[privacy notice](https://anika-lakhani.github.io/south-asian-heart-risk/#privacy) for how
answers are collected.

## How to read it

- **One row per donation.** A donation has a required core section and two optional
  sections. Fields from a section the donor skipped are empty.
- **Self-reported, self-selected.** Donors chose to use the app and chose to donate. They
  aren't a representative sample of any population, and nothing is clinically verified.
  `numbers_source` and `numbers_recency` describe how trustworthy the measurements are.
- **Cross-sectional.** Heart history is what donors report at the time; there is no
  follow-up.
- **Anonymized before release.** Test entries are removed, and every combination of
  `age_band`, `sex`, `ancestry`, and `region` describes at least 5 donors. Rarer
  combinations are merged into broader groups (for example `ancestry = south_asian_other`)
  or withheld.
- **Empty means unanswered.** Every question beyond the risk check was optional.

## Metadata

| Field | Type | Values |
|---|---|---|
| `donation_id` | text | Random ID, regenerated for each release so rows can't be linked across releases |
| `received_month` | date | First day of the month the donation arrived, e.g. `2026-11-01` |
| `sections` | text | Sections completed, e.g. `core;southAsian` |

## From the risk check (core section)

| Field | Type | Values |
|---|---|---|
| `age_band` | text | 5-year band: `30-34` … `80-84` |
| `sex` | text | `female`, `male` (sex assigned at birth; the calculators use it) |
| `ancestry` | text | `indian`, `pakistani`, `bangladeshi`, `sri_lankan`, `nepali`, `bhutanese`, `maldivian`, `other_asian`, `chinese`, `white`, `black_caribbean`, `black_african`, `other` |
| `heart_history` | text | Ever told of a heart attack, angina/CHD, stroke, or heart failure: `yes`, `no`, `unsure` |
| `systolic_bp` | integer | mmHg |
| `total_cholesterol` | integer | mg/dL |
| `hdl_cholesterol` | integer | mg/dL |
| `bmi` | integer | kg/m², rounded |
| `egfr` | integer | mL/min/1.73m²; the app's default of 90 is kept when not changed |
| `smoking` | text | `never`, `former`, `light` (<10/day), `moderate` (10–19), `heavy` (20+) |
| `diabetes` | text | `none`, `type1`, `type2` |
| `on_bp_meds`, `on_statin`, `family_history_cvd` | boolean | As ticked in the risk check |
| `atrial_fibrillation`, `chronic_kidney_disease`, `rheumatoid_arthritis`, `lupus`, `migraine`, `severe_mental_illness`, `atypical_antipsychotics`, `corticosteroids`, `erectile_dysfunction` | boolean | QRISK3 conditions from the optional list |

## Core research questions

| Field | Type | Values |
|---|---|---|
| `heart_events` | text | Only if `heart_history = yes`. Semicolon-separated: `heartAttack`, `coronaryDisease`, `stroke`, `heartFailure` |
| `age_first_event` | integer | Age at first heart event, if `heart_history = yes` |
| `born_in_country` | text | Born in the country they live in now: `yes`, `no` |
| `years_in_country` | integer | If not born there |
| `numbers_source` | text | `lab` (lab report or portal), `clinic` (clinic or pharmacy reading), `home` (home monitor), `estimate` |
| `numbers_recency` | text | `under6m`, `6to12m`, `1to2y`, `over2y` |

## Optional: risks common in South Asian communities

| Field | Type | Values |
|---|---|---|
| `waist_cm` | number | Converted to cm if entered in inches |
| `other_tobacco` | text | Semicolon-separated: `chewing`, `paan`, `gutka`, `bidi`, `hookah` |
| `diet` | text | `vegetarian`, `mostly`, `nonvegetarian` |
| `ldl` | integer | mg/dL |
| `triglycerides` | integer | mg/dL |
| `hba1c` | number | % |
| `lpa` | integer | nmol/L |
| `family_relatives` | text | Semicolon-separated: `father`, `mother`, `brother`, `sister` |
| `family_earliest_age` | integer | Youngest age a listed relative was diagnosed |

## Optional: everyday habits and background

| Field | Type | Values |
|---|---|---|
| `active_days` | integer | Days per week with 30+ minutes of exercise, 0–7 |
| `drinks_per_week` | integer | Alcoholic drinks in a typical week |
| `sleep_hours` | number | Typical night |
| `education` | text | `highschool`, `somecollege`, `bachelors`, `graduate` |
| `region` | text | `us_northeast`, `us_midwest`, `us_south`, `us_west`, `canada`, `uk`, `other` |

## Comparing with BRFSS

Heart history uses the same conditions as the CDC's BRFSS survey (`CVDINFR4`, `CVDCRHD4`,
`CVDSTRK3`), and smoking, diabetes, and blood pressure follow BRFSS categories where
possible, so researchers can compare donors with national estimates. Unlike BRFSS,
`ancestry` separates South Asian groups.
