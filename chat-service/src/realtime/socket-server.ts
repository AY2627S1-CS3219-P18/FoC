/*
 * AI Assistance Disclosure:
 * Tool: Codex (model: GPT-6), date: 2026-11-08
 * Scope: Implemented the team-specified message sending and realtime delivery.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */
import type { Server as HttpServer } from "node:http";
import { Server, type ServerOptions } from "socket.io";
import type {
  TokenVerifier,
  VerifiedToken,
} from "../middleware/authenticate.js";
// Connection and JWT lifecycle follow order-service/src/realtime/socket-server.ts.
export function createSocketServer(
  httpServer: HttpServer,
  {
    verifyToken,
    options = {},
  }: { verifyToken: TokenVerifier; options?: Partial<ServerOptions> },
): Server {
  const io = new Server(httpServer, { transports: ["websocket"], ...options });
  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== "string" || token === "") {
      next(new Error("unauthorized"));
      return;
    }
    try {
      socket.data.user = await verifyToken(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });
  io.on("connection", async (socket) => {
    const { user_id: userId, exp } = socket.data.user as VerifiedToken;
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, exp * 1000 - Date.now()),
    );
    socket.on("disconnect", () => clearTimeout(expiry));
    await socket.join(`user:${userId}`);
    socket.emit("ready");
    // Conversation subscription/unsubscription is deferred by the team.
  });
  return io;
}
