"""Uji tujuh hari (PRD 6): data ter-update otomatis tanpa campur tangan manual.

Hanya run terjadwal yang dihitung, jadi push dan run manual tidak bisa menutupi jadwal yang mati.
Riwayatnya dari etl.runs, karena public.site_status hanya menyimpan keadaan terakhir.
"""

from datetime import datetime, time, timedelta, timezone
from typing import NamedTuple

WIB = timezone(timedelta(hours=7), "WIB")
AUTOMATIC = ("schedule", "release")
SUCCESS = ("ok", "partial")
MAX_GAP_HOURS = 36  # sama dengan /api/health dan banner situs


class Day(NamedTuple):
    day: object
    daily: str  # jam dan status run harian
    release: str  # jam dan status run hari rilis BPS
    other: int  # run dari push, manual, atau laptop: tampil, tetapi tidak dihitung
    passed: bool | None  # None: hari ini, dan run hariannya belum datang


class Result(NamedTuple):
    days: list
    largest_gap: float | None
    verdict: str  # lulus, berjalan, atau gagal


def describe(runs):
    return ", ".join(f"{started.astimezone(WIB):%H.%M} {status}" for _, status, started, _ in runs) or "-"


def largest_gap(runs, begin, end):
    """Selang terbesar, dalam jam, antar-run otomatis yang sukses selama [begin, end]. Selang pertama
    dihitung dari sukses terakhir sebelum begin, dan selang terakhir sampai end."""
    finished = sorted(r[3] for r in runs if r[0] in AUTOMATIC and r[1] in SUCCESS and r[3] and r[3] <= end)
    before = [t for t in finished if t < begin]
    marks = [before[-1] if before else begin, *(t for t in finished if t >= begin), end]
    return max((b - a).total_seconds() / 3600 for a, b in zip(marks, marks[1:]))


def evaluate(runs, start, days, now):
    """Nilai jendela `days` hari mulai tanggal WIB `start`, dari baris (trigger, status, mulai, selesai)."""
    today = now.astimezone(WIB).date()
    rows = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        if day > today:
            break
        same_day = [r for r in runs if r[2].astimezone(WIB).date() == day]
        daily = [r for r in same_day if r[0] == "schedule"]
        release = [r for r in same_day if r[0] == "release"]
        passed = any(r[1] in SUCCESS for r in daily)
        if not passed and day == today and not any(r[1] == "failed" for r in daily):
            passed = None
        rows.append(Day(day, describe(daily), describe(release), len(same_day) - len(daily) - len(release), passed))
    begin = datetime.combine(start, time.min, WIB)
    end = min(now, begin + timedelta(days=days))
    gap = largest_gap(runs, begin, end) if now > begin else None
    if any(row.passed is False for row in rows) or (gap is not None and gap > MAX_GAP_HOURS):
        verdict = "gagal"
    elif len(rows) == days and all(row.passed for row in rows):
        verdict = "lulus"
    else:
        verdict = "berjalan"
    return Result(rows, gap, verdict)
