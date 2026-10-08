// ══════════════════════════════════════════════════════════════════════════
// notify-reply — mails the two people a new comment can concern.
//
//   1. 'reply' — somebody answered an existing comment: mail that reader,
//                if they left an email address.
//   2. 'owner' — any new comment at all: mail the deck owner, so nothing
//                lands on the deck unnoticed.
//
// Triggered by a Postgres trigger (pg_net) on INSERT into deck_comments.
// A comment can raise both mails; the log is keyed (comment_id, kind) so a
// retry can never double-send either one.
//
// Required secrets (Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, DECK_URL
// Optional:
//   OWNER_EMAIL     — the deck owner; gets a mail for every new comment
//   WEBHOOK_SECRET  — if set, the caller must send it in x-webhook-secret
//
// Zero dependencies on purpose: an earlier version imported denomailer from
// deno.land, which a dashboard deploy bundled but an API deploy did not,
// leaving the function in BOOT_ERROR. Plain Deno.connectTls cannot fail that
// way. Port 465 with implicit TLS is what this runtime allows; 587/STARTTLS
// is blocked, so there is no fallback path here.
// ══════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

/* Supabase injects the project keys in two shapes depending on project age:
   the legacy SUPABASE_SERVICE_ROLE_KEY string, or the newer
   SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS JSON dictionaries. */
const SERVICE_KEY = (function () {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  for (const name of ["SUPABASE_SECRET_KEYS", "SUPABASE_PUBLISHABLE_KEYS"]) {
    const raw = Deno.env.get(name);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const first = parsed?.default ?? Object.values(parsed ?? {})[0];
      if (first) return String(first);
    } catch (_) { /* not a JSON dictionary — keep looking */ }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
})();

const esc = (s: string) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ── minimal SMTP over implicit TLS ─────────────────────────────────────── */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64bytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64(s: string): string {
  return b64bytes(enc.encode(s));
}
function wrap76(s: string): string {
  return s.replace(/(.{76})/g, "$1\r\n");
}

/* RFC 2047: a non-ASCII header must be sent as one or more encoded-words, and
   each word must stay under 75 characters. Splitting must fall on character
   boundaries — slicing the UTF-8 bytes would tear a multi-byte character in
   half and produce a header no client can decode. (An earlier version left
   this to the SMTP library, which wrapped a long encoded subject mid-word;
   Gmail then gave up on the whole header block and displayed the raw MIME
   source instead of the mail.) */
function encodeHeader(s: string): string {
  const clean = s.replace(/[\r\n]+/g, " ").slice(0, 200);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;
  const CHUNK = 45;                    // 45 bytes → 60 base64 chars → 72 with wrapper
  const words: string[] = [];
  let cur = "", bytes = 0;
  for (const ch of clean) {
    const size = enc.encode(ch).length;
    if (bytes + size > CHUNK) {
      words.push(`=?UTF-8?B?${b64(cur)}?=`);
      cur = ""; bytes = 0;
    }
    cur += ch; bytes += size;
  }
  if (cur) words.push(`=?UTF-8?B?${b64(cur)}?=`);
  return words.join(" ");
}

