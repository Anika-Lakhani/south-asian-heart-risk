import type { Ethnicity } from "../models/profile";

/**
 * Ancestry as people describe it, mapped to the QRISK3 category used for scoring.
 * Recording the detail costs nothing extra and gives the donated dataset real South
 * Asian categories, which US health surveys don't have.
 */
export const ANCESTRY_OPTIONS = [
  { key: "indian", label: "Indian", ethnicity: "indian", southAsian: true },
  { key: "pakistani", label: "Pakistani", ethnicity: "pakistani", southAsian: true },
  { key: "bangladeshi", label: "Bangladeshi", ethnicity: "bangladeshi", southAsian: true },
  { key: "sri_lankan", label: "Sri Lankan", ethnicity: "other_asian", southAsian: true },
  { key: "nepali", label: "Nepali", ethnicity: "other_asian", southAsian: true },
  { key: "bhutanese", label: "Bhutanese", ethnicity: "other_asian", southAsian: true },
  { key: "maldivian", label: "Maldivian", ethnicity: "other_asian", southAsian: true },
  { key: "other_asian", label: "Other Asian", ethnicity: "other_asian", southAsian: false },
  { key: "chinese", label: "Chinese", ethnicity: "chinese", southAsian: false },
  { key: "white", label: "White", ethnicity: "white", southAsian: false },
  { key: "black_caribbean", label: "Black Caribbean", ethnicity: "black_caribbean", southAsian: false },
  {
    key: "black_african",
    label: "Black African or African American",
    ethnicity: "black_african",
    southAsian: false,
  },
  { key: "other", label: "Other", ethnicity: "other", southAsian: false },
] as const satisfies readonly {
  key: string;
  label: string;
  ethnicity: Ethnicity;
  southAsian: boolean;
}[];

export type AncestryKey = (typeof ANCESTRY_OPTIONS)[number]["key"];

export const ancestryOption = (key: AncestryKey) =>
  ANCESTRY_OPTIONS.find((option) => option.key === key) ?? ANCESTRY_OPTIONS[0];

/** The default ancestry detail for a QRISK3 category, e.g. when loading an example. */
export const defaultAncestryFor = (ethnicity: Ethnicity): AncestryKey =>
  ANCESTRY_OPTIONS.find((option) => option.ethnicity === ethnicity)?.key ?? "other";
