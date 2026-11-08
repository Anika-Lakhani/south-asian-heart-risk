"""The web app's generated files must match the Python reference implementation."""

import importlib.util
import json
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts" / "export_web_models.py"
spec = importlib.util.spec_from_file_location("export_web_models", SCRIPT)
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)

STALE = "web/src/models/{} is stale; run python scripts/export_web_models.py"


def test_qrisk3_coefficients_are_up_to_date():
    name = "qrisk3Coefficients.ts"
    assert (export.OUT / name).read_text() == export.coefficients_ts(), STALE.format(name)


def test_parity_fixture_is_up_to_date():
    # Floating-point results can differ in the last bit across platforms, so
    # compare risks with a tolerance rather than byte for byte.
    name = "parity.fixture.json"
    committed = json.loads((export.OUT / name).read_text())
    expected = json.loads(export.parity_json())
    assert len(committed) == len(expected), STALE.format(name)
    for got, want in zip(committed, expected, strict=True):
        assert got["profile"] == want["profile"], STALE.format(name)
        for model, risk in want["risk"].items():
            assert got["risk"][model] == pytest.approx(risk, abs=1e-12), STALE.format(name)
