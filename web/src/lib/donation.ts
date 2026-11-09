/**
 * Anonymous data donation: what's collected, how it's anonymized before it leaves
 * the browser, and how it's sent.
 *
 * Nothing is sent until someone explicitly opts in. Until a database is configured
 * (VITE_SUPABASE_URL and VITE_SUPABASE_KEY at build time), the whole flow is hidden
 * unless the page is opened with ?donate=preview, and in preview mode nothing is sent.
 */

import type { AncestryKey } from "./ancestry";
import type { Profile } from "../models/profile";

export type HeartHistory = "no" | "yes" | "unsure";

export const HEART_EVENTS = [
  { key: "heartAttack", label: "Heart attack" },
  { key: "coronaryDisease", label: "Angina or coronary heart disease" },
  { key: "stroke", label: "Stroke" },
  { key: "heartFailure", label: "Heart failure" },
] as const;
export type HeartEvent = (typeof HEART_EVENTS)[number]["key"];

export interface CoreAnswers {
  heartEvents: HeartEvent[];
  ageAtFirstEvent: number | null;
  bornInUs: "yes" | "no" | null;
  yearsInUs: number | null;
  numbersSource: "lab" | "home" | "clinic" | "estimate" | null;
  numbersRecency: "under6m" | "6to12m" | "1to2y" | "over2y" | null;
}

export interface SouthAsianAnswers {
  waist: number | null;
  waistUnit: "in" | "cm";
  otherTobacco: ("chewing" | "paan" | "gutka" | "bidi" | "hookah")[];
  diet: "vegetarian" | "mostly" | "nonvegetarian" | null;
  ldl: number | null;
  triglycerides: number | null;
  hba1c: number | null;
  lpa: number | null;
  familyRelatives: ("father" | "mother" | "brother" | "sister")[];
  familyEarliestAge: number | null;
}

export interface ContextAnswers {
  activeDays: number | null;
  drinksPerWeek: number | null;
  sleepHours: number | null;
  education: "highschool" | "somecollege" | "bachelors" | "graduate" | null;
  residence: "us_northeast" | "us_midwest" | "us_south" | "us_west" | "canada" | "uk" | "other" | null;
}

export type Module = "core" | "southAsian" | "context";

/** A random ID links one person's modules together. It isn't derived from anything about them. */
export const newDonationId = () => crypto.randomUUID();

/** Five-year age bands, so exact birth years never leave the browser. */
export function ageBand(age: number): string {
  const low = Math.floor(age / 5) * 5;
  return `${low}-${low + 4}`;
}

/** The anonymized intake answers that accompany the core module. */
export function intakeRecord(profile: Profile, ancestry: AncestryKey, heartHistory: HeartHistory) {
  return {
    ageBand: ageBand(profile.age),
    sex: profile.sex,
    ancestry,
    heartHistory,
    totalCholesterol: profile.totalCholesterol,
    hdlCholesterol: profile.hdlCholesterol,
    systolicBp: profile.systolicBp,
    onBpMeds: profile.onBpMeds,
    smoking: profile.smoking,
    diabetes: profile.diabetes,
    bmi: Math.round(profile.bmi),
    egfr: profile.egfr,
    onStatin: profile.onStatin,
    familyHistoryCvd: profile.familyHistoryCvd,
    atrialFibrillation: profile.atrialFibrillation,
    chronicKidneyDisease: profile.chronicKidneyDisease,
    rheumatoidArthritis: profile.rheumatoidArthritis,
    lupus: profile.lupus,
    migraine: profile.migraine,
    severeMentalIllness: profile.severeMentalIllness,
    atypicalAntipsychotics: profile.atypicalAntipsychotics,
    corticosteroids: profile.corticosteroids,
    erectileDysfunction: profile.erectileDysfunction,
  };
}

export type DonationMode = "off" | "preview" | "live";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// The publishable key is designed to be public: the database's rules only let it
// add rows and read the contributor count.
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
/** Tags each row with the build that sent it; "test" builds are excluded from releases. */
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? "dev";

/** Live once the database is configured; until then, only reachable with ?donate=preview. */
export function donationMode(
  search = typeof window === "undefined" ? "" : window.location.search,
): DonationMode {
  // Tests must never reach the real database, whatever env files exist locally.
  if (SUPABASE_URL && SUPABASE_KEY && import.meta.env.MODE !== "test") return "live";
  return new URLSearchParams(search).get("donate") === "preview" ? "preview" : "off";
}

const headers = () => ({
  apikey: SUPABASE_KEY ?? "",
  "Content-Type": "application/json",
});

/** Send one section. In preview mode this does nothing, and the UI says so. */
export async function submitModule(
  mode: DonationMode,
  donationId: string,
  module: Module,
  answers: object,
): Promise<void> {
  if (mode !== "live") return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/donations`, {
    method: "POST",
    // The website can't read rows back, so ask for no response body.
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify({
      donation_id: donationId,
      module,
      answers,
      app_version: APP_VERSION,
    }),
  });
  // 409 means this section was already saved (say, a double click), which is fine.
  if (!response.ok && response.status !== 409) {
    throw new Error(`Saving failed with HTTP ${response.status}`);
  }
}

/** How many people have donated, or null if unavailable. */
export async function contributorCount(): Promise<number | null> {
  if (donationMode("") !== "live") return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/contributor_count`, {
      method: "POST",
      headers: headers(),
      body: "{}",
    });
    return response.ok ? Number(await response.json()) : null;
  } catch {
    return null;
  }
}
