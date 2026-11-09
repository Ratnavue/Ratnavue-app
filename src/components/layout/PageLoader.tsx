// A small faceted gem cluster above the wordmark — same shapes and sparkle
// motif as GemMinerScene (the 404/unauthorized illustration), scaled down.
// Reusing that established language rather than inventing a new loading
// spinner: a shopper browsing gemstones already has a stone catching the
// light as the site's visual signature for "look here."
function LoaderGem() {
  return (
    <svg viewBox="0 0 58 42" className="h-9 w-12" aria-hidden>
      <polygon points="27,10 35,23 27,38 19,23" className="fill-gold stroke-gold-soft" strokeWidth="1.2" />
      <polygon points="43,15 48,23 43,32 38,23" className="fill-gold-soft stroke-gold" strokeWidth="1" />
      <polygon points="12,17 16,23 12,30 8,23" className="fill-gold/70 stroke-gold-soft" strokeWidth="1" />
      {[
        { x: 27, y: 4, delay: "0s" },
        { x: 51, y: 22, delay: "0.6s" },
        { x: 4, y: 27, delay: "1.2s" },
      ].map((s, i) => (
        <path
          key={i}
          d={`M${s.x},${s.y - 3.5} L${s.x + 1},${s.y - 1} L${s.x + 3.5},${s.y} L${s.x + 1},${s.y + 1} L${s.x},${s.y + 3.5} L${s.x - 1},${s.y + 1} L${s.x - 3.5},${s.y} L${s.x - 1},${s.y - 1} Z`}
          className="animate-gem-sparkle fill-gold-soft"
          style={{ animationDelay: s.delay }}
        />
      ))}
    </svg>
  );
}

/**
 * Next.js mounts this automatically (as a Suspense fallback) any time a
 * route segment's data fetch takes long enough to be perceptible — no
 * manual wiring needed beyond the sibling loading.tsx files that render it.
 * Shares IntroLoader's visual language (serif wordmark, gold kicker, a thin
 * gold rule) since that's the animation moment already established as the
 * site's signature, but calibrated differently: IntroLoader is a one-shot,
 * multi-second reveal gated to play once per session; this can mount and
 * unmount at any moment depending on how long the real fetch takes.
 *
 * Deliberately a plain Server Component with a CSS keyframe animation, not
 * a motion/react client component: a loading indicator needs to paint the
 * instant it mounts, including in the exact "JS is still loading" moments
 * it exists to cover for — a JS-library-driven animation can itself be
 * delayed by that same slow load, which showed up as a real, confirmed
 * blank-charcoal flash under a throttled-network test.
 *
 * A flat, edge-to-edge charcoal fill read as the page abruptly going
 * blank rather than a deliberate moment, especially for a navigation that
 * only briefly interrupts a mid-scroll page — the radial glow behind the
 * mark and the gem cluster above it are both here to make this read as a
 * designed beat (the site's own "catching the light" motif) instead of a
 * blackout.
 *
 * The wordmark/kicker/rule glow-and-dim on an unending loop (rather than
 * just sitting there once loader-in's one-shot entrance finishes) so a
 * navigation that takes a couple of seconds still visibly reads as "still
 * working," not "stuck." Page content picks up the baton on the other end
 * — see .animate-page-in in MainWrapper — so the loader's exit and the new
 * page's arrival read as one continuous motion.
 */
export function PageLoader() {
  return (
    // fixed inset-0: covers the entire viewport — not just <main>'s box,
    // which left the footer (and, on routes with top padding, a strip of
    // page background) visible around the loader. z-40 sits *under* the
    // Navbar (z-50), so the nav stays visible and usable throughout;
    // pt-28 centres the mark in the space below it. This relies on <main>
    // not carrying a transform once its entrance animation ends (see
    // .animate-page-in's `transform: none` in globals.css) — a transformed
    // ancestor would otherwise become fixed's containing block.
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-ivory pb-16 pt-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(42% 48% at 50% 44%, color-mix(in srgb, var(--color-gold) 16%, transparent), transparent 72%)" }}
      />
      <div className="animate-loader-in relative flex flex-col items-center">
        <LoaderGem />
        <p className="animate-loader-text-glow mb-4 mt-3 text-[10px] uppercase tracking-[0.35em] text-gold-deep">
          Ceylon Gemstones
        </p>
        {/* A <p>, not an <h1>: this fallback is streamed into every page's
            HTML, so an <h1> here gave every page two top-level headings. */}
        <p className="animate-loader-text-glow font-serif text-3xl tracking-[0.12em] text-charcoal sm:text-4xl">
          RATNAVUE
        </p>
        <div className="animate-loader-line-glow mt-6 h-px w-32 bg-gold sm:w-40" />
      </div>
    </div>
  );
}
