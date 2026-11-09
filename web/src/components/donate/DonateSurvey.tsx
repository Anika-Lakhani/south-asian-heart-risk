import { useState, type ReactNode } from "react";

import {
  HEART_EVENTS,
  newDonationId,
  submitModule,
  type ContextAnswers,
  type CoreAnswers,
  type DonationMode,
  type HeartHistory,
  type Module,
  type SouthAsianAnswers,
} from "../../lib/donation";
import { BotCheckError } from "../../lib/turnstile";

type Stage = "core" | "offerSouthAsian" | "southAsian" | "offerContext" | "context" | "done";

interface Props {
  mode: DonationMode;
  heartHistory: HeartHistory;
  /** Anonymized intake answers, sent with the core section. */
  intake: object;
  onFinish: () => void;
  finishLabel: string;
}

// ---------------------------------------------------------------- small inputs

function Choice<T extends string>(props: {
  legend: string;
  hint?: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="survey-field">
      <legend>{props.legend}</legend>
      {props.hint && <p className="field-hint">{props.hint}</p>}
      <div className="survey-options">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function MultiChoice<T extends string>(props: {
  legend: string;
  hint?: string;
  value: T[];
  options: readonly { value: T; label: string }[];
  onChange: (value: T[]) => void;
}) {
  const toggle = (v: T) =>
    props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
  return (
    <fieldset className="survey-field">
      <legend>{props.legend}</legend>
      {props.hint && <p className="field-hint">{props.hint}</p>}
      <div className="survey-options">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={props.value.includes(o.value)}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Num(props: {
  label: string;
  hint?: string;
  unit?: ReactNode;
  value: number | null;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="survey-field survey-number">
      <span className="field-label">{props.label}</span>
      {props.hint && <span className="field-hint">{props.hint}</span>}
      <span className="survey-number-row">
        <input
          type="number"
          inputMode="decimal"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value ?? ""}
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            props.onChange(Number.isFinite(v) ? Math.min(props.max, Math.max(props.min, v)) : null);
          }}
        />
        {props.unit}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------- the survey

const EMPTY_CORE: CoreAnswers = {
  heartEvents: [],
  ageAtFirstEvent: null,
  bornInUs: null,
  yearsInUs: null,
  numbersSource: null,
  numbersRecency: null,
};

const EMPTY_SOUTH_ASIAN: SouthAsianAnswers = {
  waist: null,
  waistUnit: "in",
  otherTobacco: [],
  diet: null,
  ldl: null,
  triglycerides: null,
  hba1c: null,
  lpa: null,
  familyRelatives: [],
  familyEarliestAge: null,
};

const EMPTY_CONTEXT: ContextAnswers = {
  activeDays: null,
  drinksPerWeek: null,
  sleepHours: null,
  education: null,
  residence: null,
};

export function DonateSurvey({ mode, heartHistory, intake, onFinish, finishLabel }: Props) {
  const [donationId] = useState(newDonationId);
  const [stage, setStage] = useState<Stage>("core");
  const [core, setCore] = useState(EMPTY_CORE);
  const [southAsian, setSouthAsian] = useState(EMPTY_SOUTH_ASIAN);
  const [context, setContext] = useState(EMPTY_CONTEXT);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Module[]>([]);

  const go = (next: Stage) => {
    setStage(next);
    document.querySelector(".survey-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async (module: Module, answers: object, next: Stage) => {
    setSending(true);
    setError(null);
    try {
      await submitModule(mode, donationId, module, answers);
      setSaved((s) => [...s, module]);
      go(next);
    } catch (e) {
      setError(
        e instanceof BotCheckError
          ? "We couldn’t confirm you’re a person, so nothing was saved. Please try again, or try a different browser."
          : "We couldn’t save that section. Check your connection and try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const hadEvent = heartHistory === "yes";
  const nothingSent = mode !== "live" && (
    <p className="preview-note">Preview mode: nothing was sent.</p>
  );

  return (
    <section className="survey-card" aria-live="polite">
      {stage === "core" && (
        <div className="survey-step">
          <p className="step-kicker">Research questions · about 1 minute</p>
          <h2>A few questions US surveys don’t ask</h2>
          <p className="step-intro">
            Your answers from the risk check are already included, so this only covers what’s new.
            Skip anything you’d rather not answer.
          </p>

          {hadEvent && (
            <>
              <MultiChoice
                legend="Which have you been told you had?"
                value={core.heartEvents}
                options={HEART_EVENTS.map((e) => ({ value: e.key, label: e.label }))}
                onChange={(heartEvents) => setCore({ ...core, heartEvents })}
              />
              <Num
                label="How old were you the first time?"
                hint="Early heart disease is one of the biggest open questions for South Asians."
                value={core.ageAtFirstEvent}
                min={1}
                max={100}
                onChange={(ageAtFirstEvent) => setCore({ ...core, ageAtFirstEvent })}
              />
            </>
          )}

          <Choice
            legend="Were you born in the country you live in now?"
            value={core.bornInUs}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            onChange={(bornInUs) =>
              setCore({ ...core, bornInUs, yearsInUs: bornInUs === "yes" ? null : core.yearsInUs })
            }
          />
          {core.bornInUs === "no" && (
            <Num
              label="About how many years have you lived there?"
              hint="Time since moving is one of the strongest known influences on South Asian heart risk."
              value={core.yearsInUs}
              min={0}
              max={100}
              onChange={(yearsInUs) => setCore({ ...core, yearsInUs })}
            />
          )}

          <Choice
            legend="Where did your blood pressure and cholesterol numbers come from?"
            value={core.numbersSource}
            options={[
              { value: "lab", label: "Lab report or patient portal" },
              { value: "clinic", label: "Clinic or pharmacy reading" },
              { value: "home", label: "Home monitor" },
              { value: "estimate", label: "My best guess" },
            ]}
            onChange={(numbersSource) => setCore({ ...core, numbersSource })}
          />
          <Choice
            legend="How recent are they?"
            value={core.numbersRecency}
            options={[
              { value: "under6m", label: "Under 6 months" },
              { value: "6to12m", label: "6–12 months" },
              { value: "1to2y", label: "1–2 years" },
              { value: "over2y", label: "Over 2 years" },
            ]}
            onChange={(numbersRecency) => setCore({ ...core, numbersRecency })}
          />

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="donate-actions">
            <span />
            <button
              type="button"
              className="primary-button"
              disabled={sending}
              onClick={() => save("core", { intake, ...core }, "offerSouthAsian")}
            >
              {sending ? "Saving…" : "Submit"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {stage === "offerSouthAsian" && (
        <Offer
          title="Thank you, your answers are in."
          body="Could you spare about 2 more minutes for questions about risks that are common in South Asian communities but missing from standard surveys, like waist size, chewing tobacco, and Lp(a)?"
          yes="Yes, add these questions"
          onYes={() => go("southAsian")}
          onNo={() => go("done")}
          footer={nothingSent}
        />
      )}

      {stage === "southAsian" && (
        <div className="survey-step">
          <p className="step-kicker">Optional · about 2 minutes</p>
          <h2>Risks common in South Asian communities</h2>
          <p className="step-intro">Skip anything you don’t know.</p>

          <Num
            label="Waist size"
            hint="Measured around your belly button. South Asians tend to develop heart risk at lower BMIs, and waist size captures that better."
            value={southAsian.waist}
            min={15}
            max={250}
            onChange={(waist) => setSouthAsian({ ...southAsian, waist })}
            unit={
              <span className="unit-toggle" role="group" aria-label="Waist unit">
                {(["in", "cm"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={southAsian.waistUnit === u}
                    onClick={() => setSouthAsian({ ...southAsian, waistUnit: u })}
                  >
                    {u}
                  </button>
                ))}
              </span>
            }
          />
          <MultiChoice
            legend="Do you use any of these regularly?"
            hint="Standard smoking questions miss these."
            value={southAsian.otherTobacco}
            options={[
              { value: "chewing", label: "Chewing tobacco" },
              { value: "paan", label: "Paan with tobacco" },
              { value: "gutka", label: "Gutka" },
              { value: "bidi", label: "Bidis" },
              { value: "hookah", label: "Hookah" },
            ]}
            onChange={(otherTobacco) => setSouthAsian({ ...southAsian, otherTobacco })}
          />
          <Choice
            legend="How would you describe your diet?"
            value={southAsian.diet}
            options={[
              { value: "vegetarian", label: "Vegetarian" },
              { value: "mostly", label: "Mostly vegetarian" },
              { value: "nonvegetarian", label: "Not vegetarian" },
            ]}
            onChange={(diet) => setSouthAsian({ ...southAsian, diet })}
          />
          <fieldset className="survey-field">
            <legend>Lab results you know (optional)</legend>
            <p className="field-hint">Lp(a) runs high in South Asians and is rarely collected.</p>
            <div className="survey-grid">
              <Num
                label="LDL cholesterol"
                unit={<span className="unit">mg/dL</span>}
                value={southAsian.ldl}
                min={10}
                max={400}
                onChange={(ldl) => setSouthAsian({ ...southAsian, ldl })}
              />
              <Num
                label="Triglycerides"
                unit={<span className="unit">mg/dL</span>}
                value={southAsian.triglycerides}
                min={10}
                max={2000}
                onChange={(triglycerides) => setSouthAsian({ ...southAsian, triglycerides })}
              />
              <Num
                label="HbA1c"
                unit={<span className="unit">%</span>}
                value={southAsian.hba1c}
                min={3}
                max={20}
                step={0.1}
                onChange={(hba1c) => setSouthAsian({ ...southAsian, hba1c })}
              />
              <Num
                label="Lp(a)"
                unit={<span className="unit">nmol/L</span>}
                value={southAsian.lpa}
                min={0}
                max={1000}
                onChange={(lpa) => setSouthAsian({ ...southAsian, lpa })}
              />
            </div>
          </fieldset>
          <MultiChoice
            legend="Which close relatives have had heart disease?"
            value={southAsian.familyRelatives}
            options={[
              { value: "father", label: "Father" },
              { value: "mother", label: "Mother" },
              { value: "brother", label: "Brother" },
              { value: "sister", label: "Sister" },
            ]}
            onChange={(familyRelatives) => setSouthAsian({ ...southAsian, familyRelatives })}
          />
          {southAsian.familyRelatives.length > 0 && (
            <Num
              label="Youngest age any of them was diagnosed"
              hint="Heart disease before 55 in men or 65 in women counts as early."
              value={southAsian.familyEarliestAge}
              min={1}
              max={110}
              onChange={(familyEarliestAge) => setSouthAsian({ ...southAsian, familyEarliestAge })}
            />
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="donate-actions">
            <button type="button" className="secondary-button" onClick={() => go("done")}>
              Skip this section
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={sending}
              onClick={() => save("southAsian", southAsian, "offerContext")}
            >
              {sending ? "Saving…" : "Submit"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {stage === "offerContext" && (
        <Offer
          title="That section is saved. Thank you."
          body="One last optional section: about 2 minutes on everyday habits and background, matching questions from national surveys so researchers can compare."
          yes="Yes, one more section"
          onYes={() => go("context")}
          onNo={() => go("done")}
          footer={nothingSent}
        />
      )}

      {stage === "context" && (
        <div className="survey-step">
          <p className="step-kicker">Optional · about 2 minutes</p>
          <h2>Everyday habits and background</h2>
          <p className="step-intro">These match national survey questions, so researchers can compare.</p>

          <Num
            label="Days per week with 30+ minutes of exercise"
            value={context.activeDays}
            min={0}
            max={7}
            onChange={(activeDays) => setContext({ ...context, activeDays })}
          />
          <Num
            label="Alcoholic drinks in a typical week"
            value={context.drinksPerWeek}
            min={0}
            max={100}
            onChange={(drinksPerWeek) => setContext({ ...context, drinksPerWeek })}
          />
          <Num
            label="Hours of sleep on a typical night"
            value={context.sleepHours}
            min={0}
            max={24}
            step={0.5}
            onChange={(sleepHours) => setContext({ ...context, sleepHours })}
          />
          <Choice
            legend="Highest education completed"
            value={context.education}
            options={[
              { value: "highschool", label: "High school or less" },
              { value: "somecollege", label: "Some college" },
              { value: "bachelors", label: "Bachelor’s degree" },
              { value: "graduate", label: "Graduate degree" },
            ]}
            onChange={(education) => setContext({ ...context, education })}
          />
          <Choice
            legend="Where do you live?"
            hint="Regions only, never your city or state."
            value={context.residence}
            options={[
              { value: "us_northeast", label: "US Northeast" },
              { value: "us_midwest", label: "US Midwest" },
              { value: "us_south", label: "US South" },
              { value: "us_west", label: "US West" },
              { value: "canada", label: "Canada" },
              { value: "uk", label: "United Kingdom" },
              { value: "other", label: "Elsewhere" },
            ]}
            onChange={(residence) => setContext({ ...context, residence })}
          />

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="donate-actions">
            <button type="button" className="secondary-button" onClick={() => go("done")}>
              Skip this section
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={sending}
              onClick={() => save("context", context, "done")}
            >
              {sending ? "Saving…" : "Submit"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="survey-step survey-done">
          <span className="done-mark" aria-hidden="true">
            ✓
          </span>
          <h2>Thank you for helping South Asian hearts</h2>
          <p className="step-intro">
            You shared {saved.length === 1 ? "1 section" : `${saved.length} sections`}. Your
            anonymous answers will appear in the next public release of the dataset.
          </p>
          {nothingSent}
          <div className="donate-actions">
            <span />
            <button type="button" className="primary-button" onClick={onFinish}>
              {finishLabel} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Offer(props: {
  title: string;
  body: string;
  yes: string;
  onYes: () => void;
  onNo: () => void;
  footer: ReactNode;
}) {
  return (
    <div className="survey-step survey-offer">
      <span className="done-mark" aria-hidden="true">
        ✓
      </span>
      <h2>{props.title}</h2>
      <p className="step-intro">{props.body}</p>
      {props.footer}
      <div className="donate-actions">
        <button type="button" className="secondary-button" onClick={props.onNo}>
          No thanks, I’m done
        </button>
        <button type="button" className="primary-button" onClick={props.onYes}>
          {props.yes} <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
