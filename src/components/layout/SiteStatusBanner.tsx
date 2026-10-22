"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, MessageSquarePlus } from "lucide-react";
import { submitSiteFeedback } from "@/actions/site-banner";

const DISMISS_KEY = "site-status-banner-dismissed";

/**
 * A dismissible strip above the Navbar announcing a market-wide status
 * (e.g. "international orders are paused while we switch up payment
 * options") with an inline "Share feedback" widget — browsing, search and
 * checkout all stay exactly as they were; this never gates anything, see
 * SiteBannerSettings' own schema comment. Dismissal is per-browser-session
 * (sessionStorage), not permanent, so the announcement still greets a new
 * visit later.
 *
 * Fixed at the very top of the viewport (not in normal document flow) so
 * it floats above the Navbar rather than being hidden behind it — the
 * Navbar is itself `fixed top-0` for the transparent-over-hero treatment
 * on full-bleed pages, so a banner in ordinary flow would sit at the top
 * of the document while the Navbar visually paints over it at the real
 * viewport top. Its rendered height is published as the `--site-banner-h`
 * CSS variable (via ResizeObserver, since the message can wrap to more
 * lines on a narrow screen, or the feedback form can open/close) which
 * Navbar's own `top` and MainWrapper's `<main>` margin both read, so the
 * rest of the page shifts down to clear it exactly, and back to 0 the
 * moment it's dismissed or not rendered at all.
 */
export function SiteStatusBanner({ message }: { message: string }) {
  // Starts false so server and client render the same thing on hydration;
  // the real (session-local) dismissed state, if any, is applied right
  // after mount — same "match SSR, then correct from a browser-only API"
  // shape as BackToTop's own scroll-position effect.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deferring past hydration on purpose, see useCatalogView's own comment on this exact rule/pattern.
      if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
    } catch {
      // Private browsing / blocked storage — nothing to restore.
    }
  }, []);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      document.documentElement.style.setProperty("--site-banner-h", "0px");
      return;
    }
    const publishHeight = () => document.documentElement.style.setProperty("--site-banner-h", `${el.offsetHeight}px`);
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--site-banner-h", "0px");
    };
  }, [dismissed]);

  if (dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private browsing / blocked storage — the banner just can't
      // remember the dismissal for the rest of the session, no big deal.
    }
    setDismissed(true);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitSiteFeedback(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSent(true);
      setFeedbackText("");
    });
  }

  return (
    <div ref={containerRef} className="fixed inset-x-0 top-0 z-[51] bg-charcoal px-4 py-2.5 text-ivory">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 pr-8 text-center text-sm">
        <p>{message}</p>
        {!feedbackOpen && (
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-gold underline-offset-4 hover:underline"
          >
            <MessageSquarePlus size={13} /> Share feedback
          </button>
        )}
      </div>

      {feedbackOpen && !sent && (
        <form action={handleSubmit} className="mx-auto mt-2 flex max-w-md flex-col gap-2 pr-8">
          <textarea
            name="message"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            required
            maxLength={2000}
            rows={2}
            placeholder="What would make this better for you?"
            className="w-full rounded-md border border-ivory/30 bg-charcoal px-3 py-1.5 text-sm text-ivory placeholder:text-ivory/50 focus:border-gold focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email (optional)"
              className="min-w-0 flex-1 rounded-md border border-ivory/30 bg-charcoal px-3 py-1.5 text-sm text-ivory placeholder:text-ivory/50 focus:border-gold focus:outline-none"
            />
            <button type="submit" disabled={pending} className="shrink-0 rounded-full bg-gold px-4 py-1.5 text-xs font-medium text-charcoal hover:bg-gold/90 disabled:opacity-60">
              {pending ? "Sending..." : "Send"}
            </button>
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
        </form>
      )}

      {sent && <p className="mt-2 text-center text-xs text-gold">Thanks for the feedback — we read every one of these.</p>}

      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute right-3 top-2.5 text-ivory/70 hover:text-ivory">
        <X size={16} />
      </button>
    </div>
  );
}