function buildMessage(o: { from: string; to: string; subject: string; text: string; html: string }) {
  const boundary = "deck" + Math.random().toString(36).slice(2);
  return [
    `From: ${o.from}`,
    `To: ${o.to}`,
    `Subject: ${encodeHeader(o.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(o.text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(o.html)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

class Smtp {
  private conn: Deno.Conn;
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buf = "";

  constructor(conn: Deno.Conn) {
    this.conn = conn;
    this.reader = conn.readable.getReader();
    this.writer = conn.writable.getWriter();
  }

  private async readReply(): Promise<string> {
    let out = "";
    for (;;) {
      while (!this.buf.includes("\r\n")) {
        const { value, done } = await this.reader.read();
        if (done) throw new Error("SMTP connection closed early");
        this.buf += dec.decode(value, { stream: true });
      }
      const nl = this.buf.indexOf("\r\n");
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 2);
      out += line + "\n";
      if (/^\d{3} /.test(line)) break;   // final line of a multi-line reply
    }
    return out;
  }

  private async cmd(line: string): Promise<string> {
    await this.writer.write(enc.encode(line + "\r\n"));
    return await this.readReply();
  }

  private expect(reply: string, codes: string[], what: string) {
    const lines = reply.trim().split("\n");
    const code = (lines[lines.length - 1] ?? "").slice(0, 3);
    if (!codes.includes(code)) throw new Error(`${what} failed: ${reply.trim().slice(0, 200)}`);
  }

  async send(o: { user: string; pass: string; from: string; to: string; message: string }) {
    this.expect(await this.readReply(), ["220"], "greeting");
    this.expect(await this.cmd(`EHLO ${o.from.split("@")[1] || "localhost"}`), ["250"], "EHLO");
    this.expect(await this.cmd("AUTH LOGIN"), ["334"], "AUTH LOGIN");
    this.expect(await this.cmd(b64(o.user)), ["334"], "AUTH user");
    this.expect(await this.cmd(b64(o.pass)), ["235"], "AUTH password");
    this.expect(await this.cmd(`MAIL FROM:<${o.from}>`), ["250"], "MAIL FROM");
    this.expect(await this.cmd(`RCPT TO:<${o.to}>`), ["250", "251"], "RCPT TO");
    this.expect(await this.cmd("DATA"), ["354"], "DATA");
    // base64 bodies never start a line with a dot, but stay spec-safe
    const body = o.message.replace(/\r\n\./g, "\r\n..");
    await this.writer.write(enc.encode(body + "\r\n.\r\n"));
    this.expect(await this.readReply(), ["250"], "message body");
    await this.cmd("QUIT").catch(() => "");
  }

  close() {
    try { this.conn.close(); } catch (_) { /* already gone */ }
  }
}

async function smtpSend(o: {
  host: string; port: number; user: string; pass: string;
  from: string; to: string; subject: string; text: string; html: string;
}) {
  const conn = await Promise.race([
    Deno.connectTls({ hostname: o.host, port: o.port }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("SMTP connect timed out")), 15000)),
  ]) as Deno.Conn;
  const smtp = new Smtp(conn);
  try {
    await smtp.send({ user: o.user, pass: o.pass, from: o.from, to: o.to, message: buildMessage(o) });
  } finally {
    smtp.close();
  }
}

/* ── mail bodies ────────────────────────────────────────────────────────── */

function replyHtml(o: {
  name: string; replyAuthor: string; replyBody: string;
  yourBody: string; quote: string | null; pageTitle: string; link: string;
}) {
  const yours = o.quote
    ? `<p style="margin:0 0 4px;color:#6B7A8A">On "${esc(o.quote)}"</p>`
    : "";
  return `<div style="font:14px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16202B;max-width:560px">
  <p style="margin:0 0 18px">Hi ${esc(o.name || "there")},</p>
  <p style="margin:0 0 18px"><b>${esc(o.replyAuthor || "Someone")}</b> replied to your comment
     on <b>${esc(o.pageTitle || "the deck")}</b>.</p>
  <div style="border-left:3px solid #0B8C78;padding:10px 14px;background:#F4F7FA;margin:0 0 20px">
    <div style="white-space:pre-wrap">${esc(o.replyBody)}</div>
  </div>
  <p style="margin:0 0 6px;color:#5D6C7B;font-size:12px">Your comment</p>
  <div style="border-left:3px solid #C3CEDA;padding:10px 14px;background:#FFFFFF;margin:0 0 24px">
    ${yours}
    <div style="white-space:pre-wrap">${esc(o.yourBody)}</div>
  </div>
  <a href="${esc(o.link)}" style="display:inline-block;padding:10px 18px;background:#0B8C78;
     color:#FFF;border-radius:8px;text-decoration:none;font-weight:600">Open the deck</a>
  <p style="margin:20px 0 0;color:#8A97A5;font-size:12px">
     You are receiving this because you left an email address with a comment on this deck.</p>
</div>`;
}

function ownerHtml(o: {
  author: string; email: string | null; body: string; quote: string | null;
  pageTitle: string; link: string; isReply: boolean;
  parentAuthor: string; parentBody: string;
}) {
  const who = o.email
    ? `<b>${esc(o.author)}</b> (${esc(o.email)})`
    : `<b>${esc(o.author || "Anonymous")}</b> <span style="color:#8A97A5">(no email left)</span>`;
  const anchor = o.quote
    ? `<p style="margin:0 0 6px;color:#6B7A8A;font-size:13px">On "${esc(o.quote)}"</p>`
    : "";
  const replyingTo = o.isReply
    ? `<p style="margin:0 0 6px;color:#5D6C7B;font-size:12px">In reply to ${esc(o.parentAuthor || "a comment")}:
         "${esc((o.parentBody || "").slice(0, 160))}"</p>`
    : "";
  return `<div style="font:14px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#16202B;max-width:560px">
  <p style="margin:0 0 18px">New ${o.isReply ? "reply" : "comment"} on
     <b>${esc(o.pageTitle || "the deck")}</b></p>
  <p style="margin:0 0 14px">${who} wrote:</p>
  <div style="border-left:3px solid #A96F00;padding:10px 14px;background:#FBF6EA;margin:0 0 24px">
    ${anchor}${replyingTo}
    <div style="white-space:pre-wrap">${esc(o.body)}</div>
  </div>
  <a href="${esc(o.link)}" style="display:inline-block;padding:10px 18px;background:#0B8C78;
     color:#FFF;border-radius:8px;text-decoration:none;font-weight:600">Open the deck</a>
  <p style="margin:20px 0 0;color:#8A97A5;font-size:12px">
     You are the deck owner, so every comment lands in your inbox.</p>
</div>`;
}

/* ── request handler ────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  try {
    const secret = Deno.env.get("WEBHOOK_SECRET");
    if (secret && req.headers.get("x-webhook-secret") !== secret) {
      return json({ error: "unauthorized" }, 401);
    }

    const payload = await req.json();
    const rec = payload?.record ?? payload;
    if (!rec?.id) return json({ ok: false, skipped: "no record" });

    /* The deck's own answers must not mail the owner: every reader comment
       would otherwise produce two notifications — the comment, then the AI's
       reply to it. */
    if ((rec.author ?? "") === "Deck AI") return json({ ok: true, skipped: "ai answer" });

    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASS");
    const from = Deno.env.get("MAIL_FROM") ?? user ?? "";
    const owner = (Deno.env.get("OWNER_EMAIL") ?? "").trim();
    if (!host || !user || !pass) return json({ ok: false, error: "SMTP not configured" }, 500);
    if (!owner && !rec.parent_id) return json({ ok: true, skipped: "top-level comment, no owner mail set" });

    let parent: Record<string, unknown> | null = null;
    if (rec.parent_id) {
      const rows = await rest(
        `deck_comments?id=eq.${rec.parent_id}&select=id,author,email,body,page_key,page_title,quote`
      );
      parent = rows?.[0] ?? null;
    }

    const link = `${Deno.env.get("DECK_URL") ?? ""}?p=${encodeURIComponent(rec.page_key)}&c=${rec.parent_id ?? rec.id}`;

    type Job = { kind: string; to: string; subject: string; text: string; html: string };
    const jobs: Job[] = [];

    if (parent && typeof parent.email === "string" && parent.email && parent.email !== rec.email) {
      jobs.push({
        kind: "reply",
        to: parent.email,
        subject: `${rec.author || "Someone"} replied to your comment — ${parent.page_title || "deck"}`,
        text:
          `${rec.author || "Someone"} replied to your comment on "${parent.page_title || "the deck"}":\n\n` +
          `${rec.body}\n\nYour comment: ${parent.body}\n\nOpen the deck: ${link}`,
        html: replyHtml({
          name: String(parent.author || "there"),
          replyAuthor: rec.author || "Someone",
          replyBody: rec.body,
          yourBody: String(parent.body ?? ""),
          quote: parent.quote ? String(parent.quote) : null,
          pageTitle: String(parent.page_title || "the deck"),
          link,
        }),
      });
    }

    /* the owner hears about everything — unless this comment is their own, or
       they are already getting the 'reply' mail above */
    const ownerIsParent = !!parent && parent.email === owner;
    if (owner && owner !== rec.email && !ownerIsParent) {
      jobs.push({
        kind: "owner",
        to: owner,
        subject: `${rec.parent_id ? "Reply" : "New comment"} on "${rec.page_title || "deck"}" — ${rec.author || "Anonymous"}`,
        text:
          `${rec.author || "Anonymous"}${rec.email ? " <" + rec.email + ">" : ""} wrote on ` +
          `"${rec.page_title || "the deck"}":\n\n${rec.body}\n\nOpen the deck: ${link}`,
        html: ownerHtml({
          author: rec.author || "Anonymous",
          email: rec.email ?? null,
          body: rec.body,
          quote: rec.quote ?? null,
          pageTitle: rec.page_title || "the deck",
          link,
          isReply: !!rec.parent_id,
          parentAuthor: parent ? String(parent.author ?? "") : "",
          parentBody: parent ? String(parent.body ?? "") : "",
        }),
      });
    }

    if (!jobs.length) return json({ ok: true, skipped: "nobody to notify" });

    const results: { kind: string; to: string; status: string; error?: string }[] = [];
    for (const job of jobs) {
      // ── never send twice: the trigger can be replayed ──
      const seen = await rest(
        `deck_comment_notifications?comment_id=eq.${rec.id}&kind=eq.${job.kind}&select=comment_id`
      );
      if (seen?.length) { results.push({ kind: job.kind, to: job.to, status: "already sent" }); continue; }
      try {
        await rest("deck_comment_notifications", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ comment_id: rec.id, kind: job.kind, recipient: job.to, status: "sending" }),
        });
      } catch {
        results.push({ kind: job.kind, to: job.to, status: "already claimed" });
        continue;
      }

      try {
        await smtpSend({
          host,
          port: Number(Deno.env.get("SMTP_PORT") ?? 465),
          user,
          pass,
          from,
          to: job.to,
          subject: job.subject,
          text: job.text,
          html: job.html,
        });
        await rest(
          `deck_comment_notifications?comment_id=eq.${rec.id}&kind=eq.${job.kind}`,
          { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "sent" }) }
        );
        results.push({ kind: job.kind, to: job.to, status: "sent" });
      } catch (e) {
        console.error("send failed:", String(e));
        await rest(
          `deck_comment_notifications?comment_id=eq.${rec.id}&kind=eq.${job.kind}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ status: "failed", error: String(e).slice(0, 400) }),
          }
        );
        results.push({ kind: job.kind, to: job.to, status: "failed", error: String(e).slice(0, 200) });
      }
    }

    const failed = results.some((r) => r.status === "failed");
    return json({ ok: !failed, results }, failed ? 500 : 200);
  } catch (e) {
    console.error("notify-reply error:", String(e));
    return json({ error: String(e) }, 500);
  }
});
