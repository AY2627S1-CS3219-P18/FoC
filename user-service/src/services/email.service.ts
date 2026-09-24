// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 5b - email service
// Author review:

import nodemailer from "nodemailer";
import { config } from "../config.js";

const PURPOSE_COPY: Record<string, { subject: string; intro: string }> = {
  Registration: {
    subject: "Your FoC verification code",
    intro: "Use the code below to finish creating your FoC account.",
  },
};

// Dev fallback is only reachable when NODE_ENV=development and SMTP is not configured.
const useDevFallback = config.env === "development" && config.email.host === "";

const transport = useDevFallback
  ? null
  : nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: { user: config.email.user, pass: config.email.pass },
    });

export async function sendOtpEmail({
  to,
  otp,
  purpose,
}: {
  to: string;
  otp: string;
  purpose: string;
}): Promise<void> {
  if (useDevFallback || !transport) {
    console.log(`[DEV EMAIL] to=${to} purpose=${purpose} otp=${otp}`);
    return;
  }

  const copy = PURPOSE_COPY[purpose];
  if (!copy) {
    throw new Error(`No email template for purpose '${purpose}'`);
  }
  const expiry = `This code expires in ${config.otp.ttlMinutes} minutes.`;

  await transport.sendMail({
    from: config.email.from,
    to,
    subject: copy.subject,
    text: `${copy.intro}\n\nYour code: ${otp}\n\n${expiry}`,
    html: `<p>${copy.intro}</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${otp}</p><p>${expiry}</p>`,
  });
}
