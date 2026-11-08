export const pct = (risk: number, digits = 1) => `${(risk * 100).toFixed(digits)}%`;

/** "7.5%" for thresholds, without a trailing ".0". */
export const thresholdLabel = (t: number) => `${+(t * 100).toFixed(1)}%`;

const FIELD_NAMES: Record<string, string> = {
  age: "age",
  totalCholesterol: "total cholesterol",
  hdlCholesterol: "HDL",
  systolicBp: "blood pressure",
  bmi: "BMI",
  egfr: "kidney function",
  cholesterolRatio: "cholesterol ratio",
};

export const fieldName = (key: string) => FIELD_NAMES[key] ?? key;

export const listJoin = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
