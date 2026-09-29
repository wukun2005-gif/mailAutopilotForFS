// Ported from GraphMe (MIT, own project): narration tooltip that follows the
// fake cursor and flips side near the screen edge.
import { AnimatePresence, motion } from "framer-motion";

export function Tooltip({ text, position }: { text: string; position: { x: number; y: number } }) {
  if (!text) return null;
  const tooltipWidth = Math.min(Math.max(text.length * 8, 180), 520);
  const left = Math.max(10, Math.min(position.x - tooltipWidth / 2, window.innerWidth - tooltipWidth - 10));
  const top = position.y > window.innerHeight - 120 ? position.y - 64 : position.y + 30;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="pointer-events-none fixed max-w-[520px] rounded-xl bg-navy/95 px-4 py-2.5 text-center text-[12.5px] font-medium leading-relaxed text-white shadow-xl"
        style={{ left, top, zIndex: 9998 }}
      >
        {text}
      </motion.div>
    </AnimatePresence>
  );
}
