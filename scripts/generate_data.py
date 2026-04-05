"""
从 Outlook iCal 生成 data.json，供 GitHub Pages 前端直接读取
由 GitHub Actions 手动触发运行
"""
import json, re, os, subprocess
from datetime import datetime, timedelta, timezone

ICAL_URL = os.environ.get("ICAL_URL", "")
SYNC_DAYS = 90
HOUR_START = 7
HOUR_END = 23
CST = timezone(timedelta(hours=8))


def fetch_ical(url):
    result = subprocess.run(
        ["curl", "-s", "-L", "--max-time", "30", url],
        capture_output=True, timeout=35
    )
    return result.stdout.decode("utf-8", errors="ignore")


def parse_dt(s):
    s = s.strip()
    if len(s) == 8 and s.isdigit():
        return datetime(int(s[:4]), int(s[4:6]), int(s[6:8]), 0, 0, tzinfo=CST), True
    if "T" in s:
        dt_str = s.split(":")[-1] if ":" in s else s
        dt_str = dt_str.strip()
        if dt_str.endswith("Z"):
            dt = datetime.strptime(dt_str, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).astimezone(CST)
        else:
            dt = datetime.strptime(dt_str[:15], "%Y%m%dT%H%M%S").replace(tzinfo=CST)
        return dt, False
    return None, False


def parse_events(ical_text):
    busy = {}
    events = re.split(r"BEGIN:VEVENT", ical_text)[1:]
    today = datetime.now(CST).date()
    end_date = today + timedelta(days=SYNC_DAYS)

    for event_text in events:
        start_match = re.search(r"DTSTART(?:;[^:\r\n]+)?:(.+)", event_text)
        end_match = re.search(r"DTEND(?:;[^:\r\n]+)?:(.+)", event_text)
        if not start_match or not end_match:
            continue

        start_dt, is_allday = parse_dt(start_match.group(1))
        end_dt, _ = parse_dt(end_match.group(1))
        if not start_dt or not end_dt:
            continue

        if is_allday:
            cur = start_dt.date()
            while cur < end_dt.date():
                if today <= cur <= end_date:
                    dk = cur.strftime("%Y-%m-%d")
                    busy.setdefault(dk, set())
                    for h in range(HOUR_START, HOUR_END):
                        busy[dk].add(h)
                cur += timedelta(days=1)
            continue

        cur = start_dt
        while cur < end_dt:
            cur_date = cur.date()
            if today <= cur_date <= end_date:
                dk = cur_date.strftime("%Y-%m-%d")
                busy.setdefault(dk, set())
                if HOUR_START <= cur.hour < HOUR_END:
                    busy[dk].add(cur.hour)
            cur += timedelta(hours=1)

    return busy


def main():
    if not ICAL_URL:
        raise ValueError("ICAL_URL environment variable is not set")

    print(f"Fetching iCal from Outlook...")
    ical_text = fetch_ical(ICAL_URL)
    print(f"Fetched {len(ical_text)} bytes")

    busy_data = parse_events(ical_text)
    print(f"Parsed {len(busy_data)} days with events")

    today = datetime.now(CST).date()
    end_date = today + timedelta(days=SYNC_DAYS)
    result = {}
    cur = today
    while cur <= end_date:
        dk = cur.strftime("%Y-%m-%d")
        result[dk] = sorted(list(busy_data.get(dk, set())))
        cur += timedelta(days=1)

    output = {
        "updated_at": datetime.now(CST).strftime("%Y-%m-%d %H:%M:%S"),
        "timezone": "Asia/Shanghai",
        "data": result
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False)

    print(f"data.json written with {len(result)} days")


if __name__ == "__main__":
    main()
