/**
 * icalService.ts
 * Fetches and parses an Outlook iCal (.ics) feed.
 *
 * PRIVACY GUARANTEE:
 * - Only start/end times are used to compute busy slots.
 * - Event titles, descriptions, attendees, and all other details are discarded.
 * - The frontend only receives boolean busy/free per hour.
 *
 * TIMEZONE: All date/hour calculations are done in Beijing Time (UTC+8).
 * The frontend receives date strings ("YYYY-MM-DD") and hour numbers (0-23)
 * in Beijing Time. Slot.start is kept as a UTC ISO string for compatibility
 * but the hour encoded in it represents Beijing local hour.
 */

import ICAL from "ical.js";

const CST_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  start: string;  // ISO string — hour in UTC represents Beijing hour
  end: string;
  busy: boolean;
}

export interface DayAvailability {
  date: string;   // "YYYY-MM-DD" in Beijing Time
  slots: TimeSlot[];
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────

/** Convert a UTC Date to Beijing local date string "YYYY-MM-DD" */
function toBeijingDateStr(utcDate: Date): string {
  const cst = new Date(utcDate.getTime() + CST_OFFSET_MS);
  return cst.toISOString().slice(0, 10);
}

/** Get Beijing local hour (0-23) from a UTC Date */
function toBeijingHour(utcDate: Date): number {
  const cst = new Date(utcDate.getTime() + CST_OFFSET_MS);
  return cst.getUTCHours();
}

/** Build a slot start ISO string that encodes Beijing hour in UTC position */
function makeSlotStart(beijingDateStr: string, beijingHour: number): string {
  return `${beijingDateStr}T${String(beijingHour).padStart(2, "0")}:00:00Z`;
}

// ─── iCal helpers ─────────────────────────────────────────────────────────────

function getIcalUrl(): string | null {
  return process.env.ICAL_URL ?? null;
}

export async function isOutlookConnected(): Promise<boolean> {
  return !!getIcalUrl();
}

/**
 * Fetch and parse the iCal feed.
 * Returns only { start: Date, end: Date } — all other event data is discarded.
 */
async function fetchBusyIntervals(
  rangeStart: Date,
  rangeEnd: Date
): Promise<{ start: Date; end: Date }[]> {
  const url = getIcalUrl();
  if (!url) return [];

  const response = await fetch(url, {
    headers: { "User-Agent": "CalendarAvailabilityBot/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch iCal feed: ${response.status} ${response.statusText}`);
  }

  const icsText = await response.text();
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  const intervals: { start: Date; end: Date }[] = [];

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);

      // All-day events (DATE type): mark Beijing hours 7–22 as busy for each day
      if (event.startDate && event.startDate.isDate) {
        // All-day event dates are local calendar dates (no timezone)
        // Use the date string directly as Beijing date
        const allDayStartStr = event.startDate.toString().slice(0, 10); // "YYYY-MM-DD"
        const allDayEndStr = event.endDate.toString().slice(0, 10);     // exclusive

        const cursor = new Date(`${allDayStartStr}T00:00:00Z`);
        const endLimit = new Date(`${allDayEndStr}T00:00:00Z`);

        while (cursor < endLimit) {
          const dateStr = cursor.toISOString().slice(0, 10);
          // Mark Beijing hours 7–22 (slot 7→8, ..., 22→23)
          for (let h = 7; h <= 22; h++) {
            // Encode as UTC slot where UTC hour = Beijing hour (frontend reads it this way)
            const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00Z`);
            const slotEnd   = new Date(`${dateStr}T${String(h + 1).padStart(2, '0')}:00:00Z`);
            // Check against range (range is also in Beijing-date-based UTC)
            if (slotStart < rangeEnd && slotEnd > rangeStart) {
              intervals.push({ start: slotStart, end: slotEnd });
            }
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        continue;
      }

      // Timed events: use actual UTC timestamps
      if (event.isRecurring()) {
        const iter = event.iterator();
        let next = iter.next();
        let safetyCount = 0;
        while (next && safetyCount < 500) {
          safetyCount++;
          const start = next.toJSDate();
          if (start > rangeEnd) break;
          const durationSec = event.duration.toSeconds();
          const end = new Date(start.getTime() + durationSec * 1000);
          if (end >= rangeStart) {
            intervals.push({ start, end });
          }
          next = iter.next();
        }
      } else {
        const start = event.startDate.toJSDate();
        const end = event.endDate.toJSDate();
        if (start < rangeEnd && end > rangeStart) {
          intervals.push({ start, end });
        }
      }
    } catch {
      // Skip malformed events silently
    }
  }

  return intervals;
}

/**
 * Main export: returns hourly busy/free data for a date range.
 * All dates and hours are in Beijing Time (UTC+8).
 * PRIVACY: only boolean busy/free per hour is returned.
 */
export async function getAvailabilityForRange(
  startDate: string,  // "YYYY-MM-DD" Beijing date
  endDate: string     // "YYYY-MM-DD" Beijing date
): Promise<DayAvailability[]> {
  // Range in UTC: Beijing midnight = UTC 16:00 previous day
  // To be safe, expand range by one day on each side
  const rangeStartUtc = new Date(`${startDate}T00:00:00+08:00`);
  const rangeEndUtc   = new Date(`${endDate}T23:59:59+08:00`);

  const intervals = await fetchBusyIntervals(rangeStartUtc, rangeEndUtc);

  // Build busy-hour sets per Beijing date
  // Key: "YYYY-MM-DD" (Beijing), Value: Set of Beijing hours (0-23)
  const busyHoursMap: Record<string, Set<number>> = {};

  for (const { start, end } of intervals) {
    // Walk through each UTC hour covered by this interval
    // and convert to Beijing date + hour
    const cursor = new Date(start);
    // Round down to the start of the UTC hour
    cursor.setUTCMinutes(0, 0, 0);

    while (cursor < end) {
      const beijingDate = toBeijingDateStr(cursor);
      const beijingHour = toBeijingHour(cursor);

      if (!busyHoursMap[beijingDate]) busyHoursMap[beijingDate] = new Set();
      busyHoursMap[beijingDate].add(beijingHour);

      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
  }

  // Build result array — one entry per Beijing calendar day
  const result: DayAvailability[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const endCursor = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= endCursor) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const busyHours = busyHoursMap[dateKey] ?? new Set();

    const slots: TimeSlot[] = [];
    for (let h = 0; h < 24; h++) {
      slots.push({
        start: makeSlotStart(dateKey, h),
        end:   makeSlotStart(dateKey, h === 23 ? 23 : h + 1),
        busy:  busyHours.has(h),
      });
    }

    result.push({ date: dateKey, slots });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

// Stub exports kept for backward compatibility with routers.ts
export function buildAuthUrl(_c: string, _r: string, _s: string): string { return ""; }
export async function exchangeCodeForToken(): Promise<void> {}
