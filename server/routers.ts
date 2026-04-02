import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  buildAuthUrl,
  getAvailabilityForRange,
  isOutlookConnected,
} from "./outlookService";
import crypto from "crypto";

// ─── Calendar router (public — no auth required) ──────────────────────────────

const calendarRouter = router({
  /**
   * Returns hourly busy/free availability for a date range.
   * PRIVACY: Only boolean busy/free per hour is returned — no event details.
   */
  getAvailability: publicProcedure
    .input(
      z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
      })
    )
    .query(async ({ input }) => {
      const { startDate, endDate } = input;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 31) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Date range must be 0–31 days" });
      }

      const connected = await isOutlookConnected();
      if (!connected) {
        return { connected: false, days: [] };
      }

      const days = await getAvailabilityForRange(startDate, endDate);
      return { connected: true, days };
    }),

  /**
   * Check whether Outlook is connected.
   */
  status: publicProcedure.query(async () => {
    const connected = await isOutlookConnected();
    return { connected };
  }),
});

// ─── Admin password verification ──────────────────────────────────────────────

/** Validate an admin token (HMAC-based, valid for ~1 hour). */
function validateAdminToken(token: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const now = Math.floor(Date.now() / 3600000);
  for (const t of [now, now - 1]) {
    const expected = crypto
      .createHmac("sha256", adminPassword)
      .update(String(t))
      .digest("hex");
    if (
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
    ) {
      return true;
    }
  }
  return false;
}

function requireAdminToken(token: string | undefined) {
  if (!token || !validateAdminToken(token)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "令牌无效或已过期，请重新登录" });
  }
}

const adminRouter = router({
  /**
   * Verify admin password. Returns a short-lived HMAC token on success.
   */
  verifyPassword: publicProcedure
    .input(z.object({ password: z.string() }))
    .mutation(({ input }) => {
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "ADMIN_PASSWORD 未配置，请先在 Secrets 中设置",
        });
      }
      const inputBuf = Buffer.from(input.password);
      const storedBuf = Buffer.from(adminPassword);
      const match =
        inputBuf.length === storedBuf.length &&
        crypto.timingSafeEqual(inputBuf, storedBuf);

      if (!match) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "密码错误" });
      }

      const token = crypto
        .createHmac("sha256", adminPassword)
        .update(String(Math.floor(Date.now() / 3600000)))
        .digest("hex");
      return { success: true, token };
    }),

  /**
   * Validate a previously issued admin session token.
   */
  validateToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => {
      return { valid: validateAdminToken(input.token) };
    }),
});

// ─── Outlook admin router (password-protected) ────────────────────────────────

const outlookRouter = router({
  /**
   * Returns the Outlook OAuth authorization URL.
   * Protected by admin token.
   */
  getAuthUrl: publicProcedure
    .input(z.object({ origin: z.string().url(), token: z.string() }))
    .query(({ input }) => {
      requireAdminToken(input.token);

      const clientId = process.env.OUTLOOK_CLIENT_ID;
      if (!clientId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OUTLOOK_CLIENT_ID 未配置，请先在 Secrets 中添加环境变量",
        });
      }

      const redirectUri = `${input.origin}/api/outlook/callback`;
      const state = "outlook-auth-" + Date.now();
      const url = buildAuthUrl(clientId, redirectUri, state);
      return { url, redirectUri };
    }),

  /**
   * Check connection status. Protected by admin token.
   */
  getStatus: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      requireAdminToken(input.token);
      const connected = await isOutlookConnected();
      return { connected };
    }),
});

// ─── App router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  calendar: calendarRouter,
  admin: adminRouter,
  outlook: outlookRouter,
});

export type AppRouter = typeof appRouter;
