// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 5a - OTP generation test
// Author review:

import { describe, expect, it } from "vitest";
import { generateOtp } from "./otp.js";

describe("generateOtp", () => {
  it("always returns exactly 6 digits", () => {
    for (let i = 0; i < 10_000; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });
});
