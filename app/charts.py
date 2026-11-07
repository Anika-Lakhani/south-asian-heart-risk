"""Altair charts for the app. Every chart shares one x scale: 10-year risk."""

from __future__ import annotations

from dataclasses import dataclass

import altair as alt
import numpy as np
import pandas as pd

DOT_ROW_PX = 17
MAX_DOT_PX = 14
N_BINS = 36
AXIS_BAND_PX = 42


@dataclass(frozen=True)
class Palette:
    """Two validated steps of one blue ramp, plus chart ink.

    ``quiet`` marks values below the threshold (or "now"); ``loud`` marks values
    at or above it (or "what-if"). Each pair passes the ordinal checks against
    its own surface.
    """

    quiet: str
    loud: str
    ink: str
    muted: str
    surface: str
    loud_name: str
    """How to describe the ``loud`` color in captions."""


LIGHT = Palette("#86b6ef", "#104281", "#52514e", "#898781", "#fcfcfb", loud_name="Dark")
DARK = Palette("#256abf", "#9ec5f4", "#c3c2b7", "#898781", "#1a1a19", loud_name="Light")


def x_domain_max(highs: list[float], threshold: float) -> float:
    """A clean upper bound that fits every interval and the threshold line."""
    top = max(max(highs), threshold) * 1.15
    step = 0.05 if top > 0.2 else 0.02 if top > 0.06 else 0.01
    return float(np.ceil(top / step) * step)


def _x(x_max: float, title: str | None = "10-year risk") -> alt.X:
    return alt.X(
        "risk:Q",
        title=title,
        scale=alt.Scale(domain=[0, x_max], nice=False),
        axis=alt.Axis(format=".0%", tickCount=6, grid=False),
    )


def _threshold_rule(threshold: float, palette: Palette) -> alt.Chart:
    return (
        alt.Chart(pd.DataFrame({"risk": [threshold]}))
        .mark_rule(strokeDash=[4, 3], strokeWidth=1.5, color=palette.ink)
        .encode(x="risk:Q")
    )


def stack_dots(dots: np.ndarray, x_max: float, n_bins: int = N_BINS) -> pd.DataFrame:
    """Place quantile dots into bins and stack them (a Wilkinson dotplot)."""
    width = x_max / n_bins
    bins = np.clip(np.floor(dots / width), 0, n_bins - 1).astype(int)
    stack = np.zeros(len(dots), dtype=int)
    counts: dict[int, int] = {}
    for i, b in enumerate(bins):
        stack[i] = counts.get(b, 0)
        counts[b] = stack[i] + 1
    return pd.DataFrame({"x": (bins + 0.5) * width, "stack": stack, "risk": dots})


def dotplot(
    dots: np.ndarray,
    threshold: float,
    x_max: float,
    max_stack: int,
    palette: Palette,
    show_axis: bool,
) -> alt.LayerChart:
    data = stack_dots(dots, x_max)
    data["side"] = np.where(data["risk"] >= threshold, "At or above", "Below")
    data["label"] = [f"{r:.1%}" for r in data["risk"]]
    # Streamlit fits the axis band inside the chart height, so add room for it.
    height = (max_stack + 1) * DOT_ROW_PX + (AXIS_BAND_PX if show_axis else 0)
    points = (
        alt.Chart(data)
        .mark_circle(
            # Dot diameter tracks the bin width so stacks never overlap on narrow screens.
            # Vega sizes circles by area, so scale down to leave a small gap between dots.
            size=alt.expr(f"pow(0.85 * min(width / {N_BINS}, {MAX_DOT_PX}), 2)"),
            opacity=1,
            stroke=palette.surface,
            strokeWidth=2,
        )
        .encode(
            x=alt.X(
                "x:Q",
                title="10-year risk" if show_axis else None,
                scale=alt.Scale(domain=[0, x_max], nice=False),
                axis=alt.Axis(format=".0%", tickCount=6, grid=False, labels=show_axis),
            ),
            y=alt.Y(
                "stack:Q",
                scale=alt.Scale(domain=[-0.6, max_stack + 0.4]),
                axis=None,
            ),
            color=alt.Color(
                "side:N",
                scale=alt.Scale(
                    domain=["Below", "At or above"], range=[palette.quiet, palette.loud]
                ),
                legend=None,
            ),
            tooltip=[alt.Tooltip("label:N", title="Risk in this re-measurement")],
        )
    )
    rule = _threshold_rule(threshold, palette)
    return (points + rule).properties(height=height, width="container")


def range_bands(rows: pd.DataFrame, threshold: float, x_max: float, palette: Palette):
    """One row per model: 90% interval, middle-50% interval, and the point estimate.

    ``rows`` needs columns model, low90, high90, low50, high50, risk.
    """
    y = alt.Y("model:N", title=None, sort=None, axis=alt.Axis(labelLimit=220))
    base = alt.Chart(rows)
    tooltip = [
        alt.Tooltip("model:N", title="Model"),
        alt.Tooltip("risk:Q", title="Estimate", format=".1%"),
        alt.Tooltip("low90:Q", title="90% range from", format=".1%"),
        alt.Tooltip("high90:Q", title="to", format=".1%"),
    ]
    outer = base.mark_bar(size=10, cornerRadius=5, color=palette.quiet).encode(
        x=alt.X(
            "low90:Q",
            title="10-year risk",
            scale=alt.Scale(domain=[0, x_max], nice=False),
            axis=alt.Axis(format=".0%", tickCount=6, grid=False),
        ),
        x2="high90:Q",
        y=y,
        tooltip=tooltip,
    )
    inner = base.mark_bar(size=10, cornerRadius=5, color=palette.loud).encode(
        x="low50:Q", x2="high50:Q", y=y, tooltip=tooltip
    )
    point = base.mark_point(
        shape="diamond", size=180, filled=True, color=palette.surface, opacity=1
    ).encode(x="risk:Q", y=y, tooltip=tooltip)
    return (outer + inner + point + _threshold_rule(threshold, palette)).properties(
        height=alt.Step(44), width="container"
    )


def what_if(rows: pd.DataFrame, threshold: float, x_max: float, palette: Palette):
    """Dumbbell per model from the current risk to the what-if risk.

    ``rows`` needs columns model, now, what_if.
    """
    long = rows.melt("model", ["now", "what_if"], var_name="scenario", value_name="risk")
    long["scenario"] = long["scenario"].map({"now": "Now", "what_if": "What-if"})
    y = alt.Y("model:N", title=None, sort=None, axis=alt.Axis(labelLimit=220))
    line = (
        alt.Chart(rows)
        .mark_rule(strokeWidth=2, color=palette.muted)
        .encode(x=alt.X("now:Q").scale(domain=[0, x_max], nice=False), x2="what_if:Q", y=y)
    )
    dots = (
        alt.Chart(long)
        .mark_circle(size=170, opacity=1, stroke=palette.surface, strokeWidth=2)
        .encode(
            x=_x(x_max),
            y=y,
            color=alt.Color(
                "scenario:N",
                scale=alt.Scale(domain=["Now", "What-if"], range=[palette.quiet, palette.loud]),
                legend=alt.Legend(title=None, orient="top", direction="horizontal"),
            ),
            tooltip=[
                alt.Tooltip("model:N", title="Model"),
                alt.Tooltip("scenario:N", title="Scenario"),
                alt.Tooltip("risk:Q", title="Risk", format=".1%"),
            ],
        )
    )
    return (line + dots + _threshold_rule(threshold, palette)).properties(
        height=alt.Step(44), width="container"
    )
