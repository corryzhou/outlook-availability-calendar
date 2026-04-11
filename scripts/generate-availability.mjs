/**
 * generate-availability.mjs
 *
 * Standalone Node.js script (ESM, no TypeScript, no build step).
 * Fetches the Outlook ICS feed from ICAL_URL env var, parses events,
 * and writes availability JSON to stdout.
 *
 * Output format:
 * {
 *   "generated": "<ISO timestamp>",
 *   "connected": true,
 *   "days": [{ "date": "YYYY-MM-DD", "slots": [...] }]
 * }
 *
 * Runs via GitHub Actions. Covers current month -2 to +6 months.
 * All dates/hours in Beijing Time (UTC+8).
 */

import ICAL from "ical.js";

const CST_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

// ─── Timezone helpers ────────────────────────────────────────────────────────

function toBeijingDateStr(utcDate) {
  const cst = new Date(utcDate.getTime() + CST_OFFSET_MS);
  return cst.toISOString().slice(0, 10);
}

function toBeijingHour(utcDate) {
  const cst = new Date(utcDate.getTime() + CST_OFFSET_MS);
  return cst.getUTCHours();
}

function makeSlotStart(beijingDateStr, beijingHour) {
  return `${beijingDateStr}T${String(beijingHour).padStart(2, "0")}:00:00Z`;
}

// ─── ICS fetch & parse ───────────────────────────────────────────────────────

async function fetchEvents(icalUrl, rangeStartUtc, rangeEndUtc) {
  const bustUrl = icalUrl.includes("?")
    ? `${icalUrl}&_t=${Date.now()}`
    : `${icalUrl}?_t=${Date.now()}`;

  const response = await fetch(bustUrl, {
    headers: {
      "User-Agent": "CalendarAvailabilityBot/1.0",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`ICS fetch failed: ${response.status} ${response.statusText}`);
  }

  const icsText = await response.text();
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  const rangeStartBeijingDate = toBeijingDateStr(rangeStartUtc);
  const rangeEndBeijingDate = toBeijingDateStr(rangeEndUtc);

  const allDayDates = [];
  const timedIntervals = [];

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent);

      if (event.startDate && event.startDate.isDate) {
        const startStr = event.startDate.toString().slice(0, 10);
        const endStr = event.endDate.toString().slice(0, 10);
        const cursor = new Date(`${startStr}T00:00:00Z`);
        const endLimit = new Date(`${endStr}T00:00:00Z`);
        while (cursor < endLimit) {
          const dateStr = cursor.toISOString().slice(0, 10);
          if (dateStr >= rangeStartBeijingDate && dateStr <= rangeEndBeijingDate) {
            allDayDates.push(dateStr);
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
      // Skip malformed events
    }
  }

  return { allDayDates, timedIntervals };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const icalUrl = process.env.ICAL_URL;
  if (!icalUrl) {
    console.error("ERROR: ICAL_URL environment variable is not set");
    process.exit(1);
  }

  // Generate data for: current month -2 to +6 months
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 7, 0)); // last day of +6 month

  const startDateStr = toBeijingDateStr(startDate);
  const endDateStr = toBeijingDateStr(endDate);

  const rangeStartUtc = new Date(`${startDateStr}T00:00:00+08:00`);
  const rangeEndUtc = new Date(`${endDateStr}T23:59:59+08:00`);

  const { allDayDates, timedIntervals } = await fetchEvents(icalUrl, rangeStartUtc, rangeEndUtc);

  // Build busyHoursMap
  const busyHoursMap = {};

  for (const dateStr of allDayDates) {
    if (!busyHoursMap[dateStr]) busyHoursMap[dateStr] = new Set();
    for (let h = 7; h <= 22; h++) busyHoursMap[dateStr].add(h);
  }

  for (const { start, end } of timedIntervals) {
    const cursor = new Date(start);
    cursor.setUTCMinutes(0, 0, 0);
    while (cursor < end) {
      const beijingDate = toBeijingDateStr(cursor);
      const beijingHour = toBeijingHour(cursor);
      if (!busyHoursMap[beijingDate]) busyHoursMap[beijingDate] = new Set();
      busyHoursMap[beijingDate].add(beijingHour);
      cursor.setUTCHours(cursor.getUTCHours() + 1);
    }
  }

  // Build result array
  const days = [];
  const cursor = new Date(`${startDateStr}T00:00:00Z`);
  const endCursor = new Date(`${endDateStr}T00:00:00Z`);

  while (cursor <= endCursor) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const busyHours = busyHoursMap[dateKey] ?? new Set();
    const slots = [];
    for (let h = 0; h < 24; h++) {
      slots.push({
        start: makeSlotStart(dateKey, h),
        end: makeSlotStart(dateKey, h === 23 ? 23 : h + 1),
        busy: busyHours.has(h),
      });
    }
    days.push({ date: dateKey, slots });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const output = {
    generated: new Date().toISOString(),
    connected: true,
    days,
  };

  process.stdout.write(JSON.stringify(output));
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
