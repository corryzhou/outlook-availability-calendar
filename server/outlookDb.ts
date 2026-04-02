import { drizzle } from "drizzle-orm/mysql2";
import { outlookTokens, InsertOutlookToken, OutlookToken } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Upsert the owner's Outlook OAuth token (only one row ever exists).
 */
export async function upsertOutlookToken(token: Omit<InsertOutlookToken, "id" | "createdAt" | "updatedAt">): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing and insert fresh to keep it simple
  await db.delete(outlookTokens);
  await db.insert(outlookTokens).values(token);
}

/**
 * Retrieve the stored Outlook token (returns null if not configured).
 */
export async function getOutlookToken(): Promise<OutlookToken | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(outlookTokens).limit(1);
  return rows[0] ?? null;
}

/**
 * Update only the access token and expiry (after a refresh).
 */
export async function updateAccessToken(accessToken: string, expiresAt: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(outlookTokens).set({ accessToken, expiresAt });
}
