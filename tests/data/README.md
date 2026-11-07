# Test fixtures

`qrisk3_2017_reference.csv` holds 48 profiles scored by ClinRisk's original
QRISK3-2017 C implementation (`QRISK_C_algorithm_score`, a percentage rounded
to one decimal). It comes from the `QRISK3_2017_test` dataset in the
[QRISK3 R package](https://cran.r-project.org/package=QRISK3).

Coding follows that package: `gender` is 1 for female and 0 for male;
`smoke_cat` runs 1-5 (non-smoker, ex-smoker, light, moderate, heavy); `ethrisk`
runs 1-9 in QRISK3's order (white, Indian, Pakistani, Bangladeshi, other Asian,
Black Caribbean, Black African, Chinese, other).
