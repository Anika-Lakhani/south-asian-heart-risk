import { useState } from "react";

import { pct } from "../../lib/format";
import { SOURCES } from "../../lib/sources";
import { Reveal } from "../Reveal";

interface Props {
  /** The person's own calculator range, when they came from their results. */
  spread: { low: number; high: number } | null;
  preview: boolean;
  /** Shown once there are enough donors to be meaningful. */
  contributors: number | null;
  onStart: () => void;
  onCancel: () => void;
  cancelLabel: string;
}

const Cite = ({ n }: { n: number }) => (
  <sup>
    <a href={`#source-${n}`} aria-label={`Source ${n}`}>
      {n}
    </a>
  </sup>
);

const SOUTH_ASIAN_GROUPS = ["Indian", "Pakistani", "Bangladeshi", "Sri Lankan", "Nepali", "Bhutanese", "Maldivian"];
const OTHER_ASIAN_GROUPS = ["Chinese", "Filipino", "Vietnamese", "Korean", "Japanese"];

const PROTECTIONS = [
  {
    title: "Nothing is sent without your OK",
    body: "Your risk check never leaves this page. Donating is a separate choice, and you can stop at any point.",
  },
  {
    title: "No name, email, IP address, or location",
    body: "We never ask who you are, and none of that is stored with your answers. (Our database host keeps routine access logs, which can include IP addresses, for one day. They're never linked to your answers.)",
  },
  {
    title: "Your age becomes a range",
    body: "We store a 5-year band like 45–49, never your exact age or birthday.",
  },
  {
    title: "No one can be singled out",
    body: "Answers are only published in groups of at least 5 people who look alike on paper. Rarer combinations are merged or held back.",
  },
  {
    title: "Every section counts on its own",
    body: "Each part is saved when you finish it, so stopping early never wastes what you've shared.",
  },
  {
    title: "Open for anyone to check",
    body: "The dataset is free under an open license, so researchers everywhere can use it and anyone can see exactly what's shared.",
  },
];

const ANSWER_STEPS = [
  {
    title: "Answer about 1 minute of questions",
    body: "A few questions beyond your risk check, with two optional sections after that if you'd like to share more.",
  },
  {
    title: "Your answers join an open dataset",
    body: "It records real South Asian categories, age at a first heart event, and immigration history: details US surveys don't collect.",
  },
  {
    title: "Researchers anywhere use it for free",
    body: "To study South Asian heart health, and to check whether risk tools work for us.",
  },
];

