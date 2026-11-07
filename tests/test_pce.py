import pytest

from heartrisk import Profile, score


# Worked example from Goff et al. 2013, Table A: age 55, total cholesterol 213,
# HDL 50, untreated SBP 120, non-smoker, no diabetes. The guideline rounds its
# intermediate logs to two decimals, which moves the white-male result from
# 5.38% to the printed 5.3%, so allow 0.1 percentage points.
@pytest.mark.parametrize(
    ("sex", "ethnicity", "expected_pct"),
    [
        ("female", "white", 2.1),
        ("female", "black_african", 3.0),
        ("male", "white", 5.3),
        ("male", "black_african", 6.1),
    ],
)
def test_guideline_worked_example(sex, ethnicity, expected_pct):
    profile = Profile(
        age=55,
        sex=sex,
        ethnicity=ethnicity,
        total_cholesterol=213,
        hdl_cholesterol=50,
        systolic_bp=120,
    )
    assert score(profile)["pce"].risk * 100 == pytest.approx(expected_pct, abs=0.1)


def test_south_asians_are_scored_as_white():
    base = dict(age=55, sex="male", total_cholesterol=213, hdl_cholesterol=50, systolic_bp=120)
    white = score(Profile(**base, ethnicity="white"))["pce"].risk
    for group in ["indian", "pakistani", "bangladeshi"]:
        assert score(Profile(**base, ethnicity=group))["pce"].risk == white
