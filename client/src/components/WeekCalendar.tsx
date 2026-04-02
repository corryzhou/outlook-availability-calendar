import { useMemo } from "react";
import { format, addDays, isToday } from "date-fns";
import type { DayAvailability } from "../../../server/outlookService";

interface WeekCalendarProps {
  weekStart: Date;
  availability: DayAvailability[];
  isLoading: boolean;
}

// Show 7:00 – 22:00 (16 slots)
const DISPLAY_HOURS = Array.from({ length: 16 }, (_, i) => i + 7);

export default function WeekCalendar({ weekStart, availability, isLoading }: WeekCalendarProps) {
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const availMap = useMemo(() => {
    const map: Record<string, Record<number, boolean>> = {};
    for (const day of availability) {
      map[day.date] = {};
      for (const slot of day.slots) {
        const hour = new Date(slot.start).getUTCHours();
        map[day.date][hour] = slot.busy;
      }
    }
    return map;
  }, [availability]);

  const dayNames = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header row */}
        <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
          <div className="h-10" />
          {days.map((day, i) => {
            const today = isToday(day);
            return (
              <div key={i} className="h-10 flex flex-col items-center justify-center border-b border-border">
                <span className="text-[9px] tracking-[0.12em] uppercase text-muted-foreground font-sans leading-none">
                  {dayNames[day.getDay()]}
                </span>
                <span
                  className={`text-sm font-serif mt-0.5 leading-none ${
                    today
                      ? "w-6 h-6 flex items-center justify-center rounded-full bg-foreground text-background text-xs"
                      : "text-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div>
          {DISPLAY_HOURS.map((hour) => (
            <div
              key={hour}
              className="grid"
              style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}
            >
              {/* Hour range label: e.g. "7–8" */}
              <div className="h-8 flex items-center justify-end pr-3">
                <span className="text-[10px] text-muted-foreground font-mono tracking-wide whitespace-nowrap">
                  {hour}–{hour + 1}
                </span>
              </div>

              {/* Day cells */}
              {days.map((day, di) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const busyMap = availMap[dateKey];
                const isBusy = busyMap?.[hour] === true;
                const hasData = busyMap !== undefined;

                return (
                  <div
                    key={di}
                    className={`h-8 border-b border-r border-border transition-colors relative ${
                      isLoading
                        ? "animate-pulse bg-muted/30"
                        : isBusy
                        ? "border-l-2 border-l-[var(--busy)]"
                        : ""
                    }`}
                    style={
                      !isLoading && isBusy
                        ? { backgroundColor: "var(--busy-light)" }
                        : {}
                    }
                  >
                    {!isLoading && hasData && isBusy && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[9px] tracking-[0.1em] font-sans"
                        style={{ color: "var(--busy)" }}
                      >
                        已预定
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
