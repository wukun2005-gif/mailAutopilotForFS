// Narration caption. Pinned to a band just above the playback bar rather than
// glued to the pointer: the fake cursor points at a real element (a policy
// card, a clock-board table, a greyed-out fraud button), and a caption that
// follows the pointer lands on top of exactly the thing it is describing.
// A fixed band keeps every line fully on screen and lets the pointer move
// anywhere; when the highlighted element sits low on the screen the band moves
// to the top instead, so the caption never covers its own subject.
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
  const low = highlight ? highlight.rect.y + highlight.rect.h > floor : position.y > floor;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed left-1/2 z-[9998] w-[min(720px,92vw)] -translate-x-1/2 rounded-xl bg-navy/95 px-5 py-3 text-center text-[16.5px] font-medium leading-relaxed text-white shadow-2xl backdrop-blur"
        style={low ? { top: 96 } : { bottom: BAND }}
      >
        {text}
      </motion.div>
    </AnimatePresence>
  );
}
