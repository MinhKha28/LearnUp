import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "./config.mjs";

const MAILBOX = path.join(STATE_DIR, "mailbox");

function decodeQuotedPrintable(text) {
  const bytes = [];
  const soft = text.replace(/=\r?\n/g, "");
  for (let i = 0; i < soft.length; i++) {
    if (soft[i] === "=" && /^[0-9A-F]{2}$/i.test(soft.slice(i + 1, i + 3))) {
      bytes.push(parseInt(soft.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...Buffer.from(soft[i], "utf8"));
  }
  return Buffer.from(bytes).toString("utf8");
}

/** Waits for a message to `recipient` captured by the SMTP sink and returns its decoded text. */
export async function waitForMail(recipient, { timeoutMs = 20000, after = 0 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.existsSync(MAILBOX) ? fs.readdirSync(MAILBOX).filter((f) => f.endsWith(".eml")) : [];
    for (const f of files.sort().reverse()) {
      const full = path.join(MAILBOX, f);
      if (fs.statSync(full).mtimeMs < after) continue;
      const raw = fs.readFileSync(full, "utf8");
      if (raw.startsWith(`X-Sink-Rcpt: ${recipient}\r\n`)) return decodeQuotedPrintable(raw);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no email to ${recipient} within ${timeoutMs} ms (is notification-service mail enabled and smtp-sink running?)`);
}

export const invitationToken = (mail) => {
  const m = /\/activate\/([A-Za-z0-9_-]+)/.exec(mail);
  if (!m) throw new Error("invitation email has no /activate/<token> link");
  return m[1];
};

/** Every message to `recipient` captured since `after` (ms epoch), oldest first, decoded. */
export function mailsTo(recipient, { after = 0 } = {}) {
  const files = fs.existsSync(MAILBOX) ? fs.readdirSync(MAILBOX).filter((f) => f.endsWith(".eml")) : [];
  const found = [];
  for (const f of files.sort()) {
    const full = path.join(MAILBOX, f);
    if (fs.statSync(full).mtimeMs < after) continue;
    const raw = fs.readFileSync(full, "utf8");
    if (raw.startsWith(`X-Sink-Rcpt: ${recipient}\r\n`)) found.push(decodeQuotedPrintable(raw));
  }
  return found;
}

/** Waits until at least `count` messages to `recipient` exist since `after`; returns them oldest first. */
export async function waitForMails(recipient, count, { timeoutMs = 20000, after = 0 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mails = mailsTo(recipient, { after });
    if (mails.length >= count) return mails;
    if (Date.now() >= deadline) throw new Error(`expected ${count} email(s) to ${recipient} within ${timeoutMs} ms, found ${mails.length}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** The 6-digit registration OTP in a verification email (code box), or null for other messages. */
export const registrationOtp = (mail) => /letter-spacing:10px[^>]*>(\d{6})</.exec(mail)?.[1] ?? null;

/** The raw reopen-link token of a verification / reopen email. */
export const reopenToken = (mail) => /pending-payment\?token=([A-Za-z0-9_-]+)/.exec(mail)?.[1] ?? null;
