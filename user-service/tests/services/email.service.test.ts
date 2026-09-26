// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-26
// 26/09/2026: Stage 7 - tests for the real email.service.ts (nodemailer mocked)
// Author review:
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn(async (_mail: Record<string, string>) => ({}));
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});

vi.mock('nodemailer', () => ({ default: { createTransport } }));

type EmailModule = typeof import('../../src/services/email.service.js');
type Cfg = typeof import('../../src/config.js').config;

// Loads the real email service (the setup file mocks it globally) against a chosen config.
async function loadEmailService(overrides: {
  env?: string;
  smtpHost?: string;
}): Promise<EmailModule> {
  vi.resetModules();
  vi.doMock('../../src/config.js', async () => {
    const actual = await vi.importActual<{ config: Cfg }>('../../src/config.js');
    return {
      config: {
        ...actual.config,
        env: overrides.env ?? actual.config.env,
        email: {
          ...actual.config.email,
          host: overrides.smtpHost ?? actual.config.email.host,
        },
      },
    };
  });
  return vi.importActual<EmailModule>('../../src/services/email.service.js');
}

beforeEach(() => {
  sendMail.mockClear();
  sendMail.mockImplementation(async () => ({}));
  createTransport.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock('../../src/config.js');
});

describe('sendOtpEmail (SMTP path)', () => {
  it('creates one transport from config.email and sends to the recipient', async () => {
    const { sendOtpEmail } = await loadEmailService({});
    await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.test.invalid',
        port: 587,
        secure: false,
        auth: { user: 'test-user', pass: 'test-pass' },
      }),
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0]![0]).toMatchObject({
      to: 'a@example.com',
      from: 'noreply@test.invalid',
    });
  });

  it('Registration: subject "Your FoC verification code"; text and html carry the OTP and expiry', async () => {
    const { sendOtpEmail } = await loadEmailService({});
    await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' });

    const mail = sendMail.mock.calls[0]![0] as { subject: string; text: string; html: string };
    expect(mail.subject).toBe('Your FoC verification code');
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('123456');
      expect(body).toContain('10 minutes');
    }
  });

  it('Forgot Password: subject "Your FoC password reset code"; text and html carry the OTP and expiry', async () => {
    const { sendOtpEmail } = await loadEmailService({});
    await sendOtpEmail({ to: 'a@example.com', otp: '654321', purpose: 'Forgot Password' });

    const mail = sendMail.mock.calls[0]![0] as { subject: string; text: string; html: string };
    expect(mail.subject).toBe('Your FoC password reset code');
    for (const body of [mail.text, mail.html]) {
      expect(body).toContain('654321');
      expect(body).toContain('10 minutes');
    }
  });

  it('contains no links', async () => {
    const { sendOtpEmail } = await loadEmailService({});
    for (const purpose of ['Registration', 'Forgot Password']) {
      sendMail.mockClear();
      await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose });
      const mail = sendMail.mock.calls[0]![0] as { text: string; html: string };
      expect(mail.text).not.toMatch(/https?:|www\./i);
      expect(mail.html).not.toMatch(/<a\s|https?:|www\./i);
    }
  });

  it('throws when the transport fails', async () => {
    const { sendOtpEmail } = await loadEmailService({});
    sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(
      sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' }),
    ).rejects.toThrow('SMTP down');
  });

  it('throws for a purpose that has no template, without sending', async () => {
    const { sendOtpEmail } = await loadEmailService({});
    await expect(
      sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Change Email' }),
    ).rejects.toThrow();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not log the OTP', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sendOtpEmail } = await loadEmailService({});
    await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' });
    expect(JSON.stringify([log.mock.calls, error.mock.calls])).not.toContain('123456');
  });
});

describe('sendOtpEmail (development fallback)', () => {
  it('logs [DEV EMAIL] and does not use SMTP when NODE_ENV=development and SMTP_HOST is empty', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendOtpEmail } = await loadEmailService({ env: 'development', smtpHost: '' });

    await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' });

    expect(log).toHaveBeenCalledWith(
      '[DEV EMAIL] to=a@example.com purpose=Registration otp=123456',
    );
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('is not used in development when SMTP_HOST is set', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { sendOtpEmail } = await loadEmailService({ env: 'development', smtpHost: 'smtp.real' });
    await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it.each(['production', 'test'])(
    'is unreachable when NODE_ENV=%s, even with an empty SMTP_HOST',
    async (env) => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { sendOtpEmail } = await loadEmailService({ env, smtpHost: '' });
      await sendOtpEmail({ to: 'a@example.com', otp: '123456', purpose: 'Registration' });
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
    },
  );
});
