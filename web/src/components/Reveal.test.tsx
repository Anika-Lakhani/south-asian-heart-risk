// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Reveal } from "./Reveal";

afterEach(cleanup);

describe("Reveal", () => {
  it("opens with the button, so it works without a mouse, and closes with Escape", () => {
    render(
      <Reveal label="More about the thing" more={<p>The detail</p>}>
        <p>The headline</p>
      </Reveal>,
    );
    const button = screen.getByRole("button", { name: "More about the thing" });
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.closest(".reveal")!.classList.contains("is-open")).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes when you tap somewhere else", () => {
    render(
      <>
        <Reveal label="More" more={<p>The detail</p>}>
          <p>The headline</p>
        </Reveal>
        <p>Elsewhere</p>
      </>,
    );
    const button = screen.getByRole("button", { name: "More" });
    fireEvent.click(button);
    fireEvent.pointerDown(screen.getByText("Elsewhere"));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});
