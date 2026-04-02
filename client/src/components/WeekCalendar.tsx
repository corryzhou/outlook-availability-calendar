import { useMemo } from "react";
import { format, addDays, startOfWeek, isSameDay, isToday } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { DayAvailability } from "../../../server/outlookService";

interface WeekCalendarProps {
  weekStart: Date;
  availability: DayAvailability[];
  isLoading: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DISPLAY_HOURS = Array.from({ length: 17 }, (_, i) => i + 7); // 7:00 – 23:00

function formatHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

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
      <div className="min-w-[640px]">
        {/* Header row */}
        <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div className="h-14" />
          {days.map((day, i) => {
            const today = isToday(day);
            return (
              <div key={i} className="h-14 flex flex-col items-center justify-center border-b border-border">
                <span className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground font-sans">
                  {dayNames[day.getDay()]}
                </span>
                <span
                  className={`text-lg font-serif mt-0.5 leading-none ${
                    today
                      ? "w-7 h-7 flex items-center justify-center rounded-full bg-foreground text-background text-sm"
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
        <div className="relative">
          {DISPLAY_HOURS.map((hour) => (
            <div
              key={hour}
              className="grid"
              style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}
            >
              {/* Hour label */}
              <div className="h-12 flex items-start justify-end pr-3 pt-1">
                <span className="text-[10px] text-muted-foreground font-mono tracking-wider">
                  {formatHour(hour)}
                </span>
              </div>

              {/* Day cells */}
              {days.map((day, di) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const busyMap = availMap[dateKey];
                const isBusy = busyMap?.[hour] === true;
                const isFree = busyMap?.[hour] === false;
                const hasData = busyMap !== undefined;

                let cellClass = "h-12 border-b border-r border-border transition-colors";
                if (isLoading) {
                  cellClass += " animate-pulse bg-muted/40";
                } else if (!hasData) {
                  cellClass += " bg-transparent";
                } else if (isBusy) {
                  cellClass += " bg-[var(--busy-light)] border-l-[3px] border-l-[var(--busy)]";
                } else {
                  cellClass += " bg-[var(--free-light)] border-l-[3px] border-l-[var(--free)]";
                }

                return (
                  <div key={di} className={cellClass}>
                    {!isLoading && hasData && (
                      <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <span
                          className="text-[9px] tracking-widest uppercase font-sans"
                          style={{ color: isBusy ? "var(--busy)" : "var(--free)" }}
                        >
                          {isBusy ? "忙碌" : "空闲"}
                        </span>
                      </div>
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
