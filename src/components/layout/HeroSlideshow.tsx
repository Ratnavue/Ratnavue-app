"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";

export interface SlideshowImage {
  src: string;
  alt: string;
  // See HeroSlide.focusX in lib/page-content.ts — undefined means centered.
  focusX?: number;
}

const SLIDE_MS = 5500;

export function HeroSlideshow({ images, className }: { images: SlideshowImage[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % images.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  // Subtle parallax: as the hero scrolls out of view, the imagery lags
  // slightly behind the page (a classic, understated luxury-site scroll
  // effect) rather than moving in lockstep with the text above it.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 90]);

  const active = images[index];

  return (
    <div ref={sectionRef} className={cn("absolute inset-0 overflow-hidden", className)}>
      <m.div className="absolute -inset-y-16 inset-x-0" style={{ y: parallaxY }}>
        <AnimatePresence initial={false}>
          <m.div
            key={active.src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <m.div
              className="absolute inset-0"
              initial={{ scale: 1 }}
              animate={{ scale: 1.08 }}
              transition={{ duration: SLIDE_MS / 1000 + 1.4, ease: "linear" }}
            >
              <Image
                src={active.src}
                alt={active.alt}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-cover opacity-70"
                style={{ objectPosition: `${active.focusX ?? 50}% 50%` }}
              />
            </m.div>
          </m.div>
        </AnimatePresence>
      </m.div>

      {images.length > 1 && (
        <div className="absolute bottom-8 right-5 z-10 flex gap-2 sm:right-8">
          {images.map((img, i) => (
            <button
              key={img.src}
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                i === index ? "w-6 bg-gold" : "w-1.5 bg-ivory/40 hover:bg-ivory/70"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
