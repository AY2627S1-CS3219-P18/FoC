// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - helpers around the mocked sendOtpEmail
// Author review:
import { beforeEach, expect, vi } from 'vitest';
import { sendOtpEmail } from '../../src/services/email.service.js';

export const sendOtpEmailMock = vi.mocked(sendOtpEmail);

// Call from a describe block: clears recorded calls and restores the succeeding implementation.
export function resetEmailMock(): void {
  beforeEach(() => {
    sendOtpEmailMock.mockReset();
    sendOtpEmailMock.mockImplementation(async () => {});
  });
}

export function failNextEmail(): void {
  sendOtpEmailMock.mockRejectedValueOnce(new Error('SMTP down'));
}

export function emailCallsFor(to: string): { to: string; otp: string; purpose: string }[] {
  return sendOtpEmailMock.mock.calls.map(([arg]) => arg).filter((arg) => arg.to === to);
}

// The plaintext OTP most recently "emailed" to this address.
export function latestOtpFor(to: string): string {
  const calls = emailCallsFor(to);
  expect(calls.length, `no OTP email was sent to ${to}`).toBeGreaterThan(0);
  return calls[calls.length - 1]!.otp;
}

// Any 6-digit code that differs from the real one.
export function wrongOtp(real: string): string {
  return real === '000000' ? '111111' : '000000';
}
