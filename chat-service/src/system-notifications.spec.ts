/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-08
 * Scope: Tested the team-specified system notification endpoint.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import request from "supertest";
import { createApp } from "./app.js";
import type { PrismaClient } from "./db/prisma.js";
const id = "0192f0c4-0000-7000-8000-000000000001";
const userId = "0192f0c4-0000-7000-8000-00000000000a";
function setup() {
  const findOrder = vi.fn().mockResolvedValue({ conversationId: id });
  const findUnique = vi.fn().mockResolvedValue({
    status: "ACTIVE",
    participants: [
      { userId, revokedAt: null },
      { userId: id, revokedAt: new Date() },
    ],
  });
  const create = vi
    .fn()
    .mockImplementation(async ({ data }) => ({ ...data, id, metadata: null }));
  const update = vi.fn().mockResolvedValue({});
  let committed = false;
  const transaction = vi.fn().mockImplementation(async (fn) => {
    const result = await fn({
      conversation: { findUnique, update },
      message: { create },
    });
    committed = true;
    return result;
  });
  const publish = vi.fn().mockImplementation(() => {
    expect(committed).toBe(true);
  });
  const app = createApp({
    prisma: {
      conversation: { findUnique: findOrder },
      $transaction: transaction,
    } as unknown as PrismaClient,
    apiKey: "test",
    publish,
    verifyToken: async (token) => {
      if (token !== "valid") throw new Error("invalid");
      return { user_id: userId, role: "student", exp: 9999999999 };
    },
  });
  const post = (body: object = { orderId: id, message: "  Order ready  " }) =>
    request(app)
      .post("/chat/send-system-notification")
      .set("X-Service-Key", "test")
      .send(body);
  return {
    app,
    post,
    findOrder,
    findUnique,
    create,
    update,
    transaction,
    publish,
  };
}
it("looks up the order, persists SYSTEM and publishes the returned message after commit", async () => {
  const t = setup();
  const response = await t.post();
  expect(response.status).toBe(201);
  expect(t.findOrder).toHaveBeenCalledWith({
    where: { orderId: id },
    select: { conversationId: true },
  });
  expect(response.body).toEqual({
    messageId: id,
    conversationId: id,
    senderId: null,
    type: "SYSTEM",
    content: "  Order ready  ",
    metadata: null,
    createdAt: expect.any(String),
  });
  expect(t.create).toHaveBeenCalledWith({
    data: {
      chatId: id,
      senderId: null,
      type: "SYSTEM",
      content: "  Order ready  ",
      createdAt: expect.any(Date),
    },
  });
  expect(t.update).toHaveBeenCalledWith({
    where: { conversationId: id },
    data: { updatedAt: new Date(response.body.createdAt) },
  });
  expect(t.publish).toHaveBeenCalledWith(response.body, [userId]);
});
it.each([
  {},
  { orderId: "bad", message: "hello" },
  { orderId: id },
  { orderId: id, message: "" },
  { orderId: id, message: " \n " },
  { orderId: id, message: 1 },
])("rejects invalid input %j", async (body) => {
  const t = setup();
  expect((await t.post(body)).status).toBe(400);
  expect(t.findOrder).not.toHaveBeenCalled();
});
it.each([
  [undefined, undefined, 401],
  [undefined, "valid", 403],
  [undefined, "invalid", 401],
  ["wrong", "valid", 401],
  ["test", "invalid", 201],
])("checks key %s and token %s", async (key, token, status) => {
  const t = setup();
  const req = request(t.app).post("/chat/send-system-notification");
  if (key) req.set("X-Service-Key", String(key));
  if (token) req.set("Authorization", `Bearer ${token}`);
  expect((await req.send({ orderId: id, message: "hello" })).status).toBe(
    status,
  );
  if (status !== 201) expect(t.findOrder).not.toHaveBeenCalled();
});
it.each(["missing order", "missing conversation", "archived"])(
  "rejects %s",
  async (scenario) => {
    const t = setup();
    if (scenario === "missing order") t.findOrder.mockResolvedValue(null);
    if (scenario === "missing conversation")
      t.findUnique.mockResolvedValue(null);
    if (scenario === "archived")
      t.findUnique.mockResolvedValue({ status: "ARCHIVED", participants: [] });
    expect((await t.post()).status).toBe(scenario === "archived" ? 409 : 404);
    expect(t.create).not.toHaveBeenCalled();
    expect(t.publish).not.toHaveBeenCalled();
  },
);
it.each(["lookup", "insert", "update", "broadcast"])(
  "handles %s failure",
  async (stage) => {
    const t = setup();
    const target = {
      lookup: t.findOrder,
      insert: t.create,
      update: t.update,
      broadcast: t.publish,
    }[stage]!;
    target.mockImplementation(() => {
      throw new Error("failure");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await t.post()).status).toBe(stage === "broadcast" ? 201 : 500);
      if (stage !== "broadcast") expect(t.publish).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  },
);
