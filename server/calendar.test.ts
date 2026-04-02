import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the outlookService module
vi.mock("./outlookService", () => ({
  isOutlookConnected: vi.fn().mockResolvedValue(false),
  getAvailabilityForRange: vi.fn().mockResolvedValue([]),
  buildAuthUrl: vi.fn().mockReturnValue("https://login.microsoftonline.com/authorize?..."),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("calendar.getAvailability", () => {
  it("returns not connected when Outlook is not configured", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.calendar.getAvailability({
      startDate: "2026-04-01",
      endDate: "2026-04-07",
    });

    expect(result).toEqual({ connected: false, days: [] });
  });

  it("rejects date ranges longer than 31 days", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.calendar.getAvailability({
        startDate: "2026-01-01",
        endDate: "2026-03-01",
      })
    ).rejects.toThrow("Date range must be 0–31 days");
  });

  it("validates date format", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.calendar.getAvailability({
        startDate: "not-a-date",
        endDate: "2026-04-07",
      })
    ).rejects.toThrow();
  });
});

describe("calendar.status", () => {
  it("returns connection status", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.calendar.status();
    expect(result).toEqual({ connected: false });
  });
});

describe("outlook.getStatus (protected)", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.outlook.getStatus()).rejects.toThrow();
  });
});
