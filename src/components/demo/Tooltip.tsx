// Narration caption. Pinned to a band just above the playback bar rather than
// glued to the pointer: the fake cursor points at a real element (a policy
// card, a clock-board table, a greyed-out fraud button), and a caption that
// follows the pointer lands on top of exactly the thing it is describing.
// A fixed band keeps every line fully on screen and lets the pointer move
// anywhere; when the highlighted element sits too low for that band, the
// caption moves UP to sit immediately above the element rather than jumping to
// a fixed offset at the top of the window — a top-anchored band lands on
// whatever the screen happens to put there (the supervisor KPI row), which is
// a second thing the audience now has to read past.
import { AnimatePresence, motion } from "framer-motion";
import { useDemoStore } from "@/demo/demoStore.ts";

/** Height reserved for the playback bar. */
const BAND = 84;
/** Tallest caption we render (three lines at the current font size). */
const BAND_MAX = 150;

export function Tooltip({
  text,
  position,
}: {
  text: string;
  position: { x: number; y: number };
}) {
  // Hook first: the early return below is conditional, and a hook after it
  // breaks hook order (React: "Rendered fewer hooks than expected").
  const highlight = useDemoStore((s) => s.highlight);
  if (!text) return null;
  const floor = window.innerHeight - BAND - BAND_MAX - 24;
  // Default: the band above the playback bar, clear of the subject either way.
  let style: { top?: number; bottom?: number } = { bottom: BAND };
  // Without a highlight there is only the pointer position, which has no size:
  // treat it as a point so the same two branches still hold.
  const subject = highlight ? highlight.rect : { ...position, h: 0 };
  if (subject.y + subject.h > floor) {
    // Too low for the band. Sit directly above the subject — the caption hugs
    // the thing it names instead of covering an unrelated row near the top.
    const above = subject.y - BAND_MAX - 16;
    // If there is no room above either (a subject near the top), the caption
    // goes below it rather than on top of it.
    style = above >= 56 ? { top: above } : { top: Math.min(subject.y + subject.h + 12, floor) };
  }
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed left-1/2 z-[9998] w-[min(720px,92vw)] -translate-x-1/2 rounded-xl bg-navy/95 px-5 py-3 text-center text-[16.5px] font-medium leading-relaxed text-white shadow-2xl backdrop-blur"
        style={style}
      >
        {text}
      </motion.div>
    </AnimatePresence>
  );
}
