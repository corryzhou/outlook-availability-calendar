/**
 * icalService.ts
 * Fetches and parses an Outlook iCal (.ics) feed.
 *
 * PRIVACY GUARANTEE:
 * - Only start/end times are used to compute busy slots.
 * - Event titles, descriptions, attendees, and all other details are discarded.
 * - The frontend only receives boolean busy/free per hour.
 */

import ICAL from "ical.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  start: string;  // ISO 8601 UTC
  end: string;    // ISO 8601 UTC
  busy: boolean;
}

export interface DayAvailability {
  date: string;   // "YYYY-MM-DD"
  slots: TimeSlot[];
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

      // All-day events (DATE type): mark hours 7–22 as busy for each day they span
      if (event.startDate && event.startDate.isDate) {
        const allDayStart = event.startDate.toJSDate();
        const allDayEnd = event.endDate.toJSDate(); // exclusive end for all-day
        const cursor = new Date(allDayStart);
        while (cursor < allDayEnd) {
          const dateStr = cursor.toISOString().slice(0, 10);
          // Mark 7:00–23:00 (hours 7–22 inclusive = slots 7,8,...,22)
          for (let h = 7; h <= 22; h++) {
            const slotStart = new Date(`${dateStr}T${String(h).padStart(2,'0')}:00:00Z`);
            const slotEnd = new Date(`${dateStr}T${String(h+1).padStart(2,'0')}:00:00Z`);
            if (slotStart < rangeEnd && slotEnd > rangeStart) {
              intervals.push({ start: slotStart, end: slotEnd });
            }
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        continue;
      }

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
 * PRIVACY: only boolean busy/free per hour is returned.
 */
export async function getAvailabilityForRange(
  startDate: string,
  endDate: string
): Promise<DayAvailability[]> {
  const rangeStart = new Date(`${startDate}T00:00:00Z`);
  const rangeEnd = new Date(`${endDate}T23:59:59Z`);

  const intervals = await fetchBusyIntervals(rangeStart, rangeEnd);

  // Build busy-hour sets per date
  const busyHoursMap: Record<string, Set<number>> = {};

  for (const { start, end } of intervals) {
    const cursor = new Date(start);
    cursor.setUTCMinutes(0, 0, 0);
    while (cursor < end) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const hour = cursor.getUTCHours();
      if (!busyHoursMap[dateKey]) busyHoursMap[dateKey] = new Set();
      busyHoursMap[dateKey].add(hour);
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
  }

  // Build result array
  const result: DayAvailability[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const endCursor = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= endCursor) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const busyHours = busyHoursMap[dateKey] ?? new Set();

    const slots: TimeSlot[] = [];
    for (let h = 0; h < 24; h++) {
      const hStr = String(h).padStart(2, "0");
      const hNext = String(h + 1 === 24 ? 23 : h + 1).padStart(2, "0");
      const minSec = h + 1 === 24 ? "59:59" : "00:00";
      slots.push({
        start: `${dateKey}T${hStr}:00:00Z`,
        end: `${dateKey}T${hNext}:${minSec}Z`,
        busy: busyHours.has(h),
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
