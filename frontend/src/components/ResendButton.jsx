/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-22
 * Scope: Created ResendButton, per instructions.md Stage 16b: during cooldown it disables
 *        itself with a countdown read from the service's Retry-After header (surfaced as
 *        err.retryAfterSeconds by api/http.js); on OTP_RESEND_LIMIT it disables itself and
 *        shows the limit text with no countdown, using errorMessages.js's OTP_RESEND_LIMIT
 *        entry so the wording stays centralised. Any other error is handed to the caller via
 *        onError (e.g. NO_PENDING_REGISTRATION, which the decisions table shows as a banner).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import { errorMessages } from '../api/errorMessages'

const DEFAULT_COOLDOWN_SECONDS = 60

export default function ResendButton({ onResend, onError, disabled = false }) {
  const [cooldown, setCooldown] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  const [busy, setBusy] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    timer.current = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer.current)
  }, [cooldown])

  const handleClick = async () => {
    setBusy(true)
    try {
      await onResend()
    } catch (err) {
      if (err.code === 'OTP_RESEND_COOLDOWN') {
        setCooldown(err.retryAfterSeconds ?? DEFAULT_COOLDOWN_SECONDS)
      } else if (err.code === 'OTP_RESEND_LIMIT') {
        setLimitReached(true)
      } else {
        onError?.(err)
      }
    } finally {
      setBusy(false)
    }
  }

  if (limitReached) {
    return <p className="text-sm text-ink-40">{errorMessages.OTP_RESEND_LIMIT.message}</p>
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled || busy || cooldown > 0}
      onClick={handleClick}
    >
      {cooldown > 0 ? 'Resend in ' + cooldown + 's' : busy ? 'Sending…' : 'Resend code'}
    </Button>
  )
}
