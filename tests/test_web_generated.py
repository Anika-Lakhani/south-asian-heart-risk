"""The web app's generated files must match the Python reference implementation."""

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts" / "export_web_models.py"
spec = importlib.util.spec_from_file_location("export_web_models", SCRIPT)
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


@pytest.mark.parametrize("name", list(export.GENERATED))
def test_generated_file_is_up_to_date(name):
    committed = (export.OUT / name).read_text()
    assert committed == export.GENERATED[name](), (
        f"web/src/models/{name} is stale; run python scripts/export_web_models.py"
    )
