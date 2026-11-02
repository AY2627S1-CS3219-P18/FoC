/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-23
 * Scope: Created the /forgot-password page, per instructions.md Stage 16d: a three-step page
 *        (email, OTP, new password) whose email and verified OTP live only in component state,
 *        so a reload restarts at step 1 as specified. Step 3's errors (e.g. the code expiring
 *        between steps) send the user back to step 2 with the error shown there, reusing the
 *        same otpError/otpBannerError state rather than inventing a parallel error channel.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import FieldError from '../components/FieldError'
import FormBanner from '../components/FormBanner'
import Logo from '../components/Logo'
import OtpInput from '../components/OtpInput'
import ResendButton from '../components/ResendButton'
import * as authApi from '../api/auth'
import { describeError, errorMessages } from '../api/errorMessages'
import { EMAIL_MESSAGE, PASSWORD_MESSAGE, isValidEmail, isValidPassword } from '../utils/validation'

const cooldownText = (err) =>
  errorMessages.OTP_RESEND_COOLDOWN.message + (err.retryAfterSeconds ? ' (' + err.retryAfterSeconds + 's)' : '')

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // 'email' | 'otp' | 'password'

  const [email, setEmail] = useState('')
  const [emailFieldError, setEmailFieldError] = useState('')
  const [emailFormError, setEmailFormError] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpBannerError, setOtpBannerError] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const otpRef = useRef(null)

  const [newPassword, setNewPassword] = useState('')
  const [passwordFieldError, setPasswordFieldError] = useState('')
  const [passwordFormError, setPasswordFormError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const requestOtpEmail = async () => {
    try {
      await authApi.forgotPassword({ email })
      return true
    } catch (err) {
      if (err.code === 'EMAIL_NOT_FOUND') {
        setEmailFieldError(errorMessages.EMAIL_NOT_FOUND.message)
      } else if (err.code === 'ACCOUNT_NOT_VERIFIED') {
        setEmailFormError(errorMessages.ACCOUNT_NOT_VERIFIED.message)
      } else if (err.code === 'OTP_RESEND_COOLDOWN') {
        setEmailFormError(cooldownText(err))
      } else if (err.code === 'OTP_RESEND_LIMIT') {
        setEmailFormError(errorMessages.OTP_RESEND_LIMIT.message)
      } else {
        setEmailFormError(describeError(err).message)
      }
      return false
    }
  }

  const onSubmitEmail = async (e) => {
    e.preventDefault()
    const error = isValidEmail(email) ? '' : EMAIL_MESSAGE
    setEmailFieldError(error)
    if (error) return

    setEmailFormError('')
    setEmailBusy(true)
    try {
      if (await requestOtpEmail()) setStep('otp')
    } finally {
      setEmailBusy(false)
    }
  }

  const onOtpComplete = async (code) => {
    setOtpError('')
    setOtpBannerError('')
    setOtpBusy(true)
    try {
      await authApi.verifyOtp({ email, otp: code, purpose: 'forgot_password' })
      setOtp(code)
      setStep('password')
    } catch (err) {
      if (err.code === 'INVALID_OTP') {
        otpRef.current?.reset()
        setOtpError(errorMessages.INVALID_OTP.message)
      } else if (err.code === 'OTP_EXPIRED' || err.code === 'OTP_ATTEMPTS_EXCEEDED') {
        setOtpError(errorMessages[err.code].message + ' Use resend below.')
      } else {
        setOtpBannerError(describeError(err).message)
      }
    } finally {
      setOtpBusy(false)
    }
  }

  const onResendOtp = () => authApi.resendOtp({ email, purpose: 'forgot_password' })
  const onResendError = (err) => setOtpBannerError(describeError(err).message)

  const onSubmitPassword = async (e) => {
    e.preventDefault()
    const error = isValidPassword(newPassword) ? '' : PASSWORD_MESSAGE
    setPasswordFieldError(error)
    if (error) return

    setPasswordFormError('')
    setPasswordBusy(true)
    try {
      await authApi.resetPassword({ email, otp, newPassword })
      navigate('/login', {
        state: { successMessage: 'Password reset. Please log in with your new password.' },
      })
    } catch (err) {
      if (err.code === 'INVALID_OTP' || err.code === 'OTP_EXPIRED' || err.code === 'OTP_ATTEMPTS_EXCEEDED') {
        setOtpBannerError(errorMessages[err.code].message)
        setStep('otp')
      } else {
        setPasswordFormError(describeError(err).message)
      }
    } finally {
      setPasswordBusy(false)
    }
  }

  if (step === 'otp') {
    return (
      <div className="page-width page-gutter flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
        <div className="w-full max-w-[440px]">
          <Logo asLink={false} />
          <h1 className="font-display mt-5 text-2xl font-bold text-ink">Enter the code</h1>
          <p className="mt-2 text-sm text-ink-70">Enter the 6-digit code we sent to {email}.</p>

          <div className="mt-4">
            <FormBanner type="error" message={otpBannerError} />
          </div>

          <OtpInput ref={otpRef} onComplete={onOtpComplete} disabled={otpBusy} />
          <FieldError message={otpError} />

          <div className="mt-4">
            <ResendButton onResend={onResendOtp} onError={onResendError} disabled={otpBusy} />
          </div>
        </div>
      </div>
    )
  }

  if (step === 'password') {
    return (
      <div className="page-width page-gutter flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
        <div className="w-full max-w-[440px]">
          <Logo asLink={false} />
          <h1 className="font-display mt-5 text-2xl font-bold text-ink">Set a new password</h1>

          <div className="mt-4">
            <FormBanner type="error" message={passwordFormError} />
          </div>

          <form className="mt-2 space-y-4" onSubmit={onSubmitPassword}>
            <label className="block">
              <span className="text-sm font-medium text-ink">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPasswordFieldError('')
                }}
                onBlur={() => setPasswordFieldError(isValidPassword(newPassword) ? '' : PASSWORD_MESSAGE)}
                autoComplete="new-password"
                required
                className="mt-1.5 h-11 w-full rounded-btn border border-line bg-surface-alt px-3 text-base text-ink"
              />
              <FieldError message={passwordFieldError} />
            </label>
            <Button type="submit" size="lg" className="w-full" disabled={passwordBusy}>
              {passwordBusy ? 'Resetting…' : 'Reset password'}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="page-width page-gutter flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
      <div className="w-full max-w-[440px]">
        <Logo asLink={false} />
        <h1 className="font-display mt-5 text-2xl font-bold text-ink">Reset your password</h1>
        <p className="mt-2 text-sm text-ink-70">Enter your email and we'll send you a code.</p>

        <div className="mt-4">
          <FormBanner type="error" message={emailFormError} />
        </div>

        <form className="mt-2 space-y-4" onSubmit={onSubmitEmail}>
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailFieldError('')
              }}
              onBlur={() => setEmailFieldError(isValidEmail(email) ? '' : EMAIL_MESSAGE)}
              autoComplete="email"
              required
              className="mt-1.5 h-11 w-full rounded-btn border border-line bg-surface-alt px-3 text-base text-ink"
            />
            <FieldError message={emailFieldError} />
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={emailBusy}>
            {emailBusy ? 'Sending…' : 'Send code'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-70">
          <Link to="/login" className="font-medium text-blue hover:underline">
            Back to log in
          </Link>
        </div>
      </div>
    </div>
  )
}
