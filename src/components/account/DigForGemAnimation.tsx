"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Pickaxe, Gem, Sparkles } from "lucide-react";
import { playGemDigAction } from "@/actions/gem-dig";
import { Button } from "@/components/ui/Button";

type Phase = "ready" | "digging" | "revealed" | "error";

const PUNCHLINES = [
  "Somewhere in here is a little something extra.",
  "One good swing could turn up a surprise.",
  "Ratnavue's own gemologists dug for years for less.",
];

// Four strike points along the swing (see the pickaxe's own rotate
// keyframes below) — a small dust burst fires at each one, staggered to
// land right as the pickaxe "hits".
const DUST_DELAYS = [0.32, 0.68, 1.02];

export function DigForGemAnimation({ orderId, min, max }: { orderId: string; min: number; max: number }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [points, setPoints] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [punchline] = useState(() => PUNCHLINES[Math.floor(Math.random() * PUNCHLINES.length)]);
  // A single-point "range" (a very small order's profit rounds both ends
  // down to the same 1-point floor) reads as broken copy — "between 1 and
  // 1 points" isn't actually a range. Said plainly instead.
  const isRange = min !== max;

  async function handleDig() {
    setPhase("digging");
    setError(null);
    const [result] = await Promise.all([
      playGemDigAction(orderId),
      new Promise((r) => setTimeout(r, 1400)), // let the swing animation actually play
    ]);
    if (!result.ok) {
      setError(result.error);
      setPhase("error");
      return;
    }
    setPoints(result.points);
    setPhase("revealed");
  }

  return (
    <motion.div
      className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-b from-ivory-soft to-surface px-6 py-10 text-center"
      animate={phase === "digging" ? { x: [0, -2, 2, -1.5, 1.5, 0] } : { x: 0 }}
      transition={phase === "digging" ? { duration: 1.4, times: [0, 0.3, 0.45, 0.65, 0.8, 1] } : undefined}
    >
      {/* Reveal-only radial glow burst behind the gem — a quiet flash of
          light rather than anything cartoonish, fitting a fine-jewelry
          page rather than a game. */}
      <AnimatePresence>
        {phase === "revealed" && (
          <motion.div
            key="glow"
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.55, 0], scale: 1.6 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-16 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/40 blur-2xl"
          />
        )}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence mode="wait">
          {phase !== "revealed" ? (
            <motion.div key="pickaxe" exit={{ opacity: 0, scale: 0.8 }} className="relative">
              <motion.div
                animate={
                  phase === "digging"
                    ? { rotate: [0, -42, 14, -38, 10, -30, 0], y: [0, 5, -3, 5, -2, 4, 0] }
                    : { rotate: [0, -6, 0, 4, 0], y: [0, -3, 0, -2, 0] }
                }
                transition={
                  phase === "digging"
                    ? { duration: 1.4, ease: "easeInOut" }
                    : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
                }
              >
                <Pickaxe size={64} strokeWidth={1.25} className="text-gold-deep" />
              </motion.div>

              {/* Dust burst at each "impact" of the swing. */}
              {phase === "digging" &&
                DUST_DELAYS.map((delay, i) => (
                  <motion.div
                    key={i}
                    className="absolute bottom-1 left-1/2 flex gap-1.5"
                    initial={{ opacity: 0, x: "-50%" }}
                    animate={{ opacity: [0, 1, 0], y: [0, -10] }}
                    transition={{ delay, duration: 0.35, ease: "easeOut" }}
                  >
                    {[-6, 0, 6].map((dx) => (
                      <span key={dx} className="block h-1.5 w-1.5 rounded-full bg-gold/70" style={{ transform: `translateX(${dx}px)` }} />
                    ))}
                  </motion.div>
                ))}
            </motion.div>
          ) : (
            <motion.div
              key="gem"
              initial={{ opacity: 0, scale: 0.4, rotate: -20, y: 14 }}
              animate={{ opacity: 1, scale: 1, rotate: [0, -8, 6, 0], y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 13, rotate: { duration: 0.6, delay: 0.25 } }}
              className="relative"
            >
              {[
                { size: 22, className: "-right-3 -top-2 text-gold", delay: 0.15 },
                { size: 14, className: "-left-4 bottom-1 text-gold/70", delay: 0.3 },
                { size: 16, className: "-right-5 bottom-2 text-gold-deep/80", delay: 0.42 },
                { size: 11, className: "left-1 -top-4 text-gold/80", delay: 0.55 },
              ].map(({ size, className, delay }, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: [0, 1, 0.9], scale: 1 }}
                  transition={{ delay, duration: 0.4 }}
                  className={`absolute ${className}`}
                >
                  <Sparkles size={size} strokeWidth={1.5} />
                </motion.span>
              ))}
              <Gem size={64} strokeWidth={1.25} className="text-gold-deep" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-6 min-h-[4.5rem]">
        {phase === "ready" && (
          <>
            <p className="font-serif text-xl text-charcoal">Dig for a bonus gem</p>
            <p className="mt-2 text-sm text-charcoal/65">{punchline}</p>
            <p className="mt-1 text-xs text-charcoal/65">
              {isRange
                ? <>You&apos;ll turn up somewhere between {min.toLocaleString()} and {max.toLocaleString()} points.</>
                : <>You&apos;ll turn up {min.toLocaleString()} point{min === 1 ? "" : "s"}.</>}
            </p>
          </>
        )}
        {phase === "digging" && <p className="font-serif text-xl text-charcoal">Digging...</p>}
        {phase === "revealed" && points != null && (
          <>
            <motion.p
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.2 }}
              className="font-serif text-2xl text-gold-deep"
            >
              +{points.toLocaleString()} points
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-2 text-sm text-charcoal/65">
              Added to your rewards balance.
            </motion.p>
          </>
        )}
        {phase === "error" && <p className="text-sm text-red-700">{error}</p>}
      </div>

      {phase === "ready" && (
        <Button type="button" variant="gold" size="lg" className="mt-4" onClick={handleDig}>
          Good luck
        </Button>
      )}

      {phase === "revealed" && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-6 max-w-sm text-xs text-charcoal/65"
        >
          This is a one-time bonus for this order. Ratnavue may change or remove the rewards program at any time.
        </motion.p>
      )}
    </motion.div>
  );
}
