import pytest

from heartrisk.models.prevent import _COEFFICIENTS, _TERMS, prevent_10yr

# Table S25 of the PREVENT supplement (total CVD), with the remaining outcomes
# from the supplement's Excel calculator.
TABLE_S25 = dict(
    age=50,
    female=True,
    total_cholesterol=200,
    hdl_cholesterol=45,
    systolic_bp=160,
    on_bp_meds=True,
    on_statin=False,
    diabetic=True,
    smoker=False,
    egfr=90,
    bmi=35,
)


@pytest.mark.parametrize(
    ("outcome", "expected"),
    [("total_cvd", 0.147), ("ascvd", 0.092), ("heart_failure", 0.081)],
)
def test_supplement_table_s25(outcome, expected):
    assert float(prevent_10yr(**TABLE_S25, outcome=outcome)) == pytest.approx(expected, abs=0.0005)


def test_coefficient_tables_match_terms():
    for coefficients in _COEFFICIENTS.values():
        assert len(coefficients) == len(_TERMS)


def test_ignores_ethnicity():
    # PREVENT takes no race or ethnicity input at all; nothing to vary.
    assert "ethnicity" not in prevent_10yr.__code__.co_varnames
