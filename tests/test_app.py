from pathlib import Path

import pytest

pytest.importorskip("streamlit")
from streamlit.testing.v1 import AppTest  # noqa: E402

APP = str(Path(__file__).parents[1] / "app" / "streamlit_app.py")


def run_app() -> AppTest:
    at = AppTest.from_file(APP, default_timeout=30)
    at.run()
    assert not at.exception
    return at


def test_default_example_renders_all_three_models():
    at = run_app()
    labels = [m.label for m in at.metric]
    assert labels == ["Pooled Cohort Equations", "PREVENT", "QRISK3"]
    assert [m.value for m in at.metric] == ["4.0%", "2.4%", "7.5%"]


@pytest.mark.parametrize("example_index", [1, 2, 3])
def test_every_example_loads(example_index):
    at = run_app()
    example = at.selectbox(key="example")
    example.select(example.options[example_index]).run()
    assert not at.exception
    assert len(at.metric) == 3


def test_choosing_an_example_fills_in_its_values():
    at = run_app()
    example = at.selectbox(key="example")
    example.select("White woman, 45, for comparison").run()
    assert at.number_input(key="age").value == 45
    assert at.selectbox(key="ancestry").value == "White"
    # Switching back restores the defaults the example doesn't set.
    at.selectbox(key="example").select("Pakistani man, 48").run()
    assert at.number_input(key="age").value == 48
    assert at.radio(key="sex").value == "Male"


@pytest.mark.parametrize("view", ["Ranges", "In words"])
def test_every_uncertainty_view_renders(view):
    at = run_app()
    at.segmented_control(key="view").set_value(view).run()
    assert not at.exception


def test_invalid_entries_show_an_error_instead_of_crashing():
    at = run_app()
    at.number_input(key="hdl_cholesterol").set_value(120)
    at.number_input(key="total_cholesterol").set_value(110).run()
    assert not at.exception
    assert at.error and "Please check your entries" in at.error[0].value
