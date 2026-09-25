// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 5 - withTransaction tests
// Author review:

import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { query: vi.fn(), release: vi.fn() };
const connect = vi.fn();
vi.mock("./pool.js", () => ({
  default: { connect: (...args: unknown[]) => connect(...args) },
}));

import { withTransaction } from "./transaction.js";

describe("withTransaction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    connect.mockResolvedValue(client);
    client.query.mockResolvedValue(undefined);
  });

  it("commits and releases the connection normally", async () => {
    await expect(withTransaction(async () => "ok")).resolves.toBe("ok");
    expect(client.query.mock.calls.map((c) => c[0])).toEqual([
      "BEGIN",
      "COMMIT",
    ]);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it("rolls back, rethrows the same error and releases when fn throws", async () => {
    const boom = new Error("boom");
    await expect(
      withTransaction(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(client.query.mock.calls.map((c) => c[0])).toEqual([
      "BEGIN",
      "ROLLBACK",
    ]);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  it("keeps the original error and discards the connection if ROLLBACK fails", async () => {
    const boom = new Error("boom");
    vi.spyOn(console, "error").mockImplementation(() => {});
    client.query.mockImplementation(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("connection lost");
    });
    await expect(
      withTransaction(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
