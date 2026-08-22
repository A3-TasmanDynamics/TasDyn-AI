import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db } from "./database";
import { Syslog } from "./syslog";

/**
 * A minimal, opt-in HTTP API for TasDyn-Web's admin panel to read from. TasDyn-AI is a Discord
 * bot with no other reason to accept inbound connections, so this stays out of the modules/*
 * self-registering pattern (it's a process-level concern, not a Discord command/event) and only
 * starts at all when both API_PORT and API_TOKEN are set — unset, the bot behaves exactly as it
 * did before this file existed. No inbound port is opened by default.
 */

const AUDIT_LOG_DIR = path.join(process.cwd(), "audit_logs");

function readRecentAuditLogs(limit: number): unknown[] {
  if (!fs.existsSync(AUDIT_LOG_DIR)) return [];

  const files = fs
    .readdirSync(AUDIT_LOG_DIR)
    .filter((f) => f.startsWith("audit-") && f.endsWith(".json"))
    .sort()
    .reverse();

  const entries: unknown[] = [];
  for (const file of files) {
    if (entries.length >= limit) break;
    const lines = fs
      .readFileSync(path.join(AUDIT_LOG_DIR, file), "utf-8")
      .split("\n")
      .filter(Boolean);

    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      try {
        entries.push(JSON.parse(lines[i]));
      } catch {
        // Skip a malformed line rather than failing the whole request.
      }
    }
  }
  return entries;
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch rather than returning false.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function startApiServer() {
  const port = process.env.API_PORT;
  const token = process.env.API_TOKEN;

  if (!port || !token) {
    Syslog.info("api_server", "API_PORT/API_TOKEN not set — HTTP API stays disabled.");
    return null;
  }

  const server = createServer((req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    const url = new URL(req.url ?? "/", "http://internal");

    if (url.pathname === "/api/health") {
      return send(200, { ok: true });
    }

    const authHeader = req.headers.authorization ?? "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!provided || !tokensMatch(provided, token)) {
      return send(401, { error: "Unauthorized" });
    }

    try {
      if (url.pathname === "/api/stats" && req.method === "GET") {
        const members = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
        const openTickets = db
          .prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'")
          .get() as { count: number };
        const closedTickets = db
          .prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'closed'")
          .get() as { count: number };

        return send(200, {
          members: members.count,
          tickets: { open: openTickets.count, closed: closedTickets.count },
        });
      }

      if (url.pathname === "/api/tickets" && req.method === "GET") {
        const status = url.searchParams.get("status") ?? "open";
        const rows = db
          .prepare(
            "SELECT id, channelId, creatorId, subject, status, createdAt, closedAt FROM tickets WHERE status = ? ORDER BY createdAt DESC LIMIT 100"
          )
          .all(status);
        return send(200, { tickets: rows });
      }

      if (url.pathname === "/api/audit-logs" && req.method === "GET") {
        const requested = Number(url.searchParams.get("limit") ?? "50");
        const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 50, 500);
        return send(200, { entries: readRecentAuditLogs(limit) });
      }

      return send(404, { error: "Not found" });
    } catch (error) {
      Syslog.error("api_server", "Request handler failure", error);
      return send(500, { error: "Internal error" });
    }
  });

  server.listen(Number(port), () => {
    Syslog.success("api_server", `HTTP API listening on :${port} (bearer-token protected, local-only).`);
  });

  return server;
}
