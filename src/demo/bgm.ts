// Background music for the 90s trailer demo. Plays a low-volume loop under
// the narration so the voice stays clearly on top. Start/stop is driven by
// the demo runner when the trailer script begins/ends.
import { useDemoStore } from "./demoStore.ts";

/** Keep BGM well below narration level. */
const BGM_VOLUME = 0.15;

class BgmPlayer {
  private audio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    useDemoStore.subscribe((s, prev) => {
      const a = this.audio;
      if (s.status === prev.status || !a) return;
      if (s.status === "playing") {
        if (a.paused && !a.ended) void a.play().catch(() => {});
      } else if (s.status === "paused") {
        if (!a.paused) a.pause();
      } else {
        this.stop(); // idle | done
      }
    });
  }

  start(): void {
    this.stop();
    const a = new Audio();
    a.src = `${import.meta.env.BASE_URL}bgm-trailer.mp3`;
    a.loop = true;
    a.volume = BGM_VOLUME;
    a.preload = "auto";
    this.audio = a;
    void a.play().catch(() => {
      // Autoplay blocked — BGM is a nice-to-have, not a blocker.
      this.audio = null;
    });
  }

  stop(): void {
    const a = this.audio;
    this.audio = null;
    if (!a) return;
    a.pause();
    a.removeAttribute("src");
    void a.load();
  }
}

export const bgmPlayer = new BgmPlayer();