export function DonateStory({
  spread,
  preview,
  contributors,
  onStart,
  onCancel,
  cancelLabel,
}: Props) {
  const [agreed, setAgreed] = useState(false);
  const low = spread?.low ?? 0.024;
  const high = spread?.high ?? 0.075;

  return (
    <article className="donate-story">
      {preview && (
        <p className="preview-banner" role="note">
          <strong>Preview:</strong> donations aren’t connected yet. Nothing you enter here is sent
          anywhere.
        </p>
      )}

      <header className="donate-hero">
        <p className="eyebrow">Donate your data to science</p>
        <h1>Help close the South Asian heart data gap</h1>
        <p className="lede">
          South Asians face some of the highest heart disease risk of any group in the US. Yet the
          calculators and data that guide our care barely see us. A few minutes of your anonymous
          answers can help change that.
        </p>
        <p className="cards-hint story-hint">
          Point at any box, or tap its <span className="hint-icon">i</span>, for the details and
          sources.
        </p>
        {contributors !== null && (
          <p className="contributors">
            <b>{contributors.toLocaleString()}</b> people have donated so far.
          </p>
        )}
      </header>

      <section className="donate-section" aria-labelledby="risk-real">
        <h2 id="risk-real">The risk is real</h2>
        <div className="stat-grid">
          <Reveal
            className="stat"
            label="More about earlier heart attacks"
            more={
              <p>
                On average, a first heart attack strikes about 6 years earlier in South Asia than
                elsewhere in the world, in a study of 52 countries
                <Cite n={2} />.
              </p>
            }
          >
            <p className="stat-value">~6 years</p>
            <p className="stat-label">earlier first heart attacks</p>
          </Reveal>
          <Reveal
            className="stat"
            label="More about heart disease deaths"
            more={
              <p>
                Among Asian American groups, Asian Indian men and women have the highest share of
                deaths from coronary heart disease
                <Cite n={3} />.
              </p>
            }
          >
            <p className="stat-value">Highest</p>
            <p className="stat-label">heart-disease death share of any Asian American group</p>
          </Reveal>
          <Reveal
            className="stat"
            label="More about South Asians in the US"
            more={
              <p>
                About 5.8 million South Asians live in the US
                <Cite n={5} />, with a higher share of deaths from heart disease than non-Hispanic
                white Americans
                <Cite n={1} />.
              </p>
            }
          >
            <p className="stat-value">5.8 million</p>
            <p className="stat-label">South Asians in the US</p>
          </Reveal>
        </div>
      </section>

      <section className="donate-section" aria-labelledby="flattened">
        <h2 id="flattened">The system flattens it</h2>
        <div className="flatten" aria-label="Diagram: twelve distinct Asian groups, including seven South Asian groups, all recorded as a single Asian category">
          <div className="flatten-groups">
            {SOUTH_ASIAN_GROUPS.map((g) => (
              <span key={g} className="group south-asian">
                {g}
              </span>
            ))}
            {OTHER_ASIAN_GROUPS.map((g) => (
              <span key={g} className="group">
                {g}
              </span>
            ))}
          </div>
          <svg className="flatten-arrow" viewBox="0 0 40 24" aria-hidden="true">
            <path d="M2 12h32m-8-8 8 8-8 8" />
          </svg>
          <div className="flatten-box">
            <span>Asian</span>
            <small>How US health surveys record all of us</small>
          </div>
        </div>
        <div className="flatten-points">
          <Reveal
            className="point-tile"
            label="More about why calculators can't see you"
            more={
              <p>
                The standard US calculator scores South Asians as white, and the newest one ignores
                ancestry entirely. For the same person, the three calculators in this tool range
                from <b>{pct(low)}</b> to <b>{pct(high)}</b>.
              </p>
            }
          >
            <strong>The calculators can’t see you</strong>
            <p className="point-figure">
              {pct(low)} <span aria-hidden="true">↔</span>
              <span className="visually-hidden">to</span> {pct(high)}
            </p>
            <p className="point-caption">
              {spread ? "Your" : "One person's"} 10-year risk, depending on the calculator
            </p>
          </Reveal>
          <Reveal
            className="point-tile"
            label="More about how this affects care"
            more={
              <p>
                In the US, whether a statin is recommended, and covered without a copay by most
                private insurance plans, hinges on a 10-year risk estimate of 10% or more
                <Cite n={6} />. When a calculator underestimates your risk, it can push you below
                that line.
              </p>
            }
          >
            <strong>That can affect your care</strong>
            <p className="point-figure">10%</p>
            <p className="point-caption">the risk line for a recommended, covered statin</p>
          </Reveal>
        </div>
      </section>

      <section className="donate-section" aria-labelledby="missing">
        <h2 id="missing">And the data is missing</h2>
        <div className="missing-row">
          <Reveal
            className="stat big"
            label="More about research funding"
            more={
              <p>
                Of the NIH budget from 1992 to 2018, 0.17% went to clinical research focused on
                Asian Americans, Native Hawaiians, and Pacific Islanders
                <Cite n={4} />.
              </p>
            }
          >
            <p className="stat-value">0.17%</p>
            <p className="stat-label">of NIH research funding focused on Asian Americans</p>
          </Reveal>
          <Reveal
            className="point-tile"
            label="More about pooled data"
            more={
              <p>
                When we trained a model on 273,266 US health-survey respondents, the single “Asian”
                category made Asian ancestry look <em>protective</em>, the opposite of what
                research on South Asians shows. Pooled data doesn’t just miss us; it can point the
                wrong way.{" "}
                <a href="https://github.com/Anika-Lakhani/south-asian-heart-risk/blob/main/ml/MODEL_CARD.md">
                  See the analysis
                </a>
              </p>
            }
          >
            <strong>Pooled data points the wrong way</strong>
            <div className="contrast">
              <p>
                <span className="contrast-arrow down" aria-hidden="true">↓</span>
                <b>Lower risk</b>
                <small>what “Asian” survey data suggests</small>
              </p>
              <p>
                <span className="contrast-arrow up" aria-hidden="true">↑</span>
                <b>Higher risk</b>
                <small>what South Asian research shows</small>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="donate-section" aria-labelledby="your-answers">
        <h2 id="your-answers">What your answers do</h2>
        <ol className="answer-steps">
          {ANSWER_STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} label={`More about step ${i + 1}`} more={<p>{step.body}</p>}>
              <span className="step-number">{i + 1}</span>
              <strong>{step.title}</strong>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="donate-section protect" aria-labelledby="protect">
        <h2 id="protect">How we protect you</h2>
        <ul className="protect-grid">
          {PROTECTIONS.map((item) => (
            <Reveal as="li" key={item.title} label={`More about: ${item.title}`} more={<p>{item.body}</p>}>
              <span className="protect-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M8 1.5 2.5 3.8v3.7c0 3.3 2.3 6.1 5.5 7 3.2-.9 5.5-3.7 5.5-7V3.8L8 1.5Z" />
                  <path d="m5.5 8 1.8 1.8 3.3-3.6" />
                </svg>
              </span>
              <strong>{item.title}</strong>
            </Reveal>
          ))}
        </ul>
        <p className="protect-more">
          <a href="#privacy">Read the full privacy details</a>
        </p>
      </section>

      <section className="donate-consent" aria-label="Consent">
        <label className="consent-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to share my anonymous answers. They’ll be published in a free public dataset
            that researchers anywhere can download.
          </span>
        </label>
        <div className="donate-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="primary-button" disabled={!agreed} onClick={onStart}>
            Start, about 1 minute <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <footer className="donate-sources">
        <h2>Sources</h2>
        <ol>
          {SOURCES.map((s) => (
            <li key={s.id} id={`source-${s.id}`}>
              {s.text}{" "}
              <a href={s.url} target="_blank" rel="noreferrer">
                Link
              </a>
            </li>
          ))}
        </ol>
      </footer>
    </article>
  );
}
