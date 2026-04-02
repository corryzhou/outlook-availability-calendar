import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import crypto from "crypto";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Admin password tests ─────────────────────────────────────────────────────

describe("admin.verifyPassword", () => {
  it("rejects wrong password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.verifyPassword({ password: "wrong-password-xyz" }))
      .rejects.toThrow();
  });

  it("returns a token when ADMIN_PASSWORD is set and correct", async () => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.warn("ADMIN_PASSWORD not set, skipping test");
      return;
    }
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.verifyPassword({ password: adminPassword });
    expect(result.success).toBe(true);
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(10);
  });

  it("issued token validates correctly", async () => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return;

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const { token } = await caller.admin.verifyPassword({ password: adminPassword });
    const validation = await caller.admin.validateToken({ token });
    expect(validation.valid).toBe(true);
  });

  it("rejects a tampered token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.validateToken({ token: "tampered-token-abc123" });
    expect(result.valid).toBe(false);
  });
});

// ─── Calendar status tests ────────────────────────────────────────────────────

describe("calendar.status", () => {
  it("returns connected=true when ICAL_URL is set", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.calendar.status();
    // If ICAL_URL is set in env, should be connected
    if (process.env.ICAL_URL) {
      expect(result.connected).toBe(true);
    } else {
      expect(result.connected).toBe(false);
    }
  });
});

// ─── Calendar availability validation ────────────────────────────────────────

describe("calendar.getAvailability", () => {
  it("rejects date ranges longer than 31 days", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.calendar.getAvailability({ startDate: "2026-01-01", endDate: "2026-03-01" })
    ).rejects.toThrow("Date range must be 0–31 days");
  });

  it("accepts valid date range and returns day structure", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.calendar.getAvailability({
      startDate: "2026-04-01",
      endDate: "2026-04-07",
    });
    // Should return connected status and days array
    expect(typeof result.connected).toBe("boolean");
    expect(Array.isArray(result.days)).toBe(true);
    if (result.connected && result.days.length > 0) {
      // Each day should have 24 hourly slots
      const firstDay = result.days[0];
      expect(firstDay.slots).toHaveLength(24);
      // Each slot should only have busy boolean — no event titles
      for (const slot of firstDay.slots) {
        expect(typeof slot.busy).toBe("boolean");
        expect(Object.keys(slot)).not.toContain("title");
        expect(Object.keys(slot)).not.toContain("subject");
        expect(Object.keys(slot)).not.toContain("description");
      }
    }
  });
});
