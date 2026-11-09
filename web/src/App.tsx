import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { QuantileDotplots } from "./components/Dotplot";
import { DonateCard } from "./components/donate/DonateCard";
import { DonateStory } from "./components/donate/DonateStory";
import { DonateSurvey } from "./components/donate/DonateSurvey";
import { PrivacyPage } from "./components/PrivacyPage";
import { ProfileForm } from "./components/ProfileForm";
import { RangeBands } from "./components/RangeBands";
import { WhatIfChart } from "./components/WhatIf";
import { ancestryOption, defaultAncestryFor, type AncestryKey } from "./lib/ancestry";
import { contributorCount, donationMode, intakeRecord, type HeartHistory } from "./lib/donation";
import { BASE_PROFILE, ETHNICITY_LABELS, THRESHOLDS } from "./lib/examples";
import { fieldName, listJoin, pct, thresholdLabel } from "./lib/format";
import { riskDomainMax } from "./lib/scale";
import { isCurrentSmoker, validate, type Profile } from "./models/profile";
import { QRISK3_DISCLAIMER } from "./models/qrisk3";
import { score, type ModelResult } from "./models/scoring";
import { simulate, summarize, type Summary } from "./models/uncertainty";

const N_DOTS = 20;
const REPO = "https://github.com/Anika-Lakhani/south-asian-heart-risk";
type View = "dots" | "ranges" | "words";

const clampInt = (value: number, low: number, high: number) =>
  Number.isFinite(value) ? Math.round(Math.min(Math.max(value, low), high)) : low;

function naturalFrequency(risk: number) {
  const exact = risk * 100;
  const low = Math.floor(exact);
  const high = Math.ceil(exact);
  return low === high ? `about ${low} in 100` : `about ${low}–${high} in 100`;
}

function headline(results: ModelResult[], summaries: Record<string, Summary>, threshold: number) {
  const risks = results.map((r) => r.risk);
  const low = Math.min(...risks);
  const high = Math.max(...risks);
  const line = thresholdLabel(threshold);
  const spread =
    high / low >= 1.5
      ? `The three calculators put you anywhere from ${pct(low)} to ${pct(high)}.`
      : `The three calculators roughly agree: ${pct(low)} to ${pct(high)}.`;

  const probs = results.map((r) => ({ r, p: summaries[r.model.key]!.probAbove(threshold) }));
  const unsure = probs
    .filter(({ p }) => p >= 0.15 && p <= 0.85)
    .sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5))[0];
  let side: string;
  if (unsure) {
    const k = Math.round(unsure.p * N_DOTS);
    side = `Under ${unsure.r.model.shortName}, measurement noise alone puts you past the ${line} line in ${k} of ${N_DOTS} re-measurements.`;
  } else if (probs.every(({ p }) => p < 0.15)) {
    side = `Even allowing for measurement noise, all three put you below the ${line} line.`;
  } else if (probs.every(({ p }) => p > 0.85)) {
    side = `Even allowing for measurement noise, all three put you past the ${line} line.`;
  } else {
    side = `The calculators disagree about which side of the ${line} line you're on.`;
  }
  return { spread, side };
}

