import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a Date in sim-clock wall time (the case world's fictional clock). */
export function fmtClock(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function fmtDateTime(d: Date | number): string {
  const date = typeof d === "number" ? new Date(d) : d;
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const da = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mo}-${da} ${fmtClock(date)}`;
}

/** Deterministic pseudo-random in [0,1) from a string seed (fixtures). */
export function seeded01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
