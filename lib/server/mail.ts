import nodemailer, { Transporter } from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";

// Mail delivery. Preference order:
//   1. Gmail API  (GMAIL_OAUTH_* set)  — sends via gmail.users.messages.send using
//      the gmail.send OAuth scope. Used for OTP codes AND PO notifications.
//   2. SMTP       (SMTP_HOST set)      — legacy app-password fallback.
//   3. none       — dev mode: log the message so flows work without email.

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface MailOpts {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}

function gmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_OAUTH_CLIENT_ID &&
      process.env.GMAIL_OAUTH_CLIENT_SECRET &&
      process.env.GMAIL_OAUTH_REFRESH_TOKEN &&
      process.env.GMAIL_SENDER_EMAIL,
  );
}

function fromAddress(): string {
  if (gmailConfigured()) {
    const name = process.env.GMAIL_SENDER_NAME || "Keystone Procurement";
    return `${name} <${process.env.GMAIL_SENDER_EMAIL}>`;
  }
  return process.env.MAIL_FROM ?? "Keystone Procurement";
}

/** Which transport sendMail() will use right now (for diagnostics). */
export function mailTransport(): "gmail-api" | "smtp" | "none" {
  if (gmailConfigured()) return "gmail-api";
  if (process.env.SMTP_HOST) return "smtp";
  return "none";
}

// ── Gmail API path ──────────────────────────────────────────────────────────────
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function gmailAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.accessToken;
  const body = new URLSearchParams({
    client_id: process.env.GMAIL_OAUTH_CLIENT_ID as string,
    client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET as string,
    refresh_token: process.env.GMAIL_OAUTH_REFRESH_TOKEN as string,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Gmail token refresh failed: ${json.error ?? res.status}`);
  }
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

async function buildRawMessage(opts: MailOpts): Promise<Buffer> {
  const composer = new MailComposer({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments,
  });
  return await new Promise<Buffer>((resolve, reject) => {
    composer.compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });
}

async function sendViaGmailApi(opts: MailOpts): Promise<void> {
  const token = await gmailAccessToken();
  const raw = (await buildRawMessage(opts)).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail API send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

// ── SMTP path (fallback) ──────────────────────────────────────────────────────────
let smtp: Transporter | null | undefined;

function smtpTransporter(): Transporter | null {
  if (smtp !== undefined) return smtp;
  const host = process.env.SMTP_HOST;
  if (!host) {
    smtp = null;
    return null;
  }
  smtp = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return smtp;
}

/** Send an email. Never throws — a failed notification must not break the caller. */
export async function sendMail(opts: MailOpts): Promise<boolean> {
  const transport = mailTransport();
  try {
    if (transport === "gmail-api") {
      await sendViaGmailApi(opts);
      console.log(`[mail] sent via gmail-api to ${opts.to}: "${opts.subject}"`);
      return true;
    }
    if (transport === "smtp") {
      const t = smtpTransporter();
      if (!t) throw new Error("SMTP not configured");
      await t.sendMail({
        from: fromAddress(),
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        attachments: opts.attachments,
      });
      console.log(`[mail] sent via smtp to ${opts.to}: "${opts.subject}"`);
      return true;
    }
    const att = opts.attachments?.length ? ` [${opts.attachments.length} attachment(s)]` : "";
    console.log(`[dev email] to=${opts.to} subject="${opts.subject}"${att}\n${opts.text}`);
    return false;
  } catch (err) {
    console.warn(`[mail] to ${opts.to} via ${transport} failed: ${(err as Error).message}`);
    return false;
  }
}
