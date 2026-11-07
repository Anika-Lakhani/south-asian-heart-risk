"""How much a risk score could move given ordinary measurement noise.

A single blood pressure or cholesterol reading is one draw from a range of
values the same person could have produced that week. This module re-scores a
profile under many plausible re-measurements and reports the resulting spread
of risk, for each model.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from heartrisk.profile import Profile
from heartrisk.scoring import MODELS


@dataclass(frozen=True)
class MeasurementVariability:
    """Typical within-person variation for a single measurement.

    Defaults are approximate literature values:

    - SBP: within-person SD of clinic readings across visits is roughly
      10-14 mmHg (e.g. Muntner et al., J Hypertens 2011, ~13.5 mmHg).
    - Total cholesterol: within-subject biological CV ~6% (Ricos et al.
      biological variation database, 2014 update: 5.9%).
    - HDL cholesterol: within-subject biological CV ~7% (same database).
    """

    systolic_bp_sd: float = 12.0
    total_cholesterol_cv: float = 0.06
    hdl_cholesterol_cv: float = 0.07


@dataclass(frozen=True)
class Simulation:
    samples: dict[str, np.ndarray]
    """10-year risk (fraction) per model, one entry per simulated re-measurement."""

    def interval(self, model: str, level: float = 0.9) -> tuple[float, float]:
        tail = (1 - level) / 2
        low, high = np.quantile(self.samples[model], [tail, 1 - tail])
        return float(low), float(high)

    def prob_above(self, model: str, threshold: float) -> float:
        """Share of re-measurements that put risk at or above ``threshold``."""
        return float(np.mean(self.samples[model] >= threshold))

    def quantile_dots(self, model: str, n_dots: int = 20) -> np.ndarray:
        """Evenly spaced quantiles for a quantile dotplot (Kay et al., CHI 2016)."""
        return np.quantile(self.samples[model], (np.arange(n_dots) + 0.5) / n_dots)


def _lognormal(rng: np.random.Generator, mean: float, cv: float, n: int) -> np.ndarray:
    sigma = np.sqrt(np.log1p(cv**2))
    return rng.lognormal(np.log(mean) - sigma**2 / 2, sigma, n)


def simulate(
    profile: Profile,
    *,
    n: int = 4000,
    bp_readings: int = 1,
    lipid_tests: int = 1,
    variability: MeasurementVariability | None = None,
    seed: int | None = 0,
) -> Simulation:
    """Re-score ``profile`` under ``n`` simulated re-measurements.

    ``bp_readings`` and ``lipid_tests`` are how many measurements were averaged
    to get the profile's values. Averaging k readings shrinks noise by sqrt(k).
    """
    v = variability or MeasurementVariability()
    rng = np.random.default_rng(seed)
    p = profile

    sbp = rng.normal(p.systolic_bp, v.systolic_bp_sd / np.sqrt(bp_readings), n)
    sbp = np.clip(sbp, 70, 250)
    lipid_scale = 1 / np.sqrt(lipid_tests)
    tc = _lognormal(rng, p.total_cholesterol, v.total_cholesterol_cv * lipid_scale, n)
    hdl = _lognormal(rng, p.hdl_cholesterol, v.hdl_cholesterol_cv * lipid_scale, n)
    hdl = np.minimum(hdl, tc - 1)

    return Simulation({key: m.fn(p, sbp, tc, hdl) for key, m in MODELS.items()})
