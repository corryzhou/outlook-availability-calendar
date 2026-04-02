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
 * busyHoursMap key = "YYYY-MM-DD" in Beijing local date.
 * Slot.start encodes Beijing hour in the UTC position so the frontend can
 * read it with getUTCHours() without any further conversion.
 */

import ICAL from "ical.js";

const CST_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8 = 28800000 ms

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeSlot {
  start: string;  // ISO string — UTC hour field encodes Beijing hour
  end: string;
  busy: boolean;
}

export interface DayAvailability {
  date: string;   // "YYYY-MM-DD" Beijing local date
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
 * Returns two separate lists:
 *  - allDayDates: Beijing date strings for all-day events (mark 7–22 as busy)
 *  - timedIntervals: { start: Date, end: Date } for timed events
 */
async function fetchEvents(
  rangeStartUtc: Date,
  rangeEndUtc: Date
): Promise<{
  allDayDates: string[];           // "YYYY-MM-DD" Beijing dates
  timedIntervals: { start: Date; end: Date }[];
}> {
  const url = getIcalUrl();
  if (!url) return { allDayDates: [], timedIntervals: [] };

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

  const allDayDates: string[] = [];
  const timedIntervals: { start: Date; end: Date }[] = [];

  // Range as Beijing date strings for filtering all-day events
  const rangeStartBeijingDate = toBeijingDateStr(rangeStartUtc);
  const rangeEndBeijingDate = toBeijingDateStr(rangeEndUtc);

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);

      // ── All-day events (DATE type, no time component) ──
      if (event.startDate && event.startDate.isDate) {
        // iCal DATE values are pure calendar dates with no timezone.
        // Treat them directly as Beijing local dates.
        const startStr = event.startDate.toString().slice(0, 10); // "YYYY-MM-DD"
        const endStr   = event.endDate.toString().slice(0, 10);   // exclusive end date

        // Iterate each calendar day of the all-day event
        const cursor = new Date(`${startStr}T00:00:00Z`);
        const endLimit = new Date(`${endStr}T00:00:00Z`);

        while (cursor < endLimit) {
          const dateStr = cursor.toISOString().slice(0, 10); // "YYYY-MM-DD"
          // Only include dates within our query range
          if (dateStr >= rangeStartBeijingDate && dateStr <= rangeEndBeijingDate) {
            allDayDates.push(dateStr);
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        continue;
      }

      // ── Timed events ──
      if (event.isRecurring()) {
        const iter = event.iterator();
        let next = iter.next();
        let safetyCount = 0;
        while (next && safetyCount < 500) {
          safetyCount++;
          const start = next.toJSDate();
          if (start > rangeEndUtc) break;
          const durationSec = event.duration.toSeconds();
          const end = new Date(start.getTime() + durationSec * 1000);
          if (end >= rangeStartUtc) {
            timedIntervals.push({ start, end });
          }
          next = iter.next();
        }
      } else {
        const start = event.startDate.toJSDate();
        const end = event.endDate.toJSDate();
        if (start < rangeEndUtc && end > rangeStartUtc) {
          timedIntervals.push({ start, end });
        }
      }
    } catch {
      // Skip malformed events silently
    }
  }

  return { allDayDates, timedIntervals };
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
  const rangeStartUtc = new Date(`${startDate}T00:00:00+08:00`);
  const rangeEndUtc   = new Date(`${endDate}T23:59:59+08:00`);

  const { allDayDates, timedIntervals } = await fetchEvents(rangeStartUtc, rangeEndUtc);

  // Build busy-hour sets per Beijing date
  // Key: "YYYY-MM-DD" (Beijing), Value: Set of Beijing hours (0-23)
  const busyHoursMap: Record<string, Set<number>> = {};

  // ── All-day events: mark Beijing hours 7–22 as busy ──
  for (const dateStr of allDayDates) {
    if (!busyHoursMap[dateStr]) busyHoursMap[dateStr] = new Set();
    for (let h = 7; h <= 22; h++) {
      busyHoursMap[dateStr].add(h);
    }
  }

  // ── Timed events: walk UTC hours, convert to Beijing date+hour ──
  for (const { start, end } of timedIntervals) {
    const cursor = new Date(start);
    cursor.setUTCMinutes(0, 0, 0); // round down to hour boundary

    while (cursor < end) {
      const beijingDate = toBeijingDateStr(cursor);
      const beijingHour = toBeijingHour(cursor);

      if (!busyHoursMap[beijingDate]) busyHoursMap[beijingDate] = new Set();
      busyHoursMap[beijingDate].add(beijingHour);

      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
  }

  // ── Build result array — one entry per Beijing calendar day ──
  const result: DayAvailability[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const endCursor = new Date(`${endDate}T00:00:00Z`);

  while (cursor <= endCursor) {
    const dateKey = cursor.toISOString().slice(0, 10); // "YYYY-MM-DD"
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
