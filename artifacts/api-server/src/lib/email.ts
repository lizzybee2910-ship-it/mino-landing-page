import { Resend } from "resend";
import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@mino.app";
// Public-facing support contact used in transactional emails. Configurable so
// staging or white-labelled deployments can point members at a different
// inbox without a code change.
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@mino.app";
// Canonical public origin used in outbound links (e.g. email verification URLs).
// Falls back to the request-derived origin when not set, but this variable
// should be explicitly configured in production to avoid depending on Host headers.
export const APP_ORIGIN = process.env.APP_ORIGIN ?? null;

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export async function sendVerificationEmail(
  to: string,
  verificationToken: string,
  appOrigin: string,
): Promise<void> {
  const client = getResend();
  if (!client) {
    logger.warn(
      { to },
      "RESEND_API_KEY is not set — email verification cannot be delivered in production. " +
        "Set RESEND_API_KEY to enable transactional email delivery.",
    );
    return;
  }

  const verifyUrl = `${appOrigin}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  const { error } = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Verify your email address",
    html: `
      <p>Thanks for signing up! Please verify your email address by clicking the link below.</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
    `.trim(),
    text: [
      "Thanks for signing up! Please verify your email address by visiting the link below.",
      "",
      verifyUrl,
      "",
      "This link expires in 24 hours.",
      "If you did not create an account, you can safely ignore this email.",
    ].join("\n"),
  });

  if (error) {
    logger.error({ error, to }, "Failed to send verification email via Resend");
    throw new Error("Failed to send verification email");
  }

  logger.info({ to }, "Verification email sent");
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  appOrigin: string,
): Promise<void> {
  const client = getResend();
  if (!client) {
    logger.warn(
      { to },
      "RESEND_API_KEY is not set — password reset emails cannot be delivered. " +
        "Set RESEND_API_KEY to enable transactional email delivery.",
    );
    return;
  }

  const resetUrl = `${appOrigin}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const { error } = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Reset your password",
    html: `
      <p>We received a request to reset the password for your (mino) account.</p>
      <p><a href="${resetUrl}">Choose a new password</a></p>
      <p>This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your current password will keep working.</p>
    `.trim(),
    text: [
      "We received a request to reset the password for your (mino) account.",
      "",
      "Open the link below to choose a new password:",
      resetUrl,
      "",
      "This link expires in 1 hour.",
      "If you did not request a password reset, you can safely ignore this email — your current password will keep working.",
    ].join("\n"),
  });

  if (error) {
    logger.error({ error, to }, "Failed to send password reset email via Resend");
    throw new Error("Failed to send password reset email");
  }

  logger.info({ to }, "Password reset email sent");
}

export interface PasswordChangedContext {
  changedAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function formatChangedAt(date: Date): string {
  // Use a UTC, second-precision timestamp so the recipient can correlate the
  // event with their own activity log without ambiguity over timezone.
  return `${date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")} UTC`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface NewSignInContext {
  signedInAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  appOrigin: string;
}

export async function sendNewSignInEmail(
  to: string,
  context: NewSignInContext,
): Promise<void> {
  const client = getResend();
  if (!client) {
    logger.warn(
      { to },
      "RESEND_API_KEY is not set — new sign-in notification cannot be delivered. " +
        "Set RESEND_API_KEY to enable transactional email delivery.",
    );
    return;
  }

  const when = formatChangedAt(context.signedInAt);
  const ip = context.ipAddress?.trim() || "unknown";
  const ua = context.userAgent?.trim() || "unknown";

  const securityUrl = `${context.appOrigin}/account`;
  const resetUrl = `${context.appOrigin}/forgot-password`;

  const detailLinesText = [
    `When: ${when}`,
    `IP address: ${ip}`,
    `Device / browser: ${ua}`,
  ];

  const detailLinesHtml = [
    `<li><strong>When:</strong> ${escapeHtml(when)}</li>`,
    `<li><strong>IP address:</strong> ${escapeHtml(ip)}</li>`,
    `<li><strong>Device / browser:</strong> ${escapeHtml(ua)}</li>`,
  ].join("");

  const { error } = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "New sign-in to your (mino) account",
    html: `
      <p>We just saw a sign-in to your (mino) account from a device or location we have not seen on this account before.</p>
      <ul>${detailLinesHtml}</ul>
      <p>If this was you, no further action is needed.</p>
      <p><strong>If this wasn't you</strong>, your account may be at risk:</p>
      <ul>
        <li><a href="${escapeHtml(resetUrl)}">Reset your password</a> right away.</li>
        <li><a href="${escapeHtml(securityUrl)}">Review recent security activity</a> on your account.</li>
        <li>Or contact <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a> so we can help you secure it.</li>
      </ul>
    `.trim(),
    text: [
      "We just saw a sign-in to your (mino) account from a device or location we have not seen on this account before.",
      "",
      ...detailLinesText,
      "",
      "If this was you, no further action is needed.",
      "",
      "If this wasn't you, your account may be at risk:",
      `- Reset your password: ${resetUrl}`,
      `- Review recent security activity: ${securityUrl}`,
      `- Or contact ${SUPPORT_EMAIL} so we can help you secure it.`,
    ].join("\n"),
  });

  if (error) {
    logger.error(
      { error, to },
      "Failed to send new sign-in notification via Resend",
    );
    throw new Error("Failed to send new sign-in notification email");
  }

  logger.info({ to }, "New sign-in notification sent");
}

export async function sendPasswordChangedEmail(
  to: string,
  context: PasswordChangedContext,
): Promise<void> {
  const client = getResend();
  if (!client) {
    logger.warn(
      { to },
      "RESEND_API_KEY is not set — password change notification cannot be delivered. " +
        "Set RESEND_API_KEY to enable transactional email delivery.",
    );
    return;
  }

  const when = formatChangedAt(context.changedAt);
  const ip = context.ipAddress?.trim() || "unknown";
  const ua = context.userAgent?.trim() || "unknown";

  const detailLinesText = [
    `When: ${when}`,
    `IP address: ${ip}`,
    `Device / browser: ${ua}`,
  ];

  const detailLinesHtml = [
    `<li><strong>When:</strong> ${escapeHtml(when)}</li>`,
    `<li><strong>IP address:</strong> ${escapeHtml(ip)}</li>`,
    `<li><strong>Device / browser:</strong> ${escapeHtml(ua)}</li>`,
  ].join("");

  const { error } = await client.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Your (mino) password was just changed",
    html: `
      <p>This is a quick note to let you know the password on your (mino) account was just changed.</p>
      <ul>${detailLinesHtml}</ul>
      <p>If this was you, no further action is needed — you can keep reading.</p>
      <p><strong>If this wasn't you</strong>, your account may be at risk. Please reply to this email or contact <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a> right away so we can help you secure it.</p>
    `.trim(),
    text: [
      "This is a quick note to let you know the password on your (mino) account was just changed.",
      "",
      ...detailLinesText,
      "",
      "If this was you, no further action is needed.",
      "",
      `If this wasn't you, your account may be at risk. Please reply to this email or contact ${SUPPORT_EMAIL} right away so we can help you secure it.`,
    ].join("\n"),
  });

  if (error) {
    logger.error(
      { error, to },
      "Failed to send password changed notification via Resend",
    );
    throw new Error("Failed to send password changed email");
  }

  logger.info({ to }, "Password changed notification sent");
}
