import numpy as np
import pytest

from heartrisk import MODELS, Profile, score, simulate

PROFILE = Profile(
    age=52,
    sex="male",
    ethnicity="indian",
    total_cholesterol=210,
    hdl_cholesterol=40,
    systolic_bp=136,
    smoking="never",
    diabetes="type2",
)


def test_score_returns_every_model():
    results = score(PROFILE)
    assert set(results) == set(MODELS)
    for result in results.values():
        assert 0 < result.risk < 1
        assert result.out_of_range == ()


def test_qrisk3_sees_south_asian_ethnicity_and_pce_does_not():
    white = score(Profile(**{**PROFILE.__dict__, "ethnicity": "white"}))
    indian = score(PROFILE)
    assert indian["qrisk3"].risk > white["qrisk3"].risk
    assert indian["pce"].risk == white["pce"].risk
    assert indian["prevent"].risk == white["prevent"].risk


def test_flags_inputs_outside_validated_range():
    young = Profile(**{**PROFILE.__dict__, "age": 35})
    results = score(young)
    assert results["pce"].out_of_range == ("age",)
    assert results["prevent"].out_of_range == ()


@pytest.mark.parametrize(
    ("field", "value"),
    [("sex", "other"), ("smoking", "sometimes"), ("hdl_cholesterol", 300), ("age", -1)],
)
def test_rejects_invalid_profiles(field, value):
    with pytest.raises(ValueError):
        Profile(**{**PROFILE.__dict__, field: value})


def test_simulation_brackets_point_estimate():
    sim = simulate(PROFILE, n=4000, seed=1)
    point = score(PROFILE)
    for key in MODELS:
        low, high = sim.interval(key, 0.9)
        assert low < point[key].risk < high


def test_averaging_readings_narrows_interval():
    def width(sim):
        low, high = sim.interval("pce")
        return high - low

    single = simulate(PROFILE, seed=2)
    averaged = simulate(PROFILE, bp_readings=4, lipid_tests=4, seed=2)
    assert width(averaged) < width(single)


def test_simulation_is_reproducible_with_seed():
    a = simulate(PROFILE, n=500, seed=3).samples["qrisk3"]
    b = simulate(PROFILE, n=500, seed=3).samples["qrisk3"]
    np.testing.assert_array_equal(a, b)


def test_quantile_dots_and_threshold_probability():
    sim = simulate(PROFILE, seed=4)
    dots = sim.quantile_dots("pce", n_dots=20)
    assert len(dots) == 20 and np.all(np.diff(dots) >= 0)
    assert sim.prob_above("pce", 0.0) == 1.0
    assert sim.prob_above("pce", 1.0) == 0.0
