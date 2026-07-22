import nodemailer, { Transporter } from "nodemailer";

// One transporter per process. Preference order:
//   1. Gmail OAuth2  (GMAIL_OAUTH_* set)  — used for OTP codes AND PO notifications
//   2. SMTP          (SMTP_HOST set)      — the legacy app-password path (fallback)
//   3. none          — dev mode: log the message so flows still work without email
let transporter: Transporter | null | undefined;
let fromAddress = "Keystone Procurement";

function gmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_OAUTH_CLIENT_ID &&
      process.env.GMAIL_OAUTH_CLIENT_SECRET &&
      process.env.GMAIL_OAUTH_REFRESH_TOKEN &&
      process.env.GMAIL_SENDER_EMAIL,
  );
}

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;

  if (gmailConfigured()) {
    const sender = process.env.GMAIL_SENDER_EMAIL as string;
    const name = process.env.GMAIL_SENDER_NAME || "Keystone Procurement";
    fromAddress = `${name} <${sender}>`;
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: sender,
        clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
        clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_OAUTH_REFRESH_TOKEN,
      },
    });
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  if (host) {
    fromAddress = process.env.MAIL_FROM ?? "Keystone Procurement";
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return transporter;
  }

  transporter = null;
  return null;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/** Send an email. Never throws — a failed notification must not break the caller. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: MailAttachment[];
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    const att = opts.attachments?.length ? ` [${opts.attachments.length} attachment(s)]` : "";
    console.log(`[dev email] to=${opts.to} subject="${opts.subject}"${att}\n${opts.text}`);
    return false;
  }
  try {
    await t.sendMail({
      from: fromAddress,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachments,
    });
    console.log(`[mail] sent to ${opts.to}: "${opts.subject}"`);
    return true;
  } catch (err) {
    console.warn(`[mail] to ${opts.to} failed: ${(err as Error).message}`);
    return false;
  }
}
