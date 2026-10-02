// The agenda card every script opens with (Dev Plan §8.2 stage 0): the whole
// list of demo sections in the middle of the screen, with the row that is
// about to run lit. BGM plays under it and nothing is voiced — the card is
// read, not heard — then it exits and the script proper begins.
//
// The rows live here rather than in the scripts because they are the same five
// for every run: what changes is only which one is highlighted.
export interface AgendaEntry {
  /** The script this row lights up when it is the one about to run. */
  scriptId: string;
  /** i18n key under demo:agenda.items — { title, desc } in both locales. */
  key: string;
}

export const AGENDA: AgendaEntry[] = [
  { scriptId: "trailer90s", key: "overview" },
  { scriptId: "email1", key: "demo1" },
  { scriptId: "email2", key: "demo2" },
  { scriptId: "email3", key: "demo3" },
  { scriptId: "builder", key: "demo4" },
];

/** How long the card holds the screen before the script starts, at 1×.
 *  Long enough to read five rows and spot the lit one; the wait goes through
 *  DemoRunner.wait(), so pause and the speed multiplier apply as usual. */
export const AGENDA_MS = 6500;