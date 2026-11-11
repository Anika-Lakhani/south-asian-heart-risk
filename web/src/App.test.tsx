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

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

const next = () => fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
/** Answer step 1's heart-history question. */
const answer = (name: "No" | "Yes" | "Not sure") => click(name);
const text = () => document.body.textContent ?? "";

describe("App", () => {
  it("opens on step 1 of the intake", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/understand your heart risk/i);
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
  });

  it("compares you with people like you, and explains each calculator", async () => {
    render(<App />);
    answer("No");
    next();
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: /see my heart risk/i }));

    // Each calculator card explains itself, including by keyboard or tap.
    const how = screen.getByRole("button", { name: "How PCE works" });
    fireEvent.click(how);
    expect(how.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("South Asians are scored as white");

    fireEvent.click(screen.getByRole("checkbox", { name: /compare with people like you/i }));
    expect(await screen.findByText(/Comparing you with/)).toBeTruthy();
    // The default profile is a South Asian man, so the survey's limitation is stated.
    expect(document.body.textContent).toContain("Asian American men aged");
    expect(document.body.textContent).toContain("can't be narrowed to South Asians");
    // Peers are drawn on each calculator's own chart, not as extra rows.
    expect(document.querySelectorAll(".dot-row")).toHaveLength(3);
    expect(document.querySelectorAll(".dot-row.with-peers")).toHaveLength(3);
    expect(document.body.textContent).toMatch(/Higher than \d+ of 20 people like you/);
  });

  it("walks through the four steps to the results", () => {
    render(<App />);
    answer("No");
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
    answer("No");
    next();
    fireEvent.click(screen.getByRole("button", { name: /i don.t know my bmi/i }));
    // Defaults are 5 ft 7 in and 165 lb, which is a BMI of 25.8.
    fireEvent.click(screen.getByRole("button", { name: /calculate and use bmi/i }));
    expect(screen.getByRole("status").textContent).toBe("BMI updated to 25.8");
  });

  it("returns to the Review step to edit answers, keeping them", () => {
    render(<App />);
    answer("No");
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
    answer("No");
    next();
    next();
    next();
    expect(screen.queryAllByRole("checkbox", { name: /share/i })).toHaveLength(0);
    expect(document.body.textContent).toContain("Nothing you enter is sent anywhere");
  });

  it("requires the heart-history question before continuing", () => {
    render(<App />);
    next();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/please answer this question/i);
    answer("No");
    next();
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
  });

  it("offers more South Asian ancestries, scored with QRISK3's other-Asian terms", () => {
    render(<App />);
    const select = screen.getByRole("combobox", { name: /ancestry/i }) as HTMLSelectElement;
    const labels = [...select.options].map((o) => o.textContent);
    for (const group of ["Sri Lankan", "Nepali", "Bhutanese", "Maldivian"]) {
      expect(labels).toContain(group);
    }
    fireEvent.change(select, { target: { value: "sri_lankan" } });
    answer("No");
    next();
    next();
    next();
    expect(text()).toContain("48, male, Sri Lankan");
  });

  it("shows a note on the results when someone isn't sure about their heart history", () => {
    render(<App />);
    answer("Not sure");
    next();
    next();
    next();
    click(/see my heart risk/i);
    expect(screen.getByRole("note").textContent).toMatch(/these numbers don.t apply/i);
  });

  describe("after a heart event", () => {
    it("explains the calculators don't apply, and stops there while donations are off", () => {
      render(<App />);
      answer("Yes");
      expect(text()).toContain("designed to be used before your first heart event");
      expect(screen.queryByRole("button", { name: /donate my data/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^continue/i })).toBeNull();
      click(/learn why/i);
      expect(text()).toContain("secondary prevention");
    });

    it("can donate instead of getting a score (preview mode)", async () => {
      window.history.replaceState({}, "", "/?donate=preview");
      render(<App />);
      answer("Yes");
      click(/donate my data/i);
      next();
      next();
      expect(screen.queryByRole("button", { name: /see my heart risk/i })).toBeNull();
      click(/continue to research questions/i);

      // The story page, with consent required before starting.
      expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/data gap/i);
      expect(text()).toContain("Preview:");
      const start = screen.getByRole("button", { name: /start, about 1 minute/i }) as HTMLButtonElement;
      expect(start.disabled).toBe(true);
      fireEvent.click(screen.getByRole("checkbox", { name: /i agree to share/i }));
      expect(start.disabled).toBe(false);
      fireEvent.click(start);

      // Core questions include the heart-event details for this path.
      expect(text()).toContain("Which have you been told you had?");
      fireEvent.click(screen.getByRole("checkbox", { name: "Stroke" }));
      click("Submit");
      await screen.findByText("Thank you, your answers are in.");
      expect(text()).toContain("Preview mode: nothing was sent.");
      click(/no thanks/i);
      expect(text()).toContain("You shared 1 section");
      click(/back to the start/i);
      expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    });
  });

  describe("donating after a risk check", () => {
    const toResults = () => {
      render(<App />);
      answer("No");
      next();
      next();
      next();
      click(/see my heart risk/i);
    };

    it("hides the donation card while donations are off", () => {
      toResults();
      expect(screen.queryByRole("button", { name: /learn more and donate/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /donate data/i })).toBeNull();
    });

    it("walks through every optional section and back to the results (preview mode)", async () => {
      window.history.replaceState({}, "", "/?donate=preview");
      toResults();
      expect(text()).toContain("US health surveys lump all Asian Americans together");
      click(/learn more and donate/i);

      // The story uses this person's own calculator range.
      expect(text()).toContain("range from 2.4% to 7.5%");
      fireEvent.click(screen.getByRole("checkbox", { name: /i agree to share/i }));
      click(/start, about 1 minute/i);

      expect(text()).not.toContain("Which have you been told you had?");
      click("No");
      expect(text()).toContain("About how many years have you lived there?");
      click("Submit");
      fireEvent.click(await screen.findByRole("button", { name: /yes, add these questions/i }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Chewing tobacco" }));
      click("Submit");
      fireEvent.click(await screen.findByRole("button", { name: /yes, one more section/i }));
      click("Submit");
      await screen.findByText(/you shared 3 sections/i);
      click(/back to my results/i);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("How sure is your heart risk?");
    });

    it("can leave the story page without donating", () => {
      window.history.replaceState({}, "", "/?donate=preview");
      toResults();
      click(/donate data/i);
      click(/back to my results/i);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("How sure is your heart risk?");
    });
  });
});
