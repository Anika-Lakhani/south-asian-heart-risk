"""The release script: test exclusion, merging, and the k-anonymity guarantee."""

import importlib.util
import itertools
import random
from collections import Counter
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[1] / "scripts" / "release_dataset.py"
spec = importlib.util.spec_from_file_location("release_dataset", SCRIPT)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

_ids = itertools.count()


def donation(
    age_band="45-49",
    sex="male",
    ancestry="pakistani",
    residence="us_west",
    app_version="abc123",
    month="2026-11-01",
    south_asian=None,
):
    """Stored rows for one donor, shaped like the app's real submissions."""
    donation_id = f"00000000-0000-4000-8000-{next(_ids):012d}"
    intake = {
        "ageBand": age_band,
        "sex": sex,
        "ancestry": ancestry,
        "heartHistory": "no",
        "systolicBp": 132,
        "totalCholesterol": 200,
        "hdlCholesterol": 38,
        "bmi": 26,
        "onBpMeds": False,
    }
    rows = [
        {
            "donation_id": donation_id,
            "module": "core",
            "answers": {"intake": intake, "heartEvents": [], "bornInUs": "no", "yearsInUs": 12},
            "app_version": app_version,
            "received_month": month,
        },
        {
            "donation_id": donation_id,
            "module": "context",
            "answers": {"residence": residence, "activeDays": 3},
            "app_version": app_version,
            "received_month": month,
        },
    ]
    if south_asian is not None:
        rows.append(
            {
                "donation_id": donation_id,
                "module": "southAsian",
                "answers": south_asian,
                "app_version": app_version,
                "received_month": month,
            }
        )
    return rows


def group_sizes(records):
    return Counter(tuple(r[q] or "unknown" for q in release.QUASI_IDENTIFIERS) for r in records)


def test_merges_sections_into_one_row_and_drops_test_entries():
    rows = donation() + donation(app_version="test-local")
    records = release.merge_donations(rows)
    assert len(records) == 1
    r = records[0]
    assert r["sections"] == "core;context"
    assert r["age_band"] == "45-49"
    assert r["on_bp_meds"] == "false"
    assert r["born_in_country"] == "no"
    assert r["years_in_country"] == 12
    assert r["region"] == "us_west"
    assert r["active_days"] == 3


def test_converts_waist_to_cm_and_joins_lists():
    rows = donation(south_asian={"waist": 36, "waistUnit": "in", "otherTobacco": ["paan", "gutka"]})
    r = release.merge_donations(rows)[0]
    assert r["waist_cm"] == pytest.approx(91.4)
    assert r["other_tobacco"] == "paan;gutka"
    assert r["sections"] == "core;southAsian;context"


def test_optional_sections_without_a_core_section_are_skipped():
    rows = [row for row in donation() if row["module"] != "core"]
    assert release.merge_donations(rows) == []


def test_common_groups_keep_full_detail():
    rows = [row for _ in range(6) for row in donation()]
    kept, stats = release.anonymize(release.merge_donations(rows))
    assert len(kept) == 6
    assert {r["ancestry"] for r in kept} == {"pakistani"}
    assert sum(stats["generalized"].values()) == 0


def test_rare_south_asian_groups_merge_instead_of_disappearing():
    rows = [
        row
        for ancestry in ["sri_lankan"] * 2 + ["nepali"] * 2 + ["bhutanese"]
        for row in donation(ancestry=ancestry)
    ]
    kept, stats = release.anonymize(release.merge_donations(rows))
    assert len(kept) == 5
    assert {r["ancestry"] for r in kept} == {"south_asian_other"}
    assert stats["withheld"] == 0


def test_holds_back_people_who_stay_unique_after_generalizing():
    rows = [row for _ in range(5) for row in donation()] + donation(
        age_band="80-84", sex="female", ancestry="maldivian", residence="uk"
    )
    kept, stats = release.anonymize(release.merge_donations(rows))
    assert len(kept) == 5
    assert stats["withheld"] == 1


def test_every_released_group_has_at_least_k_people_on_random_data():
    rng = random.Random(7)
    ancestries = ["indian", "pakistani", "bangladeshi", "sri_lankan", "nepali", "white", "chinese"]
    bands = [f"{a}-{a + 4}" for a in range(30, 85, 5)]
    regions = ["us_northeast", "us_south", "us_west", "canada", "uk", None]
    rows = [
        row
        for _ in range(600)
        for row in donation(
            age_band=rng.choice(bands),
            sex=rng.choice(["female", "male"]),
            ancestry=rng.choice(ancestries),
            residence=rng.choice(regions),
        )
    ]
    kept, stats = release.anonymize(release.merge_donations(rows))
    assert min(group_sizes(kept).values()) >= release.K
    assert len(kept) + stats["withheld"] == 600
    assert len(kept) > 300  # generalizing should save most people, not drop them


def test_release_uses_fresh_ids_and_refuses_tiny_releases():
    rows = [row for _ in range(40) for row in donation()]
    stored_ids = {row["donation_id"] for row in rows}
    records, _, total = release.build(rows, seed=1)
    assert total == 40
    assert not stored_ids & {r["donation_id"] for r in records}
    assert len({r["donation_id"] for r in records}) == 40

    with pytest.raises(SystemExit, match="Wait for more donations"):
        release.build(rows[: 2 * 10])  # 10 donors, below the 30-row minimum


def test_writes_csv_and_notes(tmp_path):
    rows = [row for _ in range(40) for row in donation()]
    records, stats, total = release.build(rows, seed=1)
    release.write_release(records, stats, total, tmp_path / "2026-12")
    csv_text = (tmp_path / "2026-12" / "heart-donations.csv").read_text()
    assert csv_text.splitlines()[0] == ",".join(release.COLUMNS)
    assert len(csv_text.splitlines()) == 41
    notes = (tmp_path / "2026-12" / "RELEASE_NOTES.md").read_text()
    assert "Rows released:** 40" in notes


@pytest.mark.parametrize(
    ("band", "ten_year", "broad"),
    [
        ("30-34", "30-39", "30-49"),
        ("45-49", "40-49", "30-49"),
        ("60-64", "60-69", "50-64"),
        ("65-69", "60-69", "65-84"),
        ("80-84", "80-89", "65-84"),
    ],
)
def test_age_band_generalization(band, ten_year, broad):
    steps = [g for column, g in release.GENERALIZATIONS if column == "age_band"]
    assert steps[0](band) == ten_year
    assert steps[0](ten_year) == ten_year  # already 10-year: unchanged
    assert steps[1](band) == broad


def test_region_goes_before_ancestry():
    columns = [column for column, _ in release.GENERALIZATIONS]
    assert columns.index("region") < columns.index("ancestry")
    assert columns.index("age_band") < columns.index("ancestry")
