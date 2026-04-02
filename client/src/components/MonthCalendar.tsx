import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
} from "date-fns";
import type { DayAvailability } from "../../../server/outlookService";

interface MonthCalendarProps {
  month: Date;
  availability: DayAvailability[];
  isLoading: boolean;
  onDayClick?: (date: Date) => void;
}

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export default function MonthCalendar({
  month,
  availability,
  isLoading,
  onDayClick,
}: MonthCalendarProps) {
  // Build calendar grid (6 weeks)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [month]);

  // Build busy ratio map: date -> { busyHours, totalHours }
  const busyMap = useMemo(() => {
    const map: Record<string, { busy: number; total: number }> = {};
    for (const day of availability) {
      const busyCount = day.slots.filter((s) => s.busy).length;
      map[day.date] = { busy: busyCount, total: day.slots.length };
    }
    return map;
  }, [availability]);

  function getBusyRatio(date: Date): number | null {
    const key = format(date, "yyyy-MM-dd");
    const data = busyMap[key];
    if (!data) return null;
    return data.busy / data.total;
  }

  function getBusyLabel(ratio: number): string {
    if (ratio === 0) return "空闲";
    if (ratio < 0.3) return "较空";
    if (ratio < 0.6) return "部分忙";
    if (ratio < 0.9) return "较忙";
    return "全忙";
  }

  function getCellStyle(ratio: number | null): React.CSSProperties {
    if (ratio === null) return {};
    if (ratio === 0) return { backgroundColor: "var(--free-light)" };
    // Interpolate between free-light and busy-light based on ratio
    const busyAlpha = Math.min(ratio * 1.2, 1);
    return {
      background: `linear-gradient(135deg, var(--free-light) ${(1 - busyAlpha) * 100}%, var(--busy-light) 100%)`,
    };
  }

  function getIndicatorStyle(ratio: number | null): React.CSSProperties {
    if (ratio === null) return { backgroundColor: "transparent" };
    if (ratio === 0) return { backgroundColor: "var(--free)" };
    if (ratio > 0.6) return { backgroundColor: "var(--busy)" };
    return { backgroundColor: `oklch(0.57 0.15 90)` }; // amber mid
  }

  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div>
      {/* Day name header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="h-8 flex items-center justify-center">
            <span className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground font-sans">
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="border-t border-l border-border">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, month);
              const today = isToday(day);
              const ratio = inMonth ? getBusyRatio(day) : null;
              const hasData = ratio !== null;

              return (
                <div
                  key={di}
                  className={`border-b border-r border-border min-h-[72px] p-2 transition-colors ${
                    inMonth ? "cursor-pointer hover:brightness-95" : "opacity-30"
                  } ${isLoading && inMonth ? "animate-pulse" : ""}`}
                  style={inMonth ? getCellStyle(ratio) : {}}
                  onClick={() => inMonth && onDayClick?.(day)}
                >
                  {/* Date number */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-serif leading-none ${
                        today
                          ? "w-6 h-6 flex items-center justify-center rounded-full bg-foreground text-background text-xs"
                          : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {inMonth && hasData && !isLoading && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={getIndicatorStyle(ratio)}
                      />
                    )}
                  </div>

                  {/* Busy label */}
                  {inMonth && hasData && !isLoading && (
                    <span
                      className="text-[9px] tracking-widest uppercase font-sans"
                      style={{ color: ratio! > 0.5 ? "var(--busy)" : "var(--free)" }}
                    >
                      {getBusyLabel(ratio!)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
