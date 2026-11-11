import { describe, expect, it } from "vitest";

import { BASE_PROFILE } from "./examples";
import { MIN_PEERS, findPeers, loadPeers, scorePeers, summarizeWeighted, type PeerData } from "./peers";

/** A tiny synthetic dataset: `n` people of one source and group, all aged 50. */
function fake(spec: { src: "nhanes" | "donated"; group: string; n: number; female?: boolean }[]): PeerData {
  const groups = [...new Set(spec.map((s) => s.group))];
  const columns = Object.fromEntries(
    ["src", "female", "age", "group", "weight", "sbp", "tc", "hdl", "smoking", "diabetes", "bpMeds", "statin", "bmi", "egfr"].map(
      (k) => [k, [] as number[]],
    ),
  ) as PeerData["columns"];
  for (const s of spec) {
    for (let i = 0; i < s.n; i++) {
      const row = {
        src: s.src === "nhanes" ? 0 : 1,
        female: Number(s.female ?? false),
        age: 50,
        group: groups.indexOf(s.group),
        weight: 1,
        sbp: 120 + i,
        tc: 200,
        hdl: 50,
        smoking: 0,
        diabetes: 0,
        bpMeds: 0,
        statin: 0,
        bmi: 25,
        egfr: 90,
      };
      for (const [k, v] of Object.entries(row)) columns[k as keyof typeof columns].push(v);
    }
  }
  return { groups, sources: ["nhanes", "donated"], smoking: [], diabetes: [], columns };
}

const man50 = { age: 50, female: false } as const;

describe("findPeers", () => {
  it("uses NHANES Asian Americans for South Asians until enough donors exist, and says why", () => {
    const data = fake([
      { src: "nhanes", group: "asian", n: 40 },
      { src: "donated", group: "pakistani", n: MIN_PEERS - 1 },
    ]);
    const group = findPeers(data, { ...man50, ancestry: "pakistani" });
    expect(group.source).toBe("nhanes");
    expect(group.label).toBe("Asian American men aged 40–60");
    expect(group.note).toMatch(/can't be narrowed to South Asians/);
  });

  it("switches to donors of the same ancestry once there are enough", () => {
    const data = fake([
      { src: "nhanes", group: "asian", n: 40 },
      { src: "donated", group: "pakistani", n: MIN_PEERS },
    ]);
    const group = findPeers(data, { ...man50, ancestry: "pakistani" });
    expect(group).toMatchObject({ source: "donated", label: "Pakistani men aged 40–60", note: null });
  });

  it("falls back to all South Asian donors, then to everyone", () => {
    const data = fake([
      { src: "nhanes", group: "white", n: 40 },
      { src: "donated", group: "indian", n: 20 },
      { src: "donated", group: "nepali", n: 20 },
    ]);
    expect(findPeers(data, { ...man50, ancestry: "nepali" }).label).toBe("South Asian men aged 40–60");
    const black = findPeers(data, { ...man50, ancestry: "black_african" });
    expect(black.label).toBe("American men aged 40–60");
    expect(black.note).toMatch(/Too few/);
  });

  it("only includes the same sex", () => {
    const data = fake([
      { src: "nhanes", group: "white", n: 40, female: true },
      { src: "nhanes", group: "white", n: 35 },
    ]);
    expect(findPeers(data, { ...man50, ancestry: "white" }).rows).toHaveLength(35);
  });
});

describe("summarizeWeighted", () => {
  it("matches plain quantiles when weights are equal", () => {
    const s = summarizeWeighted([0.01, 0.02, 0.03, 0.04], [1, 1, 1, 1]);
    expect(s.shareBelow(0.025)).toBe(0.5);
    expect(s.quantile(0.5)).toBe(0.02);
    expect(s.shareAtOrAbove(0.03)).toBe(0.5);
  });

  it("lets heavier-weighted people count for more", () => {
    const s = summarizeWeighted([0.01, 0.1], [9, 1]);
    expect(s.shareBelow(0.05)).toBeCloseTo(0.9);
    expect(s.quantile(0.5)).toBe(0.01);
  });
});

describe("the real comparison data", () => {
  it("has enough Asian American peers for a typical South Asian user, and scores them", async () => {
    const data = await loadPeers();
    const group = findPeers(data, { age: 48, female: false, ancestry: "indian" });
    expect(group.rows.length).toBeGreaterThan(100);
    const scored = scorePeers(data, group.rows, BASE_PROFILE);
    for (const summary of Object.values(scored)) {
      const [low, high] = summary.interval(0.9);
      expect(0 < low && low < high && high < 1).toBe(true);
    }
  });
});
