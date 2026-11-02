/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-23
 * Scope: Created the /account page, per instructions.md Stage 16e: a profile section plus
 *        three independent change sections (username, email, password), each a local
 *        sub-component with its own form/OTP state so one section's in-progress edit can't leak
 *        into another's. Email and password changes show their OTP step inline in the same
 *        section per the spec, reusing OtpInput/ResendButton/FieldError/FormBanner as the other
 *        auth pages do. A successful password change calls AuthContext's new forceReauth
 *        instead of updateUser, since the backend has already revoked every session for this
 *        user by that point.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useRef, useState } from 'react'
import Button from '../components/Button'
import FieldError from '../components/FieldError'
import FormBanner from '../components/FormBanner'
import OtpInput from '../components/OtpInput'
import ResendButton from '../components/ResendButton'
import * as profileApi from '../api/profile'
import { describeError, errorMessages } from '../api/errorMessages'
import {
  EMAIL_MESSAGE,
  PASSWORD_MESSAGE,
  USERNAME_MESSAGE,
  isValidEmail,
  isValidPassword,
  isValidUsername,
} from '../utils/validation'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'mt-1.5 h-11 w-full rounded-btn border border-line bg-surface-alt px-3 text-base text-ink'

function Section({ title, children }) {
  return (
    <section className="rounded-card border border-line p-5">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ProfileSection({ user }) {
  return (
    <Section title="Profile">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-70">Username</dt>
          <dd className="font-medium text-ink">{user.username}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-70">Email</dt>
          <dd className="font-medium text-ink">{user.email}</dd>
        </div>
      </dl>
    </Section>
  )
}

function UsernameSection({ username, updateUser }) {
  const [value, setValue] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [banner, setBanner] = useState({ type: 'error', message: '' })
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    const error = isValidUsername(value) ? '' : USERNAME_MESSAGE
    setFieldError(error)
    if (error) return

    setBanner({ type: 'error', message: '' })
    setBusy(true)
    try {
      const profile = await profileApi.changeUsername(value)
      updateUser({ username: profile.username })
      setBanner({ type: 'success', message: 'Username updated.' })
      setValue('')
    } catch (err) {
      if (err.code === 'USERNAME_UNCHANGED' || err.code === 'USERNAME_TAKEN') {
        setFieldError(errorMessages[err.code].message)
      } else {
        setBanner({ type: 'error', message: describeError(err).message })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Change username">
      <p className="mb-3 text-sm text-ink-70">Current: {username}</p>
      <FormBanner type={banner.type} message={banner.message} />
      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-ink">New username</span>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setFieldError('')
            }}
            autoComplete="username"
            className={inputClass}
          />
          <FieldError message={fieldError} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save username'}
        </Button>
      </form>
    </Section>
  )
}

function EmailSection({ email, updateUser }) {
  const [stage, setStage] = useState('form') // 'form' | 'otp'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [emailFieldError, setEmailFieldError] = useState('')
  const [banner, setBanner] = useState({ type: 'error', message: '' })
  const [busy, setBusy] = useState(false)

  const [otpError, setOtpError] = useState('')
  const [otpBanner, setOtpBanner] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const otpRef = useRef(null)

  const onSubmitForm = async (e) => {
    e.preventDefault()
    const pwError = currentPassword ? '' : 'Enter your current password.'
    const emError = isValidEmail(newEmail) ? '' : EMAIL_MESSAGE
    setPasswordError(pwError)
    setEmailFieldError(emError)
    if (pwError || emError) return

    setBanner({ type: 'error', message: '' })
    setBusy(true)
    try {
      await profileApi.changeEmail({ currentPassword, newEmail })
      setStage('otp')
    } catch (err) {
      if (err.code === 'INVALID_PASSWORD') {
        setPasswordError(errorMessages.INVALID_PASSWORD.message)
      } else if (err.code === 'EMAIL_UNCHANGED' || err.code === 'EMAIL_TAKEN') {
        setEmailFieldError(errorMessages[err.code].message)
      } else {
        setBanner({ type: 'error', message: describeError(err).message })
      }
    } finally {
      setBusy(false)
    }
  }

  const onOtpComplete = async (code) => {
    setOtpError('')
    setOtpBanner('')
    setOtpBusy(true)
    try {
      await profileApi.verifyEmailChangeOtp(code)
      updateUser({ email: newEmail })
      setStage('form')
      setCurrentPassword('')
      setNewEmail('')
      setBanner({ type: 'success', message: 'Email updated.' })
    } catch (err) {
      if (err.code === 'INVALID_OTP') {
        otpRef.current?.reset()
        setOtpError(errorMessages.INVALID_OTP.message)
      } else if (err.code === 'OTP_EXPIRED' || err.code === 'OTP_ATTEMPTS_EXCEEDED') {
        setOtpError(errorMessages[err.code].message + ' Use resend below.')
      } else {
        setOtpBanner(describeError(err).message)
      }
    } finally {
      setOtpBusy(false)
    }
  }

  const onResend = () => profileApi.resendMeOtp('change_email')
  const onResendError = (err) => setOtpBanner(describeError(err).message)

  if (stage === 'otp') {
    return (
      <Section title="Change email">
        <p className="mb-3 text-sm text-ink-70">Enter the 6-digit code we sent to {newEmail}.</p>
        <FormBanner type="error" message={otpBanner} />
        <OtpInput ref={otpRef} onComplete={onOtpComplete} disabled={otpBusy} />
        <FieldError message={otpError} />
        <div className="mt-4">
          <ResendButton onResend={onResend} onError={onResendError} disabled={otpBusy} />
        </div>
      </Section>
    )
  }

  return (
    <Section title="Change email">
      <p className="mb-3 text-sm text-ink-70">Current: {email}</p>
      <FormBanner type={banner.type} message={banner.message} />
      <form className="space-y-3" onSubmit={onSubmitForm}>
        <label className="block">
          <span className="text-sm font-medium text-ink">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setPasswordError('')
            }}
            autoComplete="current-password"
            className={inputClass}
          />
          <FieldError message={passwordError} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">New email</span>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value)
              setEmailFieldError('')
            }}
            autoComplete="email"
            className={inputClass}
          />
          <FieldError message={emailFieldError} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending code…' : 'Save email'}
        </Button>
      </form>
    </Section>
  )
}

