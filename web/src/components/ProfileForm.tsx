import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  ANCESTRY_OPTIONS,
  ancestryOption,
  defaultAncestryFor,
  type AncestryKey,
} from "../lib/ancestry";
import type { DonationMode, HeartHistory } from "../lib/donation";
import { CONDITION_LABELS, EXAMPLES, SMOKING_LABELS } from "../lib/examples";
import { CONDITIONS, SMOKING, type Profile } from "../models/profile";

interface Props {
  profile: Profile;
  onChange: (profile: Profile) => void;
  readings: { bp: number; lipids: number };
  onReadingsChange: (readings: { bp: number; lipids: number }) => void;
  onComplete: () => void;
  /** Step to open on, e.g. Review when coming back from the results to edit. */
  initialStep?: number;
  heartHistory: HeartHistory | null;
  onHeartHistoryChange: (value: HeartHistory) => void;
  ancestry: AncestryKey;
  onAncestryChange: (value: AncestryKey) => void;
  donationMode: DonationMode;
}

const HEART_HISTORY_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "unsure", label: "Not sure" },
] as const;

const STEPS = [
  { title: "About you", note: "The basics" },
  { title: "Your numbers", note: "Recent readings" },
  { title: "Health history", note: "A few quick questions" },
  { title: "Review", note: "Check and calculate" },
] as const;

function NumberField(props: {
  label: string;
  hint?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const { label, hint, unit, value, min, max, step = 1, onChange } = props;
  const drag = useRef<{ y: number; value: number } | null>(null);
  const precision = (String(step).split(".")[1] ?? "").length;
  const adjust = (direction: number) => {
    const current = Number.isFinite(value) ? value : min;
    const next = Math.min(max, Math.max(min, current + direction * step));
    onChange(Number(next.toFixed(precision)));
  };
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { y: event.clientY, value: Number.isFinite(value) ? value : min };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const scrub = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    const stepsMoved = Math.round((drag.current.y - event.clientY) / 6);
    const next = Math.min(max, Math.max(min, drag.current.value + stepsMoved * step));
    onChange(Number(next.toFixed(precision)));
  };
  const stopDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      <span className="number-input">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.valueAsNumber)}
        />
        {unit && <span className="unit">{unit}</span>}
        <span className="number-controls">
          <button
            type="button"
            className="number-step"
            aria-label={`Increase ${label}`}
            onClick={() => adjust(1)}
          >
            <svg viewBox="0 0 12 8" aria-hidden="true">
              <path d="m2 6 4-4 4 4" />
            </svg>
          </button>
          <button
            type="button"
            className="number-scrub"
            aria-label={`Drag up or down to adjust ${label}`}
            title="Drag up or down to adjust"
            onPointerDown={startDrag}
            onPointerMove={scrub}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                adjust(event.key === "ArrowUp" ? 1 : -1);
              }
            }}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3h6M3 6h6M3 9h6" />
            </svg>
          </button>
          <button
            type="button"
            className="number-step"
            aria-label={`Decrease ${label}`}
            onClick={() => adjust(-1)}
          >
            <svg viewBox="0 0 12 8" aria-hidden="true">
              <path d="m2 2 4 4 4-4" />
            </svg>
          </button>
        </span>
      </span>
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="choice-row">
      <span>{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  );
}

