/**
 * "People like you": the same calculators run on real people of your sex, within
 * 10 years of your age, and your race or ancestry, so you can see where you fall.
 *
 * Built by scripts/build_peers.py from NHANES (measured blood pressure and
 * cholesterol, but all Asian Americans as one group) plus this project's own
 * published donation releases, which record South Asian ancestry. Donors are
 * preferred as soon as there are enough of them to compare against.
 */

import { ancestryOption, type AncestryKey } from "./ancestry";
import { CONDITIONS, SMOKING, type Diabetes, type Profile } from "../models/profile";
import { MODELS, type ModelKey } from "../models/scoring";

export interface PeerData {
  groups: string[];
  sources: ("nhanes" | "donated")[];
  smoking: string[];
  diabetes: string[];
  columns: Record<
    | "src"
    | "female"
    | "age"
    | "group"
    | "weight"
    | "sbp"
    | "tc"
    | "hdl"
    | "smoking"
    | "diabetes"
    | "bpMeds"
    | "statin"
    | "bmi"
    | "egfr",
    number[]
  >;
}

/** Fewer people than this and the comparison is too noisy (and too identifying). */
export const MIN_PEERS = 30;
export const AGE_WINDOW = 10;
const DIABETES: Diabetes[] = ["none", "type1", "type2"];

/** Loaded only when someone turns the comparison on (about 110 KB compressed). */
export const loadPeers = async (): Promise<PeerData> =>
  (await import("../data/peers.json")).default as PeerData;

export interface PeerGroup {
  /** e.g. "Asian American men aged 38–58" */
  label: string;
  source: "nhanes" | "donated";
  /** Row indices into the data. */
  rows: number[];
  /** Why this group isn't as specific as the person asked for, if it isn't. */
  note: string | null;
}

/** NHANES race group for each ancestry; null means compare with everyone. */
const NHANES_GROUP: Record<AncestryKey, { key: string; label: string } | null> = {
  indian: { key: "asian", label: "Asian American" },
  pakistani: { key: "asian", label: "Asian American" },
  bangladeshi: { key: "asian", label: "Asian American" },
  sri_lankan: { key: "asian", label: "Asian American" },
  nepali: { key: "asian", label: "Asian American" },
  bhutanese: { key: "asian", label: "Asian American" },
  maldivian: { key: "asian", label: "Asian American" },
  other_asian: { key: "asian", label: "Asian American" },
  chinese: { key: "asian", label: "Asian American" },
  white: { key: "white", label: "white American" },
  black_caribbean: { key: "black", label: "Black American" },
  black_african: { key: "black", label: "Black American" },
  other: null,
};

const SOUTH_ASIAN_KEYS = new Set<string>(
  ["indian", "pakistani", "bangladeshi", "sri_lankan", "nepali", "bhutanese", "maldivian"],
);

export function findPeers(
  data: PeerData,
  person: { age: number; female: boolean; ancestry: AncestryKey },
): PeerGroup {
  const c = data.columns;
  const low = Math.max(25, person.age - AGE_WINDOW);
  const high = person.age + AGE_WINDOW;
  const ages = high >= 80 ? `${low} and over` : `${low}–${high}`;
  const people = person.female ? "women" : "men";
  const similar = (i: number) =>
    c.female[i] === Number(person.female) && Math.abs(c.age[i]! - person.age) <= AGE_WINDOW;
  const select = (keep: (i: number) => boolean) =>
    c.age.flatMap((_, i) => (similar(i) && keep(i) ? [i] : []));
  const isSource = (i: number, source: string) => data.sources[c.src[i]!] === source;
  const groupOf = (i: number) => data.groups[c.group[i]!];

  const option = ancestryOption(person.ancestry);
  const southAsian = SOUTH_ASIAN_KEYS.has(person.ancestry);
  const notSeparated =
    "US health surveys record all Asian Americans as one group, so this can't be narrowed to South Asians yet. It will switch to South Asian donors once enough have shared their data.";

  if (southAsian) {
    const same = select((i) => isSource(i, "donated") && groupOf(i) === person.ancestry);
    if (same.length >= MIN_PEERS) {
      return { label: `${option.label} ${people} aged ${ages}`, source: "donated", rows: same, note: null };
    }
    const anySouthAsian = select((i) => isSource(i, "donated") && SOUTH_ASIAN_KEYS.has(groupOf(i)!));
    if (anySouthAsian.length >= MIN_PEERS) {
      return {
        label: `South Asian ${people} aged ${ages}`,
        source: "donated",
        rows: anySouthAsian,
        note: `Not enough ${option.label} donors yet to compare with ${option.label} people alone.`,
      };
    }
  }

  const race = NHANES_GROUP[person.ancestry];
  if (race) {
    const rows = select((i) => isSource(i, "nhanes") && groupOf(i) === race.key);
    if (rows.length >= MIN_PEERS) {
      return {
        label: `${race.label} ${people} aged ${ages}`,
        source: "nhanes",
        rows,
        note: southAsian ? notSeparated : null,
      };
    }
  }
  const everyone = select((i) => isSource(i, "nhanes"));
  return {
    label: `American ${people} aged ${ages}`,
    source: "nhanes",
    rows: everyone,
    note: race ? `Too few ${race.label} ${people} this age in the survey, so this includes everyone.` : null,
  };
}

