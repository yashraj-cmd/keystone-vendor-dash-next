import nodemailer, { Transporter } from "nodemailer";

// One transporter per process. Sends real email when SMTP_HOST is set; otherwise
// logs the message (dev mode) so flows work without SMTP.
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
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
      from: process.env.MAIL_FROM ?? "Keystone Procurement",
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
