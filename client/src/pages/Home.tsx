import { useState, useMemo, useRef } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isToday,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";

// Show 7:00 – 23:00: hours 7–22, labels "7–8" ... "22–23"
const DISPLAY_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7..22
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

export default function Home() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Month range for data fetching
  const { startDate, endDate } = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      startDate: format(ms, "yyyy-MM-dd"),
      endDate: format(me, "yyyy-MM-dd"),
    };
  }, [currentDate]);

  const { data, isLoading } = trpc.calendar.getAvailability.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: statusData } = trpc.calendar.status.useQuery(undefined, {
    staleTime: 30 * 1000,
  });

  const connected = statusData?.connected ?? data?.connected ?? false;
  const days = data?.days ?? [];

  // Build busy map: date -> hour -> busy
  const availMap = useMemo(() => {
    const map: Record<string, Record<number, boolean>> = {};
    for (const day of days) {
      map[day.date] = {};
      for (const slot of day.slots) {
        const hour = new Date(slot.start).getUTCHours();
        map[day.date][hour] = slot.busy;
      }
    }
    return map;
  }, [days]);

  // Build calendar grid days (full weeks covering the month)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const result: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      result.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return result;
  }, [currentDate]);

  // Drag-to-scroll on the grid container
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0 });

  function onMouseDown(e: React.MouseEvent) {
    const el = scrollRef.current;
    if (!el) return;
    dragState.current = { dragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragState.current.dragging) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  }
  function onMouseUp() {
    dragState.current.dragging = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  }

  const totalCols = calendarDays.length; // 28–42 days

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="container">
          <div className="py-6 flex flex-col gap-1">
            <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-sans">
              时间可用性
            </p>
            <h1 className="text-4xl md:text-5xl font-serif text-foreground leading-tight">
              日历
            </h1>
            <p className="text-sm text-muted-foreground font-sans mt-1 tracking-wide">
              仅显示空闲与忙碌状态，不含具体事项
            </p>
          </div>
        </div>
      </header>

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      {!isLoading && !connected && (
        <div className="border-b border-border bg-[var(--busy-light)]">
          <div className="container py-2.5 flex items-center gap-3">
            <Clock className="w-3.5 h-3.5 text-[var(--busy)] shrink-0" />
            <p className="text-xs text-[var(--busy)] font-sans tracking-wide">
              日历尚未连接 Outlook，请前往{" "}
              <a href="/admin" className="underline underline-offset-2">管理页面</a>{" "}
              完成配置。
            </p>
          </div>
        </div>
      )}

      {/* ── Month navigation ───────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="container">
          <div className="py-3 flex items-center gap-3">
            <button
              onClick={() => setCurrentDate((d) => subMonths(d, 1))}
              className="w-7 h-7 flex items-center justify-center border border-border hover:bg-accent transition-colors"
              aria-label="上个月"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-base font-serif text-foreground min-w-[120px] text-center">
              {format(currentDate, "yyyy年 M月", { locale: zhCN })}
            </span>

            <button
              onClick={() => setCurrentDate((d) => addMonths(d, 1))}
              className="w-7 h-7 flex items-center justify-center border border-border hover:bg-accent transition-colors"
              aria-label="下个月"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 h-7 text-[10px] tracking-[0.12em] uppercase font-sans border border-border hover:bg-accent transition-colors ml-1"
            >
              今天
            </button>
          </div>
        </div>
      </div>

      {/* ── Calendar grid ──────────────────────────────────────────────────── */}
      <main className="container py-4">
        {/* Outer scroll wrapper — horizontal drag to scroll */}
        <div
          ref={scrollRef}
          className="overflow-x-auto select-none"
          style={{ cursor: "grab" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Fixed-width inner grid */}
          <div style={{ minWidth: `${64 + totalCols * 44}px` }}>

            {/* ── Day header row ── */}
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `64px repeat(${totalCols}, 44px)` }}
            >
              {/* Corner */}
              <div className="h-10 border-r border-border" />
              {calendarDays.map((day, i) => {
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                return (
                  <div
                    key={i}
                    className={`h-10 flex flex-col items-center justify-center border-r border-border ${
                      !inMonth ? "opacity-30" : ""
                    }`}
                  >
                    <span className="text-[8px] tracking-widest uppercase text-muted-foreground font-sans leading-none">
                      {DAY_NAMES[day.getDay()]}
                    </span>
                    <span
                      className={`text-xs font-serif mt-0.5 leading-none ${
                        today
                          ? "w-5 h-5 flex items-center justify-center rounded-full bg-foreground text-background text-[10px]"
                          : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Hour rows ── */}
            {DISPLAY_HOURS.map((hour) => (
              <div
                key={hour}
                className="grid"
                style={{ gridTemplateColumns: `64px repeat(${totalCols}, 44px)` }}
              >
                {/* Time range label */}
                <div className="h-7 flex items-center justify-end pr-2 border-r border-b border-border">
                  <span className="text-[10px] text-muted-foreground font-mono tracking-wide whitespace-nowrap">
                    {hour}–{hour + 1}
                  </span>
                </div>

                {/* Day cells */}
                {calendarDays.map((day, di) => {
                  const inMonth = isSameMonth(day, currentDate);
                  const dateKey = format(day, "yyyy-MM-dd");
                  const busyMap = availMap[dateKey];
                  const isBusy = inMonth && busyMap?.[hour] === true;
                  const hasData = inMonth && busyMap !== undefined;

                  return (
                    <div
                      key={di}
                      className={`h-7 border-b border-r border-border relative transition-colors ${
                        !inMonth ? "opacity-20" : ""
                      } ${isLoading && inMonth ? "animate-pulse bg-muted/20" : ""}`}
                      style={
                        !isLoading && isBusy
                          ? { backgroundColor: "var(--busy-light)", borderLeftColor: "var(--busy)", borderLeftWidth: "2px" }
                          : {}
                      }
                    >
                      {!isLoading && hasData && isBusy && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[8px] tracking-[0.08em] font-sans pointer-events-none"
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

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div className="mt-4 pt-4 border-t border-border flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 border-l-2"
              style={{ backgroundColor: "var(--busy-light)", borderLeftColor: "var(--busy)" }}
            />
            <span className="text-[10px] text-muted-foreground font-sans tracking-wide">已预定</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 border border-border bg-transparent" />
            <span className="text-[10px] text-muted-foreground font-sans tracking-wide">空闲</span>
          </div>
          <div className="ml-auto">
            <p className="text-[10px] text-muted-foreground font-sans tracking-wide">时间均为 UTC</p>
          </div>
        </div>
      </main>
    </div>
  );
}