export default function App() {
  const [profile, setProfile] = useState<Profile>(BASE_PROFILE);
  const [readings, setReadings] = useState({ bp: 1, lipids: 1 });
  const [hasResults, setHasResults] = useState(false);
  const [formStep, setFormStep] = useState(0);
  const [heartHistory, setHeartHistory] = useState<HeartHistory | null>(null);
  const [ancestry, setAncestry] = useState<AncestryKey>(defaultAncestryFor(BASE_PROFILE.ethnicity));
  const [donate, setDonate] = useState<null | "story" | "survey">(null);
  const [mode] = useState(() => donationMode());
  const [contributors, setContributors] = useState<number | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(
    () => typeof window !== "undefined" && window.location.hash === "#privacy",
  );

  useEffect(() => {
    const sync = () => setPrivacyOpen(window.location.hash === "#privacy");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (mode === "live") contributorCount().then(setContributors);
  }, [mode]);
  const [threshold, setThreshold] = useState(0.075);
  const [view, setView] = useState<View>("dots");
  const [whatIf, setWhatIf] = useState<Partial<Profile>>({});
  const problem = validate(profile);
  // Keep the last valid profile on screen while someone is mid-edit.
  const [lastValid, setLastValid] = useState(profile);
  if (!problem && lastValid !== profile) setLastValid(profile);
  const shown = useDeferredValue(problem ? lastValid : profile);

  const results = useMemo(() => score(shown), [shown]);
  const summaries = useMemo(() => {
    const samples = simulate(shown, {
      bpReadings: clampInt(readings.bp, 1, 6),
      lipidTests: clampInt(readings.lipids, 1, 4),
    });
    return Object.fromEntries(
      Object.entries(samples).map(([key, values]) => [key, summarize(values)]),
    ) as Record<string, Summary>;
  }, [shown, readings]);

  const xMax = riskDomainMax(
    results.map((r) => summaries[r.model.key]!.interval(0.98)[1]),
    threshold,
  );
  const { spread, side } = headline(results, summaries, threshold);

  const changed: Profile = { ...shown, ...whatIf };
  const whatIfProblem = validate(changed);
  const after = whatIfProblem ? results : score(changed);
  const whatIfMax = riskDomainMax(
    [...results, ...after].map((r) => r.risk),
    threshold,
  );
  const asWhite = shown.ethnicity === "white" ? null : score({ ...shown, ethnicity: "white" });

  const updateProfile = (next: Profile) => {
    setProfile(next);
    setWhatIf({});
  };

  const canDonate = mode !== "off";
  const hadHeartEvent = heartHistory === "yes";
  const openDonation = () => {
    setDonate("story");
    window.scrollTo({ top: 0 });
  };
  // People who've had a heart event have no results page, so they go back to the start.
  const leaveDonation = () => {
    setDonate(null);
    if (hadHeartEvent) setFormStep(0);
    window.scrollTo({ top: 0 });
  };
  const risks = results.map((r) => r.risk);

  // Shown only once there are enough donors for the number to mean something.
  const shownContributors = contributors !== null && contributors >= 10 ? contributors : null;

  if (privacyOpen) {
    return (
      <div className="intake-page donate-page">
        <main className="donate-main">
          <PrivacyPage
            onBack={() => {
              history.replaceState(null, "", window.location.pathname + window.location.search);
              setPrivacyOpen(false);
            }}
          />
        </main>
      </div>
    );
  }

  if (donate) {
    return (
      <div className="intake-page donate-page">
        <header className="intake-header">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path d="M16 27S5 20.2 5 11.8C5 7.9 7.7 5 11.4 5c2.1 0 3.8 1 4.6 2.5C16.8 6 18.5 5 20.6 5 24.3 5 27 7.9 27 11.8 27 20.2 16 27 16 27Z" />
                <path d="M7.5 16h5l2-4 3.2 8 2.2-4H25" />
              </svg>
            </span>
            <span>Heart Risk Check</span>
          </span>
          <span className="header-note">Anonymous data donation</span>
        </header>
        <main className="donate-main">
          {donate === "story" ? (
            <DonateStory
              spread={hadHeartEvent ? null : { low: Math.min(...risks), high: Math.max(...risks) }}
              preview={mode === "preview"}
              contributors={shownContributors}
              onStart={() => {
                setDonate("survey");
                window.scrollTo({ top: 0 });
              }}
              onCancel={hadHeartEvent ? leaveDonation : () => setDonate(null)}
              cancelLabel={hadHeartEvent ? "Not now" : "Back to my results"}
            />
          ) : (
            <DonateSurvey
              mode={mode}
              heartHistory={heartHistory ?? "no"}
              intake={intakeRecord(shown, ancestry, heartHistory ?? "no")}
              onFinish={leaveDonation}
              finishLabel={hadHeartEvent ? "Back to the start" : "Back to my results"}
            />
          )}
        </main>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="intake-page">
        <header className="intake-header">
          <a className="brand" href="#" aria-label="Heart risk check home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path d="M16 27S5 20.2 5 11.8C5 7.9 7.7 5 11.4 5c2.1 0 3.8 1 4.6 2.5C16.8 6 18.5 5 20.6 5 24.3 5 27 7.9 27 11.8 27 20.2 16 27 16 27Z" />
                <path d="M7.5 16h5l2-4 3.2 8 2.2-4H25" />
              </svg>
            </span>
            <span>Heart Risk Check</span>
          </a>
          <span className="header-note">Educational tool</span>
        </header>

        <main className="intake-main">
          <section className="intake-intro">
            <p className="eyebrow">A clearer view of your heart health</p>
            <h1>Understand your heart risk—with more context.</h1>
            <p className="lede">
              Three trusted calculators can give different answers, especially for South Asians.
              This free check compares them and shows how certain each estimate really is.
            </p>
            <div className="trust-row" aria-label="About this assessment">
              <span>
                <b>4</b> short steps
              </span>
              <span>
                <b>3–5</b> minutes
              </span>
              <span>
                <b>0</b> data saved
              </span>
            </div>
          </section>

          <section className="assessment-card" aria-label="Heart risk assessment">
            <ProfileForm
              profile={profile}
              onChange={updateProfile}
              readings={readings}
              onReadingsChange={setReadings}
              initialStep={formStep}
              heartHistory={heartHistory}
              onHeartHistoryChange={setHeartHistory}
              ancestry={ancestry}
              onAncestryChange={setAncestry}
              donationMode={mode}
              onComplete={() => {
                if (heartHistory === "yes") {
                  if (canDonate) openDonation();
                  return;
                }
                if (!validate(profile)) {
                  setHasResults(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            />
            {problem && (
              <p className="form-error intake-error" role="alert">
                {problem}
              </p>
            )}
          </section>
        </main>

        <footer className="intake-footer">
          <strong>Educational only, not medical advice.</strong> Talk to a clinician about your
          heart health. <a href="#privacy">Privacy</a>
        </footer>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="results-header">
        <div>
          <p className="eyebrow">Your heart risk overview</p>
          <h1>How sure is your heart risk?</h1>
        </div>
        <div className="results-header-actions">
          {canDonate && (
            <button type="button" className="link-button" onClick={openDonation}>
              Donate data
            </button>
          )}
          <button
            type="button"
            className="edit-answers"
            onClick={() => {
              // Come back to Review, where every answer is one "Edit" away.
              setFormStep(3);
              setHasResults(false);
            }}
          >
            Edit my answers
          </button>
        </div>
      </header>

      {heartHistory === "unsure" && (
        <p className="unsure-note" role="note">
          You weren’t sure whether you’ve had a heart event. If you have, these numbers don’t apply
          to you: the calculators are only accurate before a first heart attack, stroke, or similar
          event. Your doctor can tell you which applies.
        </p>
      )}

      <div className="result-shell">
        <main>
          <section className="results-guide" aria-labelledby="read-results">
            <div className="guide-heading">
              <p className="eyebrow">Start with the big picture</p>
              <h2 id="read-results">Three answers, not one verdict</h2>
              <p>
                Each calculator looks at the same information through a different evidence base.
                Read across the estimates before focusing on any single number.
              </p>
            </div>
            <ol className="reading-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Estimate</strong>
                  <p>Your modeled chance over the next 10 years.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Likely range</strong>
                  <p>How much repeat blood pressure and cholesterol readings could shift it.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Decision line</strong>
                  <p>A guideline comparison point—not a diagnosis or automatic treatment.</p>
                </div>
              </li>
            </ol>
          </section>

          <section aria-labelledby="estimates">
            <h2 id="estimates" className="visually-hidden">
              Your estimates
            </h2>
            <p className="headline" aria-live="polite">
              {spread} <span>{side}</span>
            </p>
            <div className="cards">
              {results.map((r) => {
                const [low, high] = summaries[r.model.key]!.interval(0.9);
                return (
                  <article key={r.model.key} className="card">
                    <h3>{r.model.name}</h3>
                    <p className="metric-label">10-year estimate</p>
                    <p className="big">{pct(r.risk)}</p>
                    <p className="range">
                      likely {pct(low)}–{pct(high)}
                    </p>
                    <p className="frequency">
                      <strong>{naturalFrequency(r.risk)}</strong> people with the same inputs may
                      experience {r.model.outcomePlain} within 10 years.
                    </p>
                    <p className="origin">{r.model.origin}</p>
                    <p className="outcome">Predicts {r.model.outcome}</p>
                    {r.outOfRange.length > 0 && (
                      <p className="warn">
                        Your {listJoin(r.outOfRange.map(fieldName))}{" "}
                        {r.outOfRange.length > 1 ? "are" : "is"} outside what this model was built
                        on. Treat it as a rough extrapolation.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel" aria-labelledby="how-sure">
            <h2 id="how-sure">How sure is that number?</h2>
            <p>
              We re-scored you 4,000 times, each time imagining your blood pressure and cholesterol
              had been measured on a different day. The spread is how far your risk could move from
              measurement noise alone.
            </p>
            <div className="uncertainty-key">
              <div>
                <span className="key-mark models" aria-hidden="true" />
                <p>
                  <strong>Model uncertainty</strong>
                  The difference between calculators comes from who they studied, what outcomes they
                  predict, and which factors they use.
                </p>
              </div>
              <div>
                <span className="key-mark readings" aria-hidden="true" />
                <p>
                  <strong>Measurement uncertainty</strong>
                  The range within each calculator comes from ordinary variation in blood pressure
                  and cholesterol readings.
                </p>
              </div>
            </div>
            <div className="controls">
              <div className="segmented" role="group" aria-label="Show uncertainty as">
                {(
                  [
                    ["dots", "Dots"],
                    ["ranges", "Ranges"],
                    ["words", "In words"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={view === key}
                    onClick={() => setView(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="threshold-select">
                <span>Compare against</span>
                <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
                  {THRESHOLDS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}: {t.note}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {view === "dots" && (
              <>
                <QuantileDotplots
                  rows={results.map((r) => ({
                    key: r.model.key,
                    name: r.model.name,
                    dots: summaries[r.model.key]!.quantileDots(N_DOTS),
                  }))}
                  threshold={threshold}
                  xMax={xMax}
                />
                <p className="caption">
                  Each dot is one of {N_DOTS} equally likely outcomes. Dots at or past the dashed
                  line are highlighted.
                </p>
              </>
            )}
            {view === "ranges" && (
              <RangeBands
                rows={results.map((r) => {
                  const s = summaries[r.model.key]!;
                  return {
                    key: r.model.key,
                    name: r.model.name,
                    risk: r.risk,
                    outer: s.interval(0.9),
                    inner: s.interval(0.5),
                  };
                })}
                threshold={threshold}
                xMax={xMax}
              />
            )}
            {view === "words" && (
              <div className="words">
                {results.map((r) => {
                  const s = summaries[r.model.key]!;
                  const [low, high] = s.interval(0.9);
                  const k = s.quantileDots(N_DOTS).filter((d) => d >= threshold).length;
                  return (
                    <p key={r.model.key}>
                      <strong>{r.model.name}</strong> puts your chance of {r.model.outcomePlain} in
                      the next 10 years at <b>{pct(r.risk)}</b>. If your blood pressure and
                      cholesterol were measured again, it would usually land between {pct(low)} and{" "}
                      {pct(high)}. In{" "}
                      <b>
                        {k} of {N_DOTS}
                      </b>{" "}
                      re-measurements, it's at or above {thresholdLabel(threshold)}.
                    </p>
                  );
                })}
              </div>
            )}

            <details className="numbers">
              <summary>Show all the numbers</summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">Predicts</th>
                      <th scope="col">Estimate</th>
                      <th scope="col">90% range</th>
                      <th scope="col">Chance ≥ {thresholdLabel(threshold)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => {
                      const s = summaries[r.model.key]!;
                      const [low, high] = s.interval(0.9);
                      return (
                        <tr key={r.model.key}>
                          <th scope="row">{r.model.name}</th>
                          <td>{r.model.outcome}</td>
                          <td>{pct(r.risk)}</td>
                          <td>
                            {pct(low)}–{pct(high)}
                          </td>
                          <td>{Math.round(s.probAbove(threshold) * 100)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          <section className="panel" aria-labelledby="disagree">
            <h2 id="disagree">Why the calculators disagree</h2>
            <p>
              The <strong>Pooled Cohort Equations</strong>, the standard US calculator, were built
              only on white and African American adults, and score everyone else as white.{" "}
              <strong>PREVENT</strong>, the newer US model, leaves race out entirely.{" "}
              <strong>QRISK3</strong>, from the UK, has its own terms for Indian, Pakistani, and
              Bangladeshi patients.
            </p>
            {asWhite && (
              <div className="table-wrap">
                <table className="compare">
                  <thead>
                    <tr>
                      <th scope="col">Model</th>
                      <th scope="col">As {ETHNICITY_LABELS[shown.ethnicity]}</th>
                      <th scope="col">Same person, as white</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const white = asWhite[i]!.risk;
                      const same = Math.abs(white - r.risk) < 1e-9;
                      return (
                        <tr key={r.model.key}>
                          <th scope="row">{r.model.name}</th>
                          <td>{pct(r.risk)}</td>
                          <td>
                            {pct(white)}{" "}
                            {same ? (
                              <span className="tag">no change</span>
                            ) : (
                              <span className="tag strong">
                                {white < r.risk ? "lower" : "higher"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="caption">
              The models also predict slightly different outcomes. QRISK3 counts mini-strokes
              (TIAs), which explains some of its higher numbers. And it was built on UK patients,
              who may differ from South Asians in the US.
            </p>
          </section>

          {canDonate && (
            <DonateCard
              southAsian={ancestryOption(ancestry).southAsian}
              contributors={shownContributors}
              onDonate={openDonation}
            />
          )}

          <section className="panel" aria-labelledby="what-if">
            <h2 id="what-if">What if…</h2>
            <p>Drag the sliders to see how changes would shift each estimate.</p>
            <p className="sensitivity-note">
              This is a sensitivity check, not a prediction of how a treatment will affect you.
            </p>
            <div className="sliders">
              {(
                [
                  ["systolicBp", "Systolic blood pressure", "mmHg", 90, 200],
                  ["totalCholesterol", "Total cholesterol", "mg/dL", 120, 320],
                  ["hdlCholesterol", "HDL cholesterol", "mg/dL", 20, 100],
                ] as const
              ).map(([key, label, unit, min, max]) => {
                const value = clampInt(changed[key], min, max);
                return (
                  <label key={key} className="slider">
                    <span className="slider-label">
                      {label}{" "}
                      <output>
                        {value} {unit}
                      </output>
                    </span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={value}
                      onChange={(e) => setWhatIf({ ...whatIf, [key]: e.target.valueAsNumber })}
                    />
                  </label>
                );
              })}
              <label className="toggle">
                <input
                  type="checkbox"
                  disabled={!isCurrentSmoker(shown)}
                  checked={whatIf.smoking === "former"}
                  onChange={(e) =>
                    setWhatIf({
                      ...whatIf,
                      smoking: e.target.checked ? "former" : shown.smoking,
                    })
                  }
                />
                <span>Quit smoking{!isCurrentSmoker(shown) && " (you don't smoke)"}</span>
              </label>
              <button
                type="button"
                className="link-button"
                disabled={Object.keys(whatIf).length === 0}
                onClick={() => setWhatIf({})}
              >
                Reset
              </button>
            </div>
            {whatIfProblem && <p className="form-error">{whatIfProblem}</p>}
            <WhatIfChart
              rows={results.map((r, i) => ({
                key: r.model.key,
                name: r.model.name,
                now: r.risk,
                after: after[i]!.risk,
              }))}
              threshold={threshold}
              xMax={whatIfMax}
            />
          </section>
        </main>
      </div>

      <footer className="footer">
        <p>
          <strong>Educational only, not medical advice.</strong> Talk to a clinician about your
          heart health.
        </p>
        <p>
          Every model is implemented from its published equations and tested against its authors'
          reference values. Measurement noise assumes a blood pressure reading varies by about 12
          mmHg between visits, and cholesterol by about 6–7%. This grew out of a Harvard CS 2790r
          project on communicating risk uncertainty to patients. Probabilities are shown exactly as
          computed, with no adjustment to make them feel more intuitive.
        </p>
        <p>
          <a href={REPO}>Source code, methods, and tests</a> · <a href="#privacy">Privacy</a>
        </p>
        <p className="fine">QRISK3 disclaimer: {QRISK3_DISCLAIMER}</p>
      </footer>
    </div>
  );
}
