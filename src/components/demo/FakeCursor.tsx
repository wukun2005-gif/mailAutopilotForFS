// Ported from GraphMe (MIT, own project): pure visual layer. Pose, click
// ripple and tooltip come from demoStore; the runner owns all behavior.
import { motion } from "framer-motion";
import { useDemoStore } from "@/demo/demoStore.ts";
import { Tooltip } from "./Tooltip.tsx";

export function FakeCursor() {
  const visible = useDemoStore((s) => s.visible);
  const position = useDemoStore((s) => s.cursor);
  const clicking = useDemoStore((s) => s.clicking);
  const tooltip = useDemoStore((s) => s.tooltip);

  if (!visible) return null;

  return (
    <>
      <Tooltip text={tooltip} position={position} />
      <motion.div
        className="pointer-events-none fixed z-[9999]"
        animate={{ x: position.x, y: position.y, scale: clicking ? 0.75 : 1 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
        style={{ left: 0, top: 0, marginLeft: -11, marginTop: -13 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 2L20 10.6667L12 13L10 21L4 2Z"
            fill="white"
            stroke="#16324f"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {clicking && (
          <motion.div
            className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-teal"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </motion.div>
    </>
  );
}