export function ProfileForm({
  profile,
  onChange,
  readings,
  onReadingsChange,
  onComplete,
  initialStep = 0,
  heartHistory,
  onHeartHistoryChange,
  ancestry,
  onAncestryChange,
  donationMode,
}: Props) {
  const [step, setStep] = useState(initialStep);
  const [heartHistoryMissing, setHeartHistoryMissing] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const hadHeartEvent = heartHistory === "yes";
  const canDonate = donationMode !== "off";
  const [bmiOpen, setBmiOpen] = useState(false);
  const [bmiUnits, setBmiUnits] = useState<"us" | "metric">("us");
  const [heightFeet, setHeightFeet] = useState(5);
  const [heightInches, setHeightInches] = useState(7);
  const [weightPounds, setWeightPounds] = useState(165);
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(75);
  const [bmiCalculated, setBmiCalculated] = useState(false);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const calculateBmi = () => {
    const bmi =
      bmiUnits === "us"
        ? (703 * weightPounds) / (heightFeet * 12 + heightInches) ** 2
        : weightKg / (heightCm / 100) ** 2;
    if (Number.isFinite(bmi) && bmi > 0) {
      set("bmi", Number(bmi.toFixed(1)));
      setBmiCalculated(true);
    }
  };

  const goNext = () => {
    if (step === 0 && heartHistory === null) {
      setHeartHistoryMissing(true);
      document.getElementById("heart-history")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      document.querySelector(".assessment-card")?.scrollIntoView({ behavior: "smooth" });
    } else {
      onComplete();
    }
  };

  return (
    <form className="profile-form" onSubmit={(event) => event.preventDefault()}>
      <nav className="stepper" aria-label="Assessment progress">
        {STEPS.map((item, index) => (
          <button
            key={item.title}
            type="button"
            className={index === step ? "current" : index < step ? "complete" : ""}
            aria-current={index === step ? "step" : undefined}
            disabled={index > step}
            onClick={() => index <= step && setStep(index)}
          >
            <span className="step-number">{index < step ? "✓" : index + 1}</span>
            <span className="step-copy">
              <strong>{item.title}</strong>
              <small>{item.note}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="step-content">
        <div className="step-kicker">
          Step {step + 1} of {STEPS.length}
        </div>

        {step === 0 && (
          <section aria-labelledby="step-about">
            <h2 id="step-about">First, tell us about yourself</h2>
            <p className="step-intro">
              Risk changes with age, sex, and ancestry. Your information stays in your browser.
            </p>
            <fieldset className="heart-history" id="heart-history">
              <legend>
                Has a doctor ever told you that you had a heart attack, angina or coronary heart
                disease, a stroke, or heart failure?
              </legend>
              <p className="field-hint">
                The calculators are only accurate for people who haven’t had a heart event.
              </p>
              <div className="option-cards three-up">
                {HEART_HISTORY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={heartHistory === option.value}
                    onClick={() => {
                      onHeartHistoryChange(option.value);
                      setHeartHistoryMissing(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {heartHistoryMissing && (
                <p className="form-error" role="alert">
                  Please answer this question to continue.
                </p>
              )}
            </fieldset>

            {hadHeartEvent ? (
              <div className="ineligible" role="status">
                <p>
                  Because you’ve already experienced a heart event, calculating your heart risk
                  with these calculators will give you misleading results, as the calculators were
                  designed to be used before your first heart event. To monitor and reduce your
                  heart risk, please instead work with your doctor.
                </p>
                {canDonate && (
                  <p>
                    <strong>But you can still help our cause:</strong> South Asian heart data is
                    badly missing from US research. Please consider donating your (anonymized)
                    data towards better research for South Asian hearts.
                  </p>
                )}
                <div className="ineligible-actions">
                  {canDonate && (
                    <button type="button" className="primary-button" onClick={goNext}>
                      Donate my data <span aria-hidden="true">→</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="link-button"
                    aria-expanded={whyOpen}
                    onClick={() => setWhyOpen(!whyOpen)}
                  >
                    {whyOpen ? "Hide explanation" : "Learn why"}
                  </button>
                </div>
                {whyOpen && (
                  <div className="ineligible-why">
                    <p>
                      PCE, PREVENT, and QRISK3 were all built by following people who had never had
                      heart disease and counting who developed it over 10 years. They answer “how
                      likely is a first heart event?”
                    </p>
                    <p>
                      After a first event, risk is already known to be high, and the goal changes
                      to preventing another one. Doctors call this secondary prevention, and it
                      usually means treatment no matter what a calculator would say. Plugging your
                      numbers in anyway would understate your risk.
                    </p>
                  </div>
                )}
              </div>
            ) : (
            <div className="form-stack">
              <NumberField
                label="How old are you?"
                value={profile.age}
                min={25}
                max={84}
                onChange={(value) => set("age", value)}
              />
              <fieldset>
                <legend>What sex were you assigned at birth?</legend>
                <p className="field-hint">The calculators use sex-specific equations.</p>
                <div className="option-cards two-up">
                  {(["female", "male"] as const).map((sex) => (
                    <button
                      key={sex}
                      type="button"
                      aria-pressed={profile.sex === sex}
                      onClick={() => set("sex", sex)}
                    >
                      {sex === "female" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field">
                <span className="field-label">Which best describes your ancestry?</span>
                <span className="field-hint">
                  QRISK3 accounts for differences between South Asian groups.
                </span>
                <select
                  value={ancestry}
                  onChange={(event) => {
                    const option = ancestryOption(event.target.value as AncestryKey);
                    onAncestryChange(option.key);
                    set("ethnicity", option.ethnicity);
                  }}
                >
                  <optgroup label="South Asian">
                    {ANCESTRY_OPTIONS.filter((o) => o.southAsian).map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other ancestry">
                    {ANCESTRY_OPTIONS.filter((o) => !o.southAsian).map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </div>
            )}
            {!hadHeartEvent && (
            <details className="sample-profiles">
              <summary>Don’t have your numbers? Try an example</summary>
              <div className="chips">
                {EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    type="button"
                    className="chip"
                    onClick={() => {
                      onChange(example.profile);
                      onAncestryChange(defaultAncestryFor(example.profile.ethnicity));
                      onHeartHistoryChange("no");
                      setHeartHistoryMissing(false);
                    }}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </details>
            )}
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="step-numbers">
            <h2 id="step-numbers">Add your latest health numbers</h2>
            <p className="step-intro">
              Estimates are fine. You can find these on recent lab results or visit notes.
            </p>
            <div className="measurement-grid">
              <NumberField
                label="Systolic blood pressure"
                hint="The top number in your reading"
                unit="mmHg"
                value={profile.systolicBp}
                min={80}
                max={220}
                onChange={(value) => set("systolicBp", value)}
              />
              <NumberField
                label="Total cholesterol"
                hint="Usually between 100 and 400"
                unit="mg/dL"
                value={profile.totalCholesterol}
                min={100}
                max={400}
                onChange={(value) => set("totalCholesterol", value)}
              />
              <NumberField
                label="HDL cholesterol"
                hint="Sometimes called “good” cholesterol"
                unit="mg/dL"
                value={profile.hdlCholesterol}
                min={15}
                max={120}
                onChange={(value) => set("hdlCholesterol", value)}
              />
              <div className="bmi-field">
                <NumberField
                  label="Body mass index (BMI)"
                  hint="An estimate is okay"
                  value={profile.bmi}
                  min={15}
                  max={50}
                  step={0.5}
                  onChange={(value) => {
                    set("bmi", value);
                    setBmiCalculated(false);
                  }}
                />
                <button
                  type="button"
                  className="bmi-disclosure"
                  aria-expanded={bmiOpen}
                  aria-controls="bmi-calculator"
                  onClick={() => setBmiOpen(!bmiOpen)}
                >
                  {bmiOpen ? "Close BMI calculator" : "I don’t know my BMI"}
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d={bmiOpen ? "m2 8 4-4 4 4" : "m2 4 4 4 4-4"} />
                  </svg>
                </button>
                {bmiOpen && (
                  <div className="bmi-calculator" id="bmi-calculator">
                    <div className="bmi-calculator-head">
                      <strong>Calculate from height and weight</strong>
                      <div className="bmi-unit-toggle" role="group" aria-label="BMI units">
                        <button
                          type="button"
                          aria-pressed={bmiUnits === "us"}
                          onClick={() => {
                            setBmiUnits("us");
                            setBmiCalculated(false);
                          }}
                        >
                          ft / lb
                        </button>
                        <button
                          type="button"
                          aria-pressed={bmiUnits === "metric"}
                          onClick={() => {
                            setBmiUnits("metric");
                            setBmiCalculated(false);
                          }}
                        >
                          cm / kg
                        </button>
                      </div>
                    </div>
                    {bmiUnits === "us" ? (
                      <div className="bmi-inputs us">
                        <NumberField
                          label="Height"
                          unit="ft"
                          value={heightFeet}
                          min={3}
                          max={8}
                          onChange={(value) => {
                            setHeightFeet(value);
                            setBmiCalculated(false);
                          }}
                        />
                        <NumberField
                          label="Inches"
                          unit="in"
                          value={heightInches}
                          min={0}
                          max={11}
                          onChange={(value) => {
                            setHeightInches(value);
                            setBmiCalculated(false);
                          }}
                        />
                        <NumberField
                          label="Weight"
                          unit="lb"
                          value={weightPounds}
                          min={70}
                          max={700}
                          onChange={(value) => {
                            setWeightPounds(value);
                            setBmiCalculated(false);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="bmi-inputs">
                        <NumberField
                          label="Height"
                          unit="cm"
                          value={heightCm}
                          min={100}
                          max={250}
                          onChange={(value) => {
                            setHeightCm(value);
                            setBmiCalculated(false);
                          }}
                        />
                        <NumberField
                          label="Weight"
                          unit="kg"
                          value={weightKg}
                          min={30}
                          max={320}
                          step={0.5}
                          onChange={(value) => {
                            setWeightKg(value);
                            setBmiCalculated(false);
                          }}
                        />
                      </div>
                    )}
                    <div className="bmi-calculator-actions">
                      <button type="button" className="bmi-calculate" onClick={calculateBmi}>
                        Calculate and use BMI
                      </button>
                      {bmiCalculated && (
                        <span role="status">BMI updated to {profile.bmi.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="step-history">
            <h2 id="step-history">A little about your health</h2>
            <p className="step-intro">
              These factors help the calculators make a more personal estimate.
            </p>
            <div className="form-stack">
              <label className="field">
                <span className="field-label">Do you smoke?</span>
                <select
                  value={profile.smoking}
                  onChange={(event) => set("smoking", event.target.value as Profile["smoking"])}
                >
                  {SMOKING.map((smoking) => (
                    <option key={smoking} value={smoking}>
                      {SMOKING_LABELS[smoking]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Do you have diabetes?</span>
                <select
                  value={profile.diabetes}
                  onChange={(event) => set("diabetes", event.target.value as Profile["diabetes"])}
                >
                  <option value="none">No</option>
                  <option value="type1">Yes, type 1</option>
                  <option value="type2">Yes, type 2</option>
                </select>
              </label>
              <div className="choice-group">
                <Toggle
                  label="I take blood pressure medication"
                  checked={profile.onBpMeds}
                  onChange={(value) => set("onBpMeds", value)}
                />
                <Toggle
                  label="A parent or sibling had heart disease before age 60"
                  checked={profile.familyHistoryCvd}
                  onChange={(value) => set("familyHistoryCvd", value)}
                />
                <Toggle
                  label="I take a statin"
                  checked={profile.onStatin}
                  onChange={(value) => set("onStatin", value)}
                />
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="step-review">
            <h2 id="step-review">
              {hadHeartEvent ? "Check your answers" : "You’re ready to see your estimate"}
            </h2>
            <p className="step-intro">
              {hadHeartEvent
                ? "Take a quick look. Next come a few short research questions."
                : "Take a quick look. You can always come back and change these details."}
            </p>
            <dl className="review-grid">
              <div>
                <dt>About you</dt>
                <dd>
                  {profile.age}, {profile.sex}, {ancestryOption(ancestry).label}
                </dd>
                <button type="button" onClick={() => setStep(0)}>
                  Edit
                </button>
              </div>
              <div>
                <dt>Latest readings</dt>
                <dd>
                  BP {profile.systolicBp}; cholesterol {profile.totalCholesterol}/
                  {profile.hdlCholesterol}; BMI {profile.bmi}
                </dd>
                <button type="button" onClick={() => setStep(1)}>
                  Edit
                </button>
              </div>
              <div>
                <dt>Health history</dt>
                <dd>
                  {SMOKING_LABELS[profile.smoking]};{" "}
                  {profile.diabetes === "none" ? "no diabetes" : `${profile.diabetes} diabetes`}
                </dd>
                <button type="button" onClick={() => setStep(2)}>
                  Edit
                </button>
              </div>
            </dl>
            <details className="more">
              <summary>Add optional medical details</summary>
              <div className="optional-fields">
                <NumberField
                  label="Kidney function (eGFR)"
                  unit="mL/min"
                  value={profile.egfr}
                  min={15}
                  max={140}
                  onChange={(value) => set("egfr", value)}
                />
                <fieldset className="conditions">
                  <legend>Other conditions used by QRISK3</legend>
                  {CONDITIONS.filter(
                    (condition) => condition !== "erectileDysfunction" || profile.sex === "male",
                  ).map((condition) => (
                    <Toggle
                      key={condition}
                      label={CONDITION_LABELS[condition] ?? condition}
                      checked={profile[condition]}
                      onChange={(value) => set(condition, value)}
                    />
                  ))}
                </fieldset>
                <div className="measurement-grid">
                  <NumberField
                    label="BP readings averaged"
                    value={readings.bp}
                    min={1}
                    max={6}
                    onChange={(value) => onReadingsChange({ ...readings, bp: value })}
                  />
                  <NumberField
                    label="Cholesterol tests averaged"
                    value={readings.lipids}
                    min={1}
                    max={4}
                    onChange={(value) => onReadingsChange({ ...readings, lipids: value })}
                  />
                </div>
                <p className="hint">Averaging several readings shrinks measurement noise.</p>
              </div>
            </details>
            <div className="privacy-block">
              <div className="privacy-note">
                <span aria-hidden="true">✓</span>
                <p>
                  Your answers are calculated on this device. Nothing you enter is sent anywhere or
                  saved, and closing this page clears it.
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="form-actions">
          {step > 0 ? (
            <button type="button" className="secondary-button" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          {/* On step 1 the ineligible path has its own buttons. */}
          {!(step === 0 && hadHeartEvent) && (
            <button type="button" className="primary-button" onClick={goNext}>
              {step < STEPS.length - 1
                ? "Continue"
                : hadHeartEvent
                  ? "Continue to research questions"
                  : "See my heart risk"}
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
