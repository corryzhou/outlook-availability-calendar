import { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import WeekCalendar from "@/components/WeekCalendar";
import MonthCalendar from "@/components/MonthCalendar";

type ViewMode = "week" | "month";

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Compute date range based on view mode
  const { startDate, endDate, weekStart } = useMemo(() => {
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return {
        startDate: format(ws, "yyyy-MM-dd"),
        endDate: format(we, "yyyy-MM-dd"),
        weekStart: ws,
      };
    } else {
      const ms = startOfMonth(currentDate);
      const me = endOfMonth(currentDate);
      return {
        startDate: format(ms, "yyyy-MM-dd"),
        endDate: format(me, "yyyy-MM-dd"),
        weekStart: ms,
      };
    }
  }, [viewMode, currentDate]);

  const { data, isLoading } = trpc.calendar.getAvailability.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: statusData } = trpc.calendar.status.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  function navigate(direction: "prev" | "next") {
    if (viewMode === "week") {
      setCurrentDate((d) => direction === "prev" ? subWeeks(d, 1) : addWeeks(d, 1));
    } else {
      setCurrentDate((d) => direction === "prev" ? subMonths(d, 1) : addMonths(d, 1));
    }
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function handleDayClick(date: Date) {
    setCurrentDate(date);
    setViewMode("week");
  }

  const periodLabel = viewMode === "week"
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "M月d日", { locale: zhCN })} — ${format(endOfWeek(currentDate, { weekStartsOn: 0 }), "M月d日", { locale: zhCN })}`
    : format(currentDate, "yyyy年 M月", { locale: zhCN });

  const connected = statusData?.connected ?? data?.connected ?? false;
  const days = data?.days ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="container">
          <div className="py-8 flex flex-col gap-1">
            {/* Eyebrow */}
            <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
              时间可用性
            </p>
            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-serif text-foreground leading-tight">
              日历
            </h1>
            {/* Subtitle */}
            <p className="text-sm text-muted-foreground font-sans mt-1 tracking-wide">
              仅显示空闲与忙碌状态，不含具体事项
            </p>
          </div>
        </div>
      </header>

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      {!isLoading && !connected && (
        <div className="border-b border-border bg-[var(--busy-light)]">
          <div className="container py-3 flex items-center gap-3">
            <Clock className="w-3.5 h-3.5 text-[var(--busy)] shrink-0" />
            <p className="text-xs text-[var(--busy)] font-sans tracking-wide">
              日历尚未连接 Outlook，请前往{" "}
              <a href="/admin" className="underline underline-offset-2">
                管理页面
              </a>{" "}
              完成授权配置。
            </p>
          </div>
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="container">
          <div className="py-4 flex items-center justify-between gap-4 flex-wrap">
            {/* Navigation */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("prev")}
                className="w-8 h-8 flex items-center justify-center border border-border hover:bg-accent transition-colors"
                aria-label="上一期"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-sm font-serif text-foreground min-w-[160px] text-center">
                {periodLabel}
              </span>

              <button
                onClick={() => navigate("next")}
                className="w-8 h-8 flex items-center justify-center border border-border hover:bg-accent transition-colors"
                aria-label="下一期"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={goToday}
                className="px-3 h-8 text-[10px] tracking-[0.12em] uppercase font-sans border border-border hover:bg-accent transition-colors"
              >
                今天
              </button>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("week")}
                className={`px-4 h-8 text-[10px] tracking-[0.12em] uppercase font-sans transition-colors ${
                  viewMode === "week"
                    ? "bg-foreground text-background"
                    : "hover:bg-accent"
                }`}
              >
                周
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-4 h-8 text-[10px] tracking-[0.12em] uppercase font-sans transition-colors border-l border-border ${
                  viewMode === "month"
                    ? "bg-foreground text-background"
                    : "hover:bg-accent"
                }`}
              >
                月
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Calendar ───────────────────────────────────────────────────────── */}
      <main className="container py-6">
        {viewMode === "week" ? (
          <WeekCalendar
            weekStart={startOfWeek(currentDate, { weekStartsOn: 0 })}
            availability={days}
            isLoading={isLoading}
          />
        ) : (
          <MonthCalendar
            month={currentDate}
            availability={days}
            isLoading={isLoading}
            onDayClick={handleDayClick}
          />
        )}
      </main>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-8">
        <div className="container py-6">
          <div className="flex items-center gap-8 flex-wrap">
            <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-sans">
              图例
            </p>
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 border-l-[3px]"
                style={{
                  backgroundColor: "var(--free-light)",
                  borderLeftColor: "var(--free)",
                }}
              />
              <span className="text-xs text-muted-foreground font-sans tracking-wide">空闲</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 border-l-[3px]"
                style={{
                  backgroundColor: "var(--busy-light)",
                  borderLeftColor: "var(--busy)",
                }}
              />
              <span className="text-xs text-muted-foreground font-sans tracking-wide">忙碌</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border border-border bg-transparent" />
              <span className="text-xs text-muted-foreground font-sans tracking-wide">暂无数据</span>
            </div>
            <div className="ml-auto">
              <p className="text-[10px] text-muted-foreground font-sans tracking-wide">
                所有时间均为 UTC 时区
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
