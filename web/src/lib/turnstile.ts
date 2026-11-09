/**
 * Cloudflare Turnstile: an invisible check that a donation comes from a person.
 *
 * The script loads only when a donation is being submitted, never during the risk
 * check. The widget stays hidden unless Cloudflare decides it needs a click.
 */

export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface Turnstile {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      execution: "execute";
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
    },
  ): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

function loadScript(): Promise<Turnstile> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load the bot check"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** A fresh single-use token. Each saved section needs its own. */
export async function turnstileToken(): Promise<string> {
  if (!TURNSTILE_SITE_KEY) throw new Error("Bot check isn't configured");
  const turnstile = await loadScript();
  const container = document.createElement("div");
  container.className = "turnstile-slot";
  document.body.appendChild(container);
  try {
    return await new Promise<string>((resolve, reject) => {
      const id = turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        execution: "execute",
        appearance: "interaction-only",
        callback: resolve,
        "error-callback": () => reject(new Error("Bot check failed")),
        "expired-callback": () => reject(new Error("Bot check expired")),
      });
      turnstile.execute(id);
    });
  } finally {
    container.remove();
  }
}
