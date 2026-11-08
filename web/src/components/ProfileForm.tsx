import { CONDITIONS, ETHNICITIES, SMOKING, type Profile } from "../models/profile";
import {
  CONDITION_LABELS,
  ETHNICITY_LABELS,
  EXAMPLES,
  SMOKING_LABELS,
} from "../lib/examples";

interface Props {
  profile: Profile;
  onChange: (profile: Profile) => void;
  readings: { bp: number; lipids: number };
  onReadingsChange: (readings: { bp: number; lipids: number }) => void;
}

function NumberField(props: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const { label, unit, value, min, max, step = 1, onChange } = props;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="number-input">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.valueAsNumber)}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>{props.label}</span>
    </label>
  );
}

export function ProfileForm({ profile, onChange, readings, onReadingsChange }: Props) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });
  const activeExample = EXAMPLES.find(
    (e) => JSON.stringify(e.profile) === JSON.stringify(profile),
  )?.label;

  return (
    <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="examples">
        <legend>Try an example</legend>
        <div className="chips">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="chip"
              aria-pressed={activeExample === example.label}
              onClick={() => onChange(example.profile)}
            >
              {example.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field-grid">
        <NumberField label="Age" value={profile.age} min={25} max={84} onChange={(v) => set("age", v)} />
        <div className="field">
          <span className="field-label" id="sex-label">
            Sex
          </span>
          <div className="segmented small" role="group" aria-labelledby="sex-label">
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
        </div>
      </div>

      <label className="field">
        <span className="field-label">Ancestry</span>
        <select
          value={profile.ethnicity}
          onChange={(e) => set("ethnicity", e.target.value as Profile["ethnicity"])}
        >
          {ETHNICITIES.map((e) => (
            <option key={e} value={e}>
              {ETHNICITY_LABELS[e]}
            </option>
          ))}
        </select>
      </label>

      <div className="field-grid">
        <NumberField
          label="Total cholesterol"
          unit="mg/dL"
          value={profile.totalCholesterol}
          min={100}
          max={400}
          onChange={(v) => set("totalCholesterol", v)}
        />
        <NumberField
          label="HDL cholesterol"
          unit="mg/dL"
          value={profile.hdlCholesterol}
          min={15}
          max={120}
          onChange={(v) => set("hdlCholesterol", v)}
        />
      </div>
      <div className="field-grid">
        <NumberField
          label="Systolic BP"
          unit="mmHg"
          value={profile.systolicBp}
          min={80}
          max={220}
          onChange={(v) => set("systolicBp", v)}
        />
        <NumberField
          label="BMI"
          value={profile.bmi}
          min={15}
          max={50}
          step={0.5}
          onChange={(v) => set("bmi", v)}
        />
      </div>

      <div className="field-grid smoking-row">
        <label className="field">
          <span className="field-label">Smoking</span>
          <select
            value={profile.smoking}
            onChange={(e) => set("smoking", e.target.value as Profile["smoking"])}
          >
            {SMOKING.map((s) => (
              <option key={s} value={s}>
                {SMOKING_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Diabetes</span>
          <select
            value={profile.diabetes}
            onChange={(e) => set("diabetes", e.target.value as Profile["diabetes"])}
          >
            <option value="none">No</option>
            <option value="type1">Type 1</option>
            <option value="type2">Type 2</option>
          </select>
        </label>
      </div>

      <Toggle
        label="Taking blood pressure medication"
        checked={profile.onBpMeds}
        onChange={(v) => set("onBpMeds", v)}
      />
      <Toggle
        label="Parent or sibling had heart disease before 60"
        checked={profile.familyHistoryCvd}
        onChange={(v) => set("familyHistoryCvd", v)}
      />

      <details className="more">
        <summary>More details</summary>
        <Toggle label="Taking a statin" checked={profile.onStatin} onChange={(v) => set("onStatin", v)} />
        <NumberField
          label="Kidney function (eGFR)"
          unit="mL/min"
          value={profile.egfr}
          min={15}
          max={140}
          onChange={(v) => set("egfr", v)}
        />
        <fieldset className="conditions">
          <legend className="field-label">Other conditions (used by QRISK3)</legend>
          {CONDITIONS.filter((c) => c !== "erectileDysfunction" || profile.sex === "male").map(
            (condition) => (
              <Toggle
                key={condition}
                label={CONDITION_LABELS[condition] ?? condition}
                checked={profile[condition]}
                onChange={(v) => set(condition, v)}
              />
            ),
          )}
        </fieldset>
        <div className="field-grid">
          <NumberField
            label="BP readings averaged"
            value={readings.bp}
            min={1}
            max={6}
            onChange={(v) => onReadingsChange({ ...readings, bp: v })}
          />
          <NumberField
            label="Cholesterol tests averaged"
            value={readings.lipids}
            min={1}
            max={4}
            onChange={(v) => onReadingsChange({ ...readings, lipids: v })}
          />
        </div>
        <p className="hint">Averaging several readings shrinks measurement noise.</p>
      </details>
    </form>
  );
}
