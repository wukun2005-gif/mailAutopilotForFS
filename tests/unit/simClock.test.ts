import { describe, expect, it, beforeEach } from "vitest";
import {
  addBusinessDays,
  addCalendarDays,
  DAY0_EPOCH,
  diffCalendarDays,
  diffCalendarHours,
  regEClocks,
  regZClocks,
  simClock,
  utcYmd,
} from "@runtime/simClock";

beforeEach(() => simClock.reset());

describe("simClock — fixed demo calendar", () => {
  it("Day 0 is Tuesday 2026-09-22 08:14", () => {
    expect(utcYmd(DAY0_EPOCH)).toBe("2026-09-22");
    expect(new Date(DAY0_EPOCH).getUTCDay()).toBe(2);
    expect(simClock.dayN()).toBe(0);
  });

  it("bd10 lands on 2026-10-06 (weekends only, no holiday table)", () => {
    // 9/22 Tue → count 10 business days: 9/23,24,25,28,29,30,10/1,2,5,6
    expect(utcYmd(addBusinessDays(DAY0_EPOCH, 10))).toBe("2026-10-06");
    expect(utcYmd(addBusinessDays(DAY0_EPOCH, 20))).toBe("2026-10-20");
  });

  it("day45 = 2026-11-06 and day90 = 2026-12-21 (calendar days)", () => {
    expect(utcYmd(addCalendarDays(DAY0_EPOCH, 45))).toBe("2026-11-06");
    expect(utcYmd(addCalendarDays(DAY0_EPOCH, 90))).toBe("2026-12-21");
    expect(diffCalendarDays(DAY0_EPOCH, addCalendarDays(DAY0_EPOCH, 14))).toBe(14);
  });

  it("Reg E clocks: POS debit uses 90-day cap; Reg Z ack at 30d", () => {
    const c = regEClocks(DAY0_EPOCH);
    expect(utcYmd(c.provisionalCreditDue)).toBe("2026-10-06");
    expect(utcYmd(c.day45)).toBe("2026-11-06");
    expect(utcYmd(c.day90)).toBe("2026-12-21");
    const z = regZClocks(DAY0_EPOCH);
    expect(utcYmd(z.ackWrittenDue)).toBe("2026-10-22");
    expect(utcYmd(z.resolveDue)).toBe("2026-12-21");
  });

  it("48h warning uses calendar hours, not business-day conversion", () => {
    const due = addCalendarDays(DAY0_EPOCH, 2);
    expect(diffCalendarHours(DAY0_EPOCH, due)).toBe(48);
  });

  it("jump + subscribe drive the singleton clock", () => {
    const seen: number[] = [];
    const off = simClock.subscribe((s) => seen.push(s.dayN));
    simClock.jumpToCalendarDay(6);
    simClock.advanceHours(1);
    expect(simClock.dayN()).toBe(6);
    expect(seen).toEqual([6, 6]);
    off();
    simClock.advanceCalendarDays(1);
    expect(seen.length).toBe(2);
  });
});
