import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the default example's three estimates and headline", () => {
    const html = renderToString(<App />);
    expect(html).toContain("How sure is your heart risk?");
    for (const value of ["4.0%", "2.4%", "7.5%"]) expect(html).toContain(value);
    expect(html).toContain("re-measurements");
    // ClinRisk requires its disclaimer wherever QRISK3 scores appear.
    expect(html).toContain("QRISK3 disclaimer");
  });
});
