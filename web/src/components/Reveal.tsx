import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface Props {
  /** What's always visible: the part that makes sense on its own. */
  children: ReactNode;
  /** Extra detail, shown on hover, keyboard focus, or a tap. */
  more: ReactNode;
  /** Label for the toggle button, read by screen readers and shown on touch screens. */
  label: string;
  className?: string;
  /** "over" covers the box; "below" drops down from it. */
  placement?: "over" | "below";
  as?: "div" | "li" | "article";
}

/**
 * A box that reveals more detail when you point at it.
 *
 * Hover only works with a mouse, so the same detail also opens from a small
 * button, which works with a tap, the keyboard, and screen readers.
 */
export function Reveal({ children, more, label, className = "", placement = "below", as = "div" }: Props) {
  const [open, setOpen] = useState(false);
  // Closing with the button while the mouse is still over the box beats hover.
  const [dismissed, setDismissed] = useState(false);
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  const Tag = as;

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <Tag
      ref={ref as never}
      className={`reveal reveal-${placement} ${open ? "is-open" : ""} ${dismissed ? "is-dismissed" : ""} ${className}`}
      onMouseLeave={() => setDismissed(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
      <button
        type="button"
        className="reveal-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setDismissed(open);
          setOpen(!open);
        }}
      >
        <span aria-hidden="true">{open ? "×" : "i"}</span>
        <span className="visually-hidden">{label}</span>
      </button>
      <div id={id} className="reveal-more" role="region" aria-label={label}>
        {more}
      </div>
    </Tag>
  );
}
