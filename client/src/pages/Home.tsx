import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  addDays,
  isToday,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";

// Show 7:00 – 23:00: hours 7–22, labels "7–8" ... "22–23"
const DISPLAY_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7..22
const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

// Base URL for the static availability.json file (works for both GitHub Pages and local)
const AVAILABILITY_JSON_URL = `${import.meta.env.BASE_URL}availability.json`;

interface TimeSlot {
  start: string;
  end: string;
  busy: boolean;
}
interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}
interface AvailabilityData {
  generated: string;
  connected: boolean;
  days: DayAvailability[];
}

export default function Home() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Navigation bounds: past 2 months to future 6 months
  const today = useMemo(() => new Date(), []);
  const minMonth = useMemo(() => startOfMonth(addMonths(today, -2)), [today]);
  const maxMonth = useMemo(() => startOfMonth(addMonths(today, 6)), [today]);
  const canGoPrev = startOfMonth(currentDate) > minMonth;
  const canGoNext = startOfMonth(currentDate) < maxMonth;

  // Month range (used to filter from the full JSON data)
  const { startDate, endDate } = useMemo(() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    return {
      startDate: format(ms, "yyyy-MM-dd"),
      endDate: format(me, "yyyy-MM-dd"),
    };
  }, [currentDate]);

  // ── Static JSON fetch (replaces tRPC — works on GitHub Pages) ──
  const [allData, setAllData] = useState<AvailabilityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const fetchData = useCallback(async () => {
    setIsFetching(true);
    try {
      // Cache-bust with timestamp so every refresh reads the latest file
      const res = await fetch(`${AVAILABILITY_JSON_URL}?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AvailabilityData = await res.json();
      setAllData(json);
    } catch {
      // Silently fail — user will see "not connected" banner
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = fetchData;

  const connected = allData?.connected ?? false;
  // Filter days to the current month view
  const days: DayAvailability[] = useMemo(() => {
    if (!allData) return [];
    return allData.days.filter((d) => d.date >= startDate && d.date <= endDate);
  }, [allData, startDate, endDate]);

  // Build busy map: date -> hour -> busy
  // Server now encodes Beijing hour in the UTC position of the ISO string
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

  // Build calendar grid days: from 1st to last day of month (no week padding)
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const result: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      result.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return result;
  }, [currentDate]);

  // Drag-to-scroll on the scrollable day grid
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

  const totalCols = calendarDays.length;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="container">
          <div className="py-6 flex flex-col gap-1">
            <h1 className="text-4xl md:text-5xl font-serif text-foreground leading-tight">
              Corry 教练工作日历
            </h1>
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
              onClick={() => canGoPrev && setCurrentDate((d) => subMonths(d, 1))}
              disabled={!canGoPrev}
              className={`w-7 h-7 flex items-center justify-center border border-border transition-colors ${
                canGoPrev ? "hover:bg-accent cursor-pointer" : "opacity-30 cursor-not-allowed"
              }`}
              aria-label="上个月"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-base font-serif text-foreground min-w-[120px] text-center">
              {format(currentDate, "yyyy年 M月", { locale: zhCN })}
            </span>

            <button
              onClick={() => canGoNext && setCurrentDate((d) => addMonths(d, 1))}
              disabled={!canGoNext}
              className={`w-7 h-7 flex items-center justify-center border border-border transition-colors ${
                canGoNext ? "hover:bg-accent cursor-pointer" : "opacity-30 cursor-not-allowed"
              }`}
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

            {/* Right side: Timestamp + Refresh button */}
            <div className="ml-auto flex items-center gap-3 relative">
              {allData?.generated && (
                <span className="text-[11px] font-mono tracking-tight text-foreground/50">
                  <span className="hidden sm:inline">上次同步: </span>
                  {format(new Date(allData.generated), "MM-dd HH:mm", { locale: zhCN })}
                </span>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className={`w-7 h-7 flex items-center justify-center border border-border transition-colors ${
                  isFetching ? "opacity-50 cursor-not-allowed" : "hover:bg-accent cursor-pointer"
                }`}
                aria-label="刷新前端数据"
                title="刷新前端数据 (注意：不会触发后台拉取)"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 transition-transform ${
                    isFetching ? "animate-spin" : ""
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Calendar grid ──────────────────────────────────────────────────── */}
      <main className="container py-4">
        {/*
          Two-column layout:
          - Left: frozen time labels (w-16, does NOT scroll)
          - Right: scrollable day columns (overflow-x-auto + drag)
        */}
        <div className="flex">

          {/* ── Frozen left column: time labels ── */}
          <div className="shrink-0 w-16 bg-background z-10">
            {/* Corner cell aligns with day header row */}
            <div className="h-10 border-r border-b border-border" />
            {/* Hour labels */}
            {DISPLAY_HOURS.map((hour) => {
              const isTimeDivider = hour === 11 || hour === 17;
              return (
                <div
                  key={hour}
                  className="h-7 flex items-center justify-end pr-2 border-r border-border"
                  style={{
                    borderBottom: isTimeDivider
                      ? "2px solid var(--border-strong, #b0a090)"
                      : "1px solid var(--border)",
                  }}
                >
                  <span className="text-[10px] text-muted-foreground font-mono tracking-wide whitespace-nowrap">
                    {hour}–{hour + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Scrollable right section: day headers + cells ── */}
          <div
            ref={scrollRef}
            className="overflow-x-auto select-none flex-1"
            style={{ cursor: "grab" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <div style={{ minWidth: `${totalCols * 44}px` }}>

              {/* ── Day header row ── */}
              <div
                className="grid border-b border-border"
                style={{ gridTemplateColumns: `repeat(${totalCols}, 44px)` }}
              >
                {calendarDays.map((day, i) => {
                  const todayFlag = isToday(day);
                  const isSundayHeader = day.getDay() === 0;
                  return (
                    <div
                      key={i}
                      className="h-10 flex flex-col items-center justify-center border-border"
                      style={{
                        borderRight: isSundayHeader
                          ? "2px solid var(--border-strong, #b0a090)"
                          : "1px solid var(--border)",
                      }}
                    >
                      <span className="text-[8px] tracking-widest uppercase text-muted-foreground font-sans leading-none">
                        {DAY_NAMES[day.getDay()]}
                      </span>
                      <span
                        className={`text-xs font-serif mt-0.5 leading-none ${
                          todayFlag
                            ? "w-5 h-5 flex items-center justify-center rounded-full bg-foreground text-background text-[10px]"
                            : "text-foreground"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ── Hour rows ── */}
              {DISPLAY_HOURS.map((hour) => {
                const isTimeDivider = hour === 11 || hour === 17;
                return (
                  <div
                    key={hour}
                    className="grid"
                    style={{ gridTemplateColumns: `repeat(${totalCols}, 44px)` }}
                  >
                    {calendarDays.map((day, di) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const busyMap = availMap[dateKey];
                      const isBusy = busyMap?.[hour] === true;
                      const hasData = busyMap !== undefined;
                      const isSunday = day.getDay() === 0; // Sunday = 0

                      const borderBottom = isTimeDivider
                        ? "2px solid var(--border-strong, #b0a090)"
                        : "1px solid var(--border)";
                      const borderRight = isSunday
                        ? "2px solid var(--border-strong, #b0a090)"
                        : "1px solid var(--border)";

                      return (
                        <div
                          key={di}
                          className={`h-7 relative transition-colors ${
                            isLoading ? "animate-pulse bg-muted/20" : ""
                          }`}
                          style={{
                            borderBottom,
                            borderRight,
                            ...((!isLoading && isBusy)
                              ? { backgroundColor: "var(--busy-light)", borderLeft: "2px solid var(--busy)" }
                              : {}),
                          }}
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
                );
              })}
            </div>
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
            <p className="text-[10px] text-muted-foreground font-sans tracking-wide">时间均为北京时间（UTC+8）</p>
          </div>
        </div>
      </main>
    </div>
  );
}
