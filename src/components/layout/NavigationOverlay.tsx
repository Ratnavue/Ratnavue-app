"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Safety net in case `pathname` never actually changes after a click that
// looked like a navigation (the router cancels it, a client-side error
// stops it, etc.) — without this the bar would otherwise sit there forever.
const MAX_PENDING_MS = 4000;

/**
 * A thin top progress bar (the Linear/GitHub/YouTube convention) that starts
 * the instant an internal link is clicked and snaps to 100% once the
 * navigation lands. It is the ONLY navigation indicator layered over the
 * page: loading.tsx's PageLoader is the one full loading screen, and it only
 * appears on its own when a route is genuinely slow.
 *
 * This used to also blur the whole outgoing page and show a mobile "Getting
 * things ready for you..." pill. Combined with PageLoader (and the old
 * first-visit IntroLoader) that read as two or three different loading
 * screens in a row for one click — the "dual loading screen" report — so
 * both were removed.
 *
 * "Is a navigation starting" is detected from the triggering click itself
 * (a capture-phase document listener) rather than any router state, since
 * that's the one signal that's unambiguous and strictly precedes
 * everything else changing.
 */
export function NavigationOverlay() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  // Bumped only when a *new* navigation starts (never on finish) — the bar
  // is keyed on this, so each fresh navigation restarts animate-nav-progress
  // at 0%, while the pending -> justFinished transition within one
  // navigation stays on the same element so the "snap to 100%" can
  // transition from wherever the growth animation had gotten to.
  const [navId, setNavId] = useState(0);
  const [lastPathname, setLastPathname] = useState(pathname);

  // The new route has actually arrived — clear immediately (React's
  // "adjusting state when a prop changes" pattern, not an effect).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (pending) {
      setPending(false);
      setJustFinished(true);
    }
  }

  useEffect(() => {
    if (!justFinished) return;
    const t = setTimeout(() => setJustFinished(false), 300);
    return () => clearTimeout(t);
  }, [justFinished]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // External links, same-page anchors (#section), and links to the
      // page already showing never start the bar.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setPending(true);
      setNavId((n) => n + 1);
    }
    // Capture phase: fires before the click reaches <Link>'s own handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), MAX_PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return (
    // z-[60]: above the fixed Navbar (z-50) — it reports on the whole page.
    <div
      key={navId}
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-[60] h-[3px] bg-gradient-to-r from-gold-soft to-gold",
        pending && "animate-nav-progress opacity-100",
        justFinished && "w-full opacity-100 transition-[width,opacity] duration-300 ease-out",
        !pending && !justFinished && "opacity-0 transition-opacity duration-300",
      )}
    />
  );
}
