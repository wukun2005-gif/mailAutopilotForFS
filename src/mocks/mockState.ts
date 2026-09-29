// In-memory state for the mock backends (second, "server-side" idempotency
// layer — the browser-side ledger in runtime/idempotency.ts is the first).
// A page refresh clears this just like a mock server restart; checkpoints in
// IndexedDB are what make resume safe regardless.
export interface PostedAction {
  key: string;
  actionType: string;
  atSimTime: number;
  result: unknown;
}

export interface SentMessage {
  id: string;
  to: string;
  channel: "secure_message" | "sms" | "email";
  kind: string;
  body: string;
  atSimTime: number;
  blockedReason?: string;
}

export interface OtpSession {
  channel: "sms" | "link";
  code: string;
  attempts: number;
  locked: boolean;
  startedAt: number;
}

interface MockState {
  actions: Map<string, PostedAction>;
  disputes: Map<string, unknown>;
  messages: SentMessage[];
  otp: OtpSession | null;
  inbound: Array<{ scenarioId: string; atSimTime: number }>;
}

let state: MockState = fresh();

function fresh(): MockState {
  return {
    actions: new Map(),
    disputes: new Map(),
    messages: [],
    otp: null,
    inbound: [],
  };
}

export function resetMockState(): void {
  state = fresh();
}

export const mockStore = {
  get actions(): Map<string, PostedAction> {
    return state.actions;
  },
  get disputes(): Map<string, unknown> {
    return state.disputes;
  },
  get messages(): SentMessage[] {
    return state.messages;
  },
  get inbound(): Array<{ scenarioId: string; atSimTime: number }> {
    return state.inbound;
  },
  getOtp(): OtpSession | null {
    return state.otp;
  },
  setOtp(session: OtpSession | null): void {
    state.otp = session;
  },
};
