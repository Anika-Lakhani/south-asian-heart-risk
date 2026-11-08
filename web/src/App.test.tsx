// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import App from "./App";

beforeAll(() => {
  // jsdom lacks these browser APIs; the app only needs them to exist.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});

afterEach(cleanup);

const next = () => fireEvent.click(screen.getByRole("button", { name: /continue/i }));

describe("App", () => {
  it("opens on step 1 of the intake", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/understand your heart risk/i);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("walks through the four steps to the results", () => {
    render(<App />);
    next();
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    next();
    expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    next();
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /see my heart risk/i }));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("How sure is your heart risk?");
    const page = document.body.textContent ?? "";
    for (const value of ["4.0%", "2.4%", "7.5%"]) expect(page).toContain(value);
    expect(page).toContain("10 of 20 re-measurements");
    // ClinRisk requires its disclaimer wherever QRISK3 scores appear.
    expect(page).toContain("QRISK3 disclaimer");
  });

  it("loads an example profile from step 1", () => {
    render(<App />);
    fireEvent.click(screen.getByText(/try an example/i));
    fireEvent.click(screen.getByRole("button", { name: "White woman, 45" }));
    expect((screen.getByRole("spinbutton", { name: /how old are you/i }) as HTMLInputElement).value).toBe("45");
  });

  it("calculates BMI from height and weight", () => {
    render(<App />);
    next();
    fireEvent.click(screen.getByRole("button", { name: /i don.t know my bmi/i }));
    // Defaults are 5 ft 7 in and 165 lb, which is a BMI of 25.8.
    fireEvent.click(screen.getByRole("button", { name: /calculate and use bmi/i }));
    expect(screen.getByRole("status").textContent).toBe("BMI updated to 25.8");
  });

  it("returns to the Review step to edit answers, keeping them", () => {
    render(<App />);
    next();
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: /see my heart risk/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit my answers/i }));
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    expect(document.body.textContent).toContain("48, male, Pakistani");
  });

  it("makes no data-sharing offer, since nothing is ever sent", () => {
    render(<App />);
    next();
    next();
    next();
    expect(screen.queryAllByRole("checkbox", { name: /share/i })).toHaveLength(0);
    expect(document.body.textContent).toContain("Nothing you enter is sent anywhere");
  });
});
