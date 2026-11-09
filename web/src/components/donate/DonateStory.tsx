import { useState } from "react";

import { pct } from "../../lib/format";
import { SOURCES } from "../../lib/sources";

interface Props {
  /** The person's own calculator range, when they came from their results. */
  spread: { low: number; high: number } | null;
  preview: boolean;
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

export function DonateStory({ spread, preview, onStart, onCancel, cancelLabel }: Props) {
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
      </header>

      <section className="donate-section" aria-labelledby="risk-real">
        <h2 id="risk-real">The risk is real</h2>
        <div className="stat-grid">
          <div className="stat">
            <p className="stat-value">~6 years</p>
            <p className="stat-label">
              earlier, on average, that a first heart attack strikes in South Asia than elsewhere
              in the world
              <Cite n={2} />
            </p>
          </div>
          <div className="stat">
            <p className="stat-value">Highest</p>
            <p className="stat-label">
              share of deaths from coronary heart disease among Asian American groups, for Asian
              Indian men and women
              <Cite n={3} />
            </p>
          </div>
          <div className="stat">
            <p className="stat-value">5.8 million</p>
            <p className="stat-label">
              South Asians living in the US
              <Cite n={5} />, with a higher share of deaths from heart disease than non-Hispanic
              white Americans
              <Cite n={1} />
            </p>
          </div>
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
          <p>
            <strong>The calculators can’t see you.</strong> The standard US calculator scores South
            Asians as white, and the newest one ignores ancestry entirely. For the same person, the
            three calculators in this tool range from <b>{pct(low)}</b> to <b>{pct(high)}</b>.
          </p>
          <p>
            <strong>That can affect your care and coverage.</strong> In the US, whether a statin is
            recommended, and covered without a copay by most private insurance plans, hinges on a
            10-year risk estimate of 10% or more
            <Cite n={6} />. When a calculator underestimates your risk, it can push you below that
            line.
          </p>
        </div>
      </section>

      <section className="donate-section" aria-labelledby="missing">
        <h2 id="missing">And the data is missing</h2>
        <div className="missing-row">
          <div className="stat big">
            <p className="stat-value">0.17%</p>
            <p className="stat-label">
              of the NIH budget went to clinical research focused on Asian Americans, Native
              Hawaiians, and Pacific Islanders from 1992 to 2018
              <Cite n={4} />
            </p>
          </div>
          <p>
            When we trained a model on 273,266 US health-survey respondents, the single “Asian”
            category made Asian ancestry look <em>protective</em>, the opposite of what research on
            South Asians shows. Pooled data doesn’t just miss us; it can point the wrong way.{" "}
            <a href="https://github.com/Anika-Lakhani/south-asian-heart-risk/blob/main/ml/MODEL_CARD.md">
              See the analysis
            </a>
          </p>
        </div>
      </section>

      <section className="donate-section" aria-labelledby="your-answers">
        <h2 id="your-answers">What your answers do</h2>
        <ol className="answer-steps">
          <li>
            <span>1</span>
            <p>
              <strong>You answer a few questions</strong> beyond your risk check: about 1 minute,
              with two optional sections after that.
            </p>
          </li>
          <li>
            <span>2</span>
            <p>
              <strong>Your answers join a public dataset</strong> with real South Asian categories,
              age at first heart event, and immigration history, details US surveys don’t collect.
            </p>
          </li>
          <li>
            <span>3</span>
            <p>
              <strong>Researchers anywhere can download it for free</strong> to study South Asian
              heart health, and check whether risk tools work for us.
            </p>
          </li>
        </ol>
      </section>

      <section className="donate-section protect" aria-labelledby="protect">
        <h2 id="protect">How we protect you</h2>
        <ul className="protect-grid">
          {PROTECTIONS.map((item) => (
            <li key={item.title}>
              <span className="protect-icon" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M8 1.5 2.5 3.8v3.7c0 3.3 2.3 6.1 5.5 7 3.2-.9 5.5-3.7 5.5-7V3.8L8 1.5Z" />
                  <path d="m5.5 8 1.8 1.8 3.3-3.6" />
                </svg>
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
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
