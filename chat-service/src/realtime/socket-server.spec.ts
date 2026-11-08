/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-08
 * Scope: Verified socket authentication, expiry, room isolation and union broadcasts.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import { createServer } from "node:http";
import { io as connect, type Socket } from "socket.io-client";
import { createSocketServer } from "./socket-server.js";
import { createMessagePublisher, type SentMessage } from "./messages.js";
import type { TokenVerifier } from "../middleware/authenticate.js";
async function setup(
  verifyToken: TokenVerifier = async (token) => {
    if (token === "bad") throw new Error("invalid");
    return {
      user_id: token,
      role: "student",
      exp: Math.floor(Date.now() / 1000) + 60,
    };
  },
) {
  const http = createServer();
  const io = createSocketServer(http, { verifyToken });
  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const clients: Socket[] = [];
  const client = (token?: string) => {
    const socket = connect(`http://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      auth: token === undefined ? {} : { token },
      reconnection: false,
      autoConnect: false,
    });
    clients.push(socket);
    return socket;
  };
  const ready = (socket: Socket) =>
    new Promise<void>((resolve, reject) => {
      socket.once("ready", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });
  const close = async () => {
    clients.forEach((c) => c.disconnect());
    await io.close();
  };
  return { io, client, ready, close };
}
it.each([undefined, "", "bad"])(
  "rejects invalid handshake token %j",
  async (token) => {
    const t = await setup();
    try {
      const client = t.client(token);
      const error = new Promise<Error>((resolve) =>
        client.once("connect_error", resolve),
      );
      client.connect();
      expect((await error).message).toBe("unauthorized");
      expect(t.io.sockets.sockets.size).toBe(0);
    } finally {
      await t.close();
    }
  },
);
it("joins only the verified user's room and broadcasts once to the union of target rooms", async () => {
  const t = await setup();
  try {
    const a = t.client("a"),
      b = t.client("b");
    await Promise.all([t.ready(a), t.ready(b)]);
    const serverA = t.io.sockets.sockets.get(a.id!)!;
    expect([...serverA.rooms]).toEqual([a.id, "user:a"]);
    expect(t.io.sockets.sockets.get(b.id!)!.rooms.has("user:a")).toBe(false);
    // Test-only room join; production subscription handlers are deliberately deferred.
    await serverA.join("chat:c");
    let received = 0;
    a.on("message:sent", () => {
      received++;
    });
    const message: SentMessage = {
      messageId: "m",
      conversationId: "c",
      senderId: "a",
      type: "TEXT",
      content: "hello",
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    const gotA = new Promise<unknown>((resolve) =>
      a.once("message:sent", resolve),
    );
    const gotB = new Promise<unknown>((resolve) =>
      b.once("message:sent", resolve),
    );
    createMessagePublisher(t.io)(message, ["a", "b"]);
    expect(await gotA).toEqual(message);
    expect(await gotB).toEqual(message);
    // A subsequent acknowledged event fences the earlier delivery on this socket.
    t.io.to("user:a").emit("fence");
    await new Promise<void>((resolve) => a.once("fence", resolve));
    expect(received).toBe(1);
  } finally {
    await t.close();
  }
});
it("disconnects authenticated sockets at token expiry", async () => {
  const t = await setup(async () => ({
    user_id: "a",
    role: "student",
    exp: (Date.now() + 150) / 1000,
  }));
  try {
    const client = t.client("valid");
    await t.ready(client);
    const reason = await new Promise<string>((resolve) =>
      client.once("disconnect", resolve),
    );
    expect(reason).toBe("io server disconnect");
  } finally {
    await t.close();
  }
});
