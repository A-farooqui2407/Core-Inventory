/**
 * Email sending for OTP (forgot password). Uses nodemailer.
 * Required env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */
import nodemailer from 'nodemailer';

const host = process.env.EMAIL_HOST;
const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 587;
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const from = process.env.EMAIL_FROM;

function getTransport() {
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

/**
 * Send OTP email for password reset.
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<boolean>} - true if sent, false if transport not configured
 */
export async function sendOtpEmail(to, otp) {
  const transport = getTransport();
  if (!transport || !to) return false;
  const fromAddr = from || user;
  await transport.sendMail({
    from: fromAddr,
    to,
    subject: 'CoreInventory – Password reset code',
    text: `Your password reset code is: ${otp}. It expires in 10 minutes.`,
    html: `<p>Your password reset code is: <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
  });
  return true;
}