function PasswordSection({ forceReauth }) {
  const [stage, setStage] = useState('form') // 'form' | 'otp'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [currentPasswordError, setCurrentPasswordError] = useState('')
  const [newPasswordError, setNewPasswordError] = useState('')
  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [otpError, setOtpError] = useState('')
  const [otpBanner, setOtpBanner] = useState('')
  const [otpBusy, setOtpBusy] = useState(false)
  const otpRef = useRef(null)

  const onSubmitForm = async (e) => {
    e.preventDefault()
    const curError = currentPassword ? '' : 'Enter your current password.'
    const newError = isValidPassword(newPassword) ? '' : PASSWORD_MESSAGE
    setCurrentPasswordError(curError)
    setNewPasswordError(newError)
    if (curError || newError) return

    setBanner('')
    setBusy(true)
    try {
      await profileApi.changePassword({ currentPassword, newPassword })
      setStage('otp')
    } catch (err) {
      if (err.code === 'INVALID_PASSWORD') {
        setCurrentPasswordError(errorMessages.INVALID_PASSWORD.message)
      } else if (err.code === 'PASSWORD_UNCHANGED') {
        setNewPasswordError(errorMessages.PASSWORD_UNCHANGED.message)
      } else {
        setBanner(describeError(err).message)
      }
    } finally {
      setBusy(false)
    }
  }

  const onOtpComplete = async (code) => {
    setOtpError('')
    setOtpBanner('')
    setOtpBusy(true)
    try {
      await profileApi.confirmPasswordChange({ otp: code, newPassword })
      forceReauth('Password changed. Please sign in again with your new password.')
    } catch (err) {
      if (err.code === 'INVALID_OTP') {
        otpRef.current?.reset()
        setOtpError(errorMessages.INVALID_OTP.message)
      } else if (err.code === 'OTP_EXPIRED' || err.code === 'OTP_ATTEMPTS_EXCEEDED') {
        setOtpError(errorMessages[err.code].message + ' Use resend below.')
      } else {
        setOtpBanner(describeError(err).message)
      }
    } finally {
      setOtpBusy(false)
    }
  }

  const onResend = () => profileApi.resendMeOtp('change_password')
  const onResendError = (err) => setOtpBanner(describeError(err).message)

  if (stage === 'otp') {
    return (
      <Section title="Change password">
        <p className="mb-3 text-sm text-ink-70">Enter the 6-digit code we sent to your email.</p>
        <FormBanner type="error" message={otpBanner} />
        <OtpInput ref={otpRef} onComplete={onOtpComplete} disabled={otpBusy} />
        <FieldError message={otpError} />
        <div className="mt-4">
          <ResendButton onResend={onResend} onError={onResendError} disabled={otpBusy} />
        </div>
      </Section>
    )
  }

  return (
    <Section title="Change password">
      <FormBanner type="error" message={banner} />
      <form className="space-y-3" onSubmit={onSubmitForm}>
        <label className="block">
          <span className="text-sm font-medium text-ink">Current password</span>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value)
              setCurrentPasswordError('')
            }}
            autoComplete="current-password"
            className={inputClass}
          />
          <FieldError message={currentPasswordError} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-ink">New password</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              setNewPasswordError('')
            }}
            autoComplete="new-password"
            className={inputClass}
          />
          <FieldError message={newPasswordError} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending code…' : 'Save password'}
        </Button>
      </form>
    </Section>
  )
}

export default function Account() {
  const { user, updateUser, forceReauth } = useAuth()

  return (
    <div className="page-width page-gutter max-w-[640px] py-10">
      <h1 className="font-display text-2xl font-bold text-ink">Account</h1>
      <div className="mt-6 space-y-6">
        <ProfileSection user={user} />
        <UsernameSection username={user.username} updateUser={updateUser} />
        <EmailSection email={user.email} updateUser={updateUser} />
        <PasswordSection forceReauth={forceReauth} />
      </div>
    </div>
  )
}