/**
 * Score each peer with every calculator. Peers keep your ancestry setting, so the
 * comparison is about measured health (blood pressure, cholesterol, smoking,
 * diabetes, and so on) rather than the ancestry term itself.
 */
export function scorePeers(data: PeerData, rows: number[], you: Profile): Record<ModelKey, PeerSummary> {
  const c = data.columns;
  const risks = Object.fromEntries(MODELS.map((m) => [m.key, [] as number[]])) as Record<ModelKey, number[]>;
  const weights = rows.map((i) => c.weight[i]!);
  const noConditions = Object.fromEntries(CONDITIONS.map((k) => [k, false]));
  for (const i of rows) {
    const peer: Profile = {
      ...you,
      ...noConditions,
      age: c.age[i]!,
      sex: c.female[i] ? "female" : "male",
      systolicBp: c.sbp[i]!,
      totalCholesterol: c.tc[i]!,
      hdlCholesterol: Math.min(c.hdl[i]!, c.tc[i]! - 1),
      smoking: SMOKING[c.smoking[i]!] ?? "never",
      diabetes: DIABETES[c.diabetes[i]!] ?? "none",
      onBpMeds: c.bpMeds[i] === 1,
      onStatin: c.statin[i] === 1,
      bmi: c.bmi[i]!,
      egfr: c.egfr[i]!,
      chronicKidneyDisease: c.egfr[i]! < 60,
      familyHistoryCvd: false,
      systolicBpSd: null,
      townsend: 0,
    };
    for (const model of MODELS) {
      risks[model.key].push(model.fn(peer, peer));
    }
  }
  return Object.fromEntries(
    MODELS.map((m) => [m.key, summarizeWeighted(risks[m.key], weights)]),
  ) as Record<ModelKey, PeerSummary>;
}

export interface PeerSummary {
  n: number;
  quantile: (q: number) => number;
  interval: (level: number) => [number, number];
  /** Evenly spaced quantiles: each dot stands for an equal share of peers. */
  quantileDots: (nDots: number) => number[];
  /** Share of peers (by survey weight) with a lower estimate than `risk`. */
  shareBelow: (risk: number) => number;
  shareAtOrAbove: (threshold: number) => number;
}

/** Quantiles that respect survey weights, so the group mirrors the US population. */
export function summarizeWeighted(values: number[], weights: number[]): PeerSummary {
  const order = values.map((_, i) => i).sort((a, b) => values[a]! - values[b]!);
  const sorted = order.map((i) => values[i]!);
  const w = order.map((i) => weights[i]!);
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const cumulative: number[] = [];
  w.reduce((sum, x, i) => (cumulative[i] = sum + x), 0);

  const quantile = (q: number) => {
    const target = q * total;
    // The first person whose cumulative weight reaches the target.
    for (let i = 0; i < sorted.length; i++) {
      if (cumulative[i]! >= target - 1e-9) return sorted[i]!;
    }
    return sorted.at(-1) ?? NaN;
  };
  const shareWhere = (keep: (v: number) => boolean) =>
    sorted.reduce((sum, v, i) => sum + (keep(v) ? w[i]! : 0), 0) / total;

  return {
    n: values.length,
    quantile,
    interval: (level) => {
      const tail = (1 - level) / 2;
      return [quantile(tail), quantile(1 - tail)];
    },
    quantileDots: (nDots) => Array.from({ length: nDots }, (_, k) => quantile((k + 0.5) / nDots)),
    shareBelow: (risk) => shareWhere((v) => v < risk),
    shareAtOrAbove: (threshold) => shareWhere((v) => v >= threshold),
  };
}
