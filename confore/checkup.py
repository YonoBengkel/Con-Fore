"""Pemeriksaan bulanan dan pengingat tabel kurasi (PRD fase 6, RUNBOOK bagian 9 dan 9b).

Fungsi penilai di sini hanya membaca data yang diberikan lalu menulis kalimat temuan, supaya bisa
diuji tanpa database dan tanpa jaringan. `collect` mengumpulkan datanya: tabel di config/, database
(ukuran, backtest, dan tanggal rilis angka terakhir), berkas JSON keadaan repo yang ditulis langkah
workflow sebelumnya (rilis backup, issue alarm, pull request Dependabot, npm audit), dan basis data
kerentanan OSV untuk paket Python di requirements.txt. Hasilnya daftar issue yang dibuka atau
dikomentari langkah berikutnya di .github/workflows/checkup.yml. Tanpa model AI.

Repo ini publik, jadi isi issue hanya memuat isi config/, nama paket, nomor issue, dan jenis error.
"""

import json
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import NamedTuple

from confore import config, db, fetch
from confore.availability import WIB

RUNBOOK = config.ROOT / "RUNBOOK.md"
REQUIREMENTS = config.ROOT / "requirements.txt"
OSV_URL = "https://api.osv.dev/v1/querybatch"

# Judul tetap: issue yang masih terbuka dengan judul yang sama dikomentari, bukan dibuka lagi.
MONTHLY = "Pemeriksaan bulanan"
TARGETS = "Pengingat: target resmi"
CALENDAR = "Pengingat: kalender rilis"
HOLIDAYS = "Pengingat: tanggal Lebaran"
TEST_PREFIX = "[Uji] "  # issue uji tidak pernah menimpa issue pengingat sungguhan yang masih terbuka

TARGET_MONTH = 10  # APBN dan target inflasi tahun depan biasanya sudah ditetapkan Oktober
SKB_MONTH = 9  # SKB 3 Menteri tentang libur nasional tahun depan biasanya terbit September
HOLIDAY_YEARS_AHEAD = 2  # model inflasi butuh tanggal Lebaran sampai ujung horizon ramalan
ESTIMATE = "-perkiraan"  # akhiran calendar_source untuk tanggal yang belum resmi
ESTIMATE_DAYS = 60  # tanggal perkiraan yang tinggal sekian hari lagi diganti tanggal resmi
CALENDAR_DAYS = 30  # kalender sebuah seri yang habis dalam sekian hari perlu ditambah
BACKTEST_DAY = 9  # backtest bulanan berjalan setiap tanggal 9 (pipeline.yml)
BACKUP_DAYS = 8  # backup berjalan setiap Senin (backup.yml)
TOKEN_DAYS = 60  # token GitHub untuk cron-job.org diganti sebelum kedaluwarsa
TOKEN_DATE = re.compile(r"kedaluwarsa token GitHub untuk cron-job\.org: `(\d{4}-\d{2}-\d{2})`")
PINNED = re.compile(r"^([A-Za-z0-9._-]+)==([^\s;\\]+)", re.MULTILINE)

MANUAL = [
    "Job cron-job.org masih aktif dan notifikasi email kegagalannya menyala (bagian 5a).",
    "Pemakaian Vercel Hobby masih jauh dari batas.",
    "Angka utama di laporan backtest tanggal 9 masih masuk akal (bagian 4a).",
]
FOOTER = ("Cara memperbaruinya ada di RUNBOOK.md bagian 9b. Issue ini dibuka workflow Pemeriksaan "
          "bulanan dan tidak tertutup sendiri: tutup sesudah tabelnya diperbarui.")


class Check(NamedTuple):
    name: str
    ok: bool | None  # None: tidak diperiksa
    detail: str


def describe(error):
    """Keterangan error yang aman ditulis ke issue publik. Pesan Stop dan kode FetchError ditulis sendiri
    oleh kode ini. Pesan error lain bisa memuat host atau user database, jadi hanya jenisnya."""
    if isinstance(error, db.Stop):
        return str(error)
    if isinstance(error, fetch.FetchError):
        return f"FetchError {error.code}"
    return type(error).__name__


def codes(names):
    return ", ".join(f"`{name}`" for name in names)


# Pengingat tabel kurasi

def target_reminders(targets, today):
    """targets: baris config.check_targets. Target yang masih bersumber berita, dan pasangan seri dan jenis
    target yang tahun terakhirnya belum sampai tahun yang sudah perlu diisi."""
    lines = [f"`{s}` {y} ({k}) masih bersumber berita. Cocokkan dengan naskah resminya di JDIH BPK "
             f"(https://peraturan.bpk.go.id), lalu ubah `verification` menjadi `dokumen`."
             for s, y, k, *_, verification in sorted(targets, key=lambda r: (r[1], r[0], r[2]))
             if verification == "berita"]
    last = {}
    for s, y, k, *_ in targets:
        last[(s, k)] = max(y, last.get((s, k), y))
    need = today.year + 1 if today.month >= TARGET_MONTH else today.year
    for (s, k), y in sorted(last.items()):
        # RPJMN lima tahunan baru disusun sesudah periode lamanya habis, jadi cukup sampai tahun ini.
        year = today.year if k == "rpjmn" else need
        if y < year:
            lines.append(f"Target {k} untuk `{s}` baru sampai {y}, padahal tahun {year} sudah perlu diisi.")
    return lines


def calendar_reminders(calendar, latest, sources, today):
    """calendar: baris config.check_calendar. latest: {series_id: (periode, tanggal rilis)} dari
    public.latest_values, kosong bila database tidak terbaca. sources: {series_id: sumber seri}."""
    estimates = defaultdict(list)
    for s, p, source, day in calendar:
        if source.endswith(ESTIMATE) and day <= today + timedelta(days=ESTIMATE_DAYS):
            estimates[(day, source)].append(f"`{s}` {p}")
    lines = [f"Tanggal {day} untuk {', '.join(items)} masih perkiraan (`{source}`). Ganti dengan tanggal "
             f"resminya begitu jadwal sumbernya terbit." for (day, source), items in sorted(estimates.items())]

    ends = {}
    for s, _, source, day in calendar:
        if s not in ends or day > ends[s][0]:
            ends[s] = (day, source.removesuffix(ESTIMATE))
    short = defaultdict(list)
    for s, (day, base) in sorted(ends.items()):
        if day < today + timedelta(days=CALENDAR_DAYS):
            short[(day, base)].append(s)
    lines += [f"Kalender `{base}` untuk {codes(ids)} hanya sampai {day}. Tambahkan tanggal rilis berikutnya "
              f"dari jadwal resminya, atau tanggal perkiraan dengan sumber `{base}{ESTIMATE}` bila jadwalnya "
              f"belum terbit." for (day, base), ids in sorted(short.items())]

    # Hanya seri yang tanggal rilisnya memang diambil dari kalender: sumber kalendernya sama dengan
    # sumber seri itu (publish.calendar_releases), jadi salinan IMF dari angka BPS tidak ikut.
    missing = defaultdict(list)
    for s in sorted({s for s, _, source, _ in calendar if source.removesuffix(ESTIMATE) == sources.get(s)}):
        period, release = latest.get(s, (None, None))
        if period and release is None:
            missing[period].append(s)
    lines += [f"Angka {period} untuk {codes(ids)} tampil dengan tulisan \"Dilihat Con-Fore\", karena tanggal "
              f"rilisnya belum ada di kalender atau jatuh sesudah hari Con-Fore melihat angka itu. Tambahkan "
              f"tanggal rilis resminya." for period, ids in sorted(missing.items())]
    return lines


def holiday_reminders(rows, today):
    """rows: baris holidays.csv yang sudah lolos config.check_holidays."""
    days = [(date.fromisoformat(r["date"]), r["verification"], date.fromisoformat(r["last_verified"]))
            for r in rows]
    lines = [f"Lebaran {d.year} ({d}) sudah lewat, tetapi barisnya masih perkiraan. Catat tanggal hasil "
             f"sidang isbat Kementerian Agama." for d, v, _ in days if v == "perkiraan" and d < today]
    if today.month >= SKB_MONTH:
        since = date(today.year, SKB_MONTH, 1)
        lines += [f"Lebaran {d.year} ({d}) terakhir dicek {c}. Cocokkan dengan SKB 3 Menteri tentang libur "
                  f"nasional {d.year}, yang biasanya terbit September."
                  for d, v, c in days if d.year == today.year + 1 and v != "dokumen" and c < since]
    end = max(d for d, _, _ in days)
    if end.year < today.year + HOLIDAY_YEARS_AHEAD:
        lines.append(f"Tabel hanya sampai Lebaran {end.year}. Tambahkan perkiraan tahun-tahun berikutnya.")
    return lines


# Cek bulanan RUNBOOK 9 yang bisa dikerjakan script

def size_check(size):
    limit = db.SIZE_WARNING // 2**20
    return Check("Ukuran database", size <= db.SIZE_WARNING, f"{size / 2**20:.0f} MB dari batas peringatan {limit} MB")


def backtest_due(today):
    """Tanggal 9 terakhir sampai hari ini, hari jadwal backtest bulanan."""
    if today.day >= BACKTEST_DAY:
        return today.replace(day=BACKTEST_DAY)
    return (today.replace(day=1) - timedelta(days=1)).replace(day=BACKTEST_DAY)


def backtest_check(stamp, today):
    if stamp is None:
        return Check("Backtest bulanan", False, "belum pernah berjalan (bagian 4a)")
    day, due = stamp.astimezone(WIB).date(), backtest_due(today)
    if day >= due:
        return Check("Backtest bulanan", True, f"terakhir {day}")
    return Check("Backtest bulanan", False, f"terakhir {day}, padahal jadwalnya {due}. Lihat bagian 4a")


def backup_check(releases, today):
    backups = sorted((r["created_at"][:10], r["tag"]) for r in releases if r["tag"].startswith("backup-"))
    if not backups:
        return Check("Backup mingguan", False, "belum ada rilis backup (bagian 7a)")
    day, tag = date.fromisoformat(backups[-1][0]), backups[-1][1]
    if day >= today - timedelta(days=BACKUP_DAYS):
        return Check("Backup mingguan", True, f"rilis terakhir `{tag}`")
    return Check("Backup mingguan", False, f"rilis terakhir `{tag}`, lebih dari {BACKUP_DAYS} hari lalu. Lihat bagian 7a")


def numbers(items):
    return ", ".join(f"#{item['number']}" for item in items)


def alarm_check(issues):
    if not issues:
        return Check("Issue alarm kegagalan", True, "tidak ada yang terbuka")
    return Check("Issue alarm kegagalan", False,
                 f"{len(issues)} masih terbuka ({numbers(issues)}). Tutup bila run sesudahnya sudah hijau (bagian 6a)")


def dependabot_check(pulls):
    if not pulls:
        return Check("Pull request Dependabot", True, "tidak ada yang terbuka")
    return Check("Pull request Dependabot", False, f"{len(pulls)} terbuka ({numbers(pulls)}). Gabungkan sesudah CI hijau")


def npm_check(report):
    """report: isi JSON `npm audit --omit=dev --json` di folder web/."""
    found = report.get("vulnerabilities") if isinstance(report, dict) else None
    if not isinstance(found, dict) or "metadata" not in report:
        return Check("Kerentanan paket situs", False, "npm audit gagal berjalan, ulangi manual di folder `web/`")
    if not found:
        return Check("Kerentanan paket situs", True, "npm audit bersih")
    items = ", ".join(f"`{name}` ({v.get('severity')})" for name, v in sorted(found.items()))
    return Check("Kerentanan paket situs", False, f"{items}. Pasang rilis keamanannya, lalu tes dan build situs")


def pinned_packages(text):
    """Pasangan (paket, versi) yang dipin di requirements.txt hasil uv pip compile."""
    return PINNED.findall(text)


def osv_vulnerabilities(packages):
    """{paket==versi: [id kerentanan]} untuk versi yang punya kerentanan di OSV."""
    queries = [{"package": {"name": n, "ecosystem": "PyPI"}, "version": v} for n, v in packages]
    body = fetch.get(OSV_URL, {"Content-Type": "application/json"}, complete=fetch.json_complete,
                     data=json.dumps({"queries": queries}).encode())
    results = json.loads(body)["results"]
    return {f"{n}=={v}": sorted(x["id"] for x in r["vulns"])
            for (n, v), r in zip(packages, results, strict=True) if r.get("vulns")}


def python_check(found):
    if not found:
        return Check("Kerentanan paket Python", True, "tidak ada yang diketahui untuk versi di requirements.txt")
    items = ", ".join(f"`{p}` ({', '.join(ids)})" for p, ids in sorted(found.items()))
    return Check("Kerentanan paket Python", False, f"{items}. Perbarui lockfile (bagian 9), lalu jalankan tes")


def token_check(runbook, today):
    match = TOKEN_DATE.search(runbook)
    if not match:
        return Check("Token GitHub untuk cron-job.org", False, "tanggal kedaluwarsanya tidak terbaca di RUNBOOK.md bagian 9")
    expiry = date.fromisoformat(match[1])
    left = (expiry - today).days
    if left > TOKEN_DAYS:
        return Check("Token GitHub untuk cron-job.org", True, f"kedaluwarsa {expiry}, {left} hari lagi")
    when = f"{left} hari lagi" if left >= 0 else "sudah lewat"
    return Check("Token GitHub untuk cron-job.org", False,
                 f"kedaluwarsa {expiry}, {when}. Buat token baru, lalu catat tanggalnya di RUNBOOK.md bagian 9")


# Issue

def reminder_issue(title, intro, lines):
    body = intro + "\n\n" + "\n".join(f"- {line}" for line in lines) + "\n\n" + FOOTER
    return {"title": title, "body": body, "close": False}


def monthly_issue(checks, today):
    auto = [f"- [{'x' if c.ok else ' '}] {c.name}: {c.detail}" for c in checks if c.ok is not None]
    auto += [f"- {c.name}: dilewati, {c.detail}" for c in checks if c.ok is None]
    body = (f"Hasil pemeriksaan {today}. Butir yang belum dicentang perlu ditindaklanjuti, caranya ada di "
            f"RUNBOOK.md bagian 9.\n\n**Diperiksa otomatis**\n\n" + "\n".join(auto) +
            "\n\n**Masih dicek manual**\n\n" + "\n".join(f"- [ ] {item}" for item in MANUAL) +
            "\n\nTutup issue ini sesudah semua butir beres.")
    return {"title": MONTHLY, "body": body, "close": False}


def test_issues(today):
    """Satu issue uji per jenis pengingat, ditutup lagi oleh workflow sesudah terbukti bisa dibuka."""
    return [{"title": TEST_PREFIX + title,
             "body": f"Uji {today}: workflow Pemeriksaan bulanan bisa membuka issue \"{title}\". "
                     f"Issue ini ditutup otomatis.",
             "close": True}
            for title in (MONTHLY, TARGETS, CALENDAR, HOLIDAYS)]


def read_state(folder, name):
    """Isi JSON dari langkah workflow sebelumnya, atau None bila tidak diberikan (run dari laptop)."""
    path = Path(folder) / name if folder else None
    if path is None or not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8-sig"))


def guarded(name, make):
    """Cek yang gagal berjalan menjadi temuan, supaya cek lain tetap jalan."""
    try:
        return make()
    except Exception as error:
        return Check(name, False, f"gagal diperiksa ({describe(error)})")


def from_state(folder, name, title, judge):
    try:
        data = read_state(folder, name)
    except (OSError, ValueError) as error:
        return Check(title, False, f"data repo tidak terbaca ({type(error).__name__})")
    if data is None:
        return Check(title, None, "hanya diperiksa di workflow")
    return guarded(title, lambda: judge(data))


def collect(today, state_dir=None):
    """Kembalikan (hasil cek bulanan, issue yang dibuka atau dikomentari). Hanya membaca database."""
    cfg = config.load()
    holidays = config.read_csv("holidays.csv")
    config.check_holidays(holidays)
    checks, latest = [], {}
    try:
        with db.connect() as conn:
            checks.append(size_check(db.size(conn)))
            checks.append(backtest_check(db.backtest_stamp(conn), today))
            latest = db.latest_releases(conn)
    except Exception as error:
        checks.append(Check("Database", False, f"tidak terbaca ({describe(error)})"))
    checks += [
        from_state(state_dir, "backups.json", "Backup mingguan", lambda d: backup_check(d, today)),
        from_state(state_dir, "alarms.json", "Issue alarm kegagalan", alarm_check),
        from_state(state_dir, "dependabot.json", "Pull request Dependabot", dependabot_check),
        from_state(state_dir, "npm-audit.json", "Kerentanan paket situs", npm_check),
        guarded("Kerentanan paket Python", lambda: python_check(
            osv_vulnerabilities(pinned_packages(REQUIREMENTS.read_text(encoding="utf-8"))))),
        guarded("Token GitHub untuk cron-job.org", lambda: token_check(RUNBOOK.read_text(encoding="utf-8"), today)),
    ]
    sources = {s["id"]: s["source"] for s in cfg["series"]}
    issues = [monthly_issue(checks, today)]
    for title, intro, lines in (
        (TARGETS, "Tabel `config/targets.csv` perlu dicocokkan dengan sumber resminya:",
         target_reminders(cfg["targets"], today)),
        (CALENDAR, "Tabel `config/release_calendar.csv` perlu diperbarui dari jadwal resmi "
                   "(BPS: https://www.bps.go.id/id/arc):",
         calendar_reminders(cfg["calendar"], latest, sources, today)),
        (HOLIDAYS, "Tabel `config/holidays.csv` perlu diperbarui:", holiday_reminders(holidays, today)),
    ):
        if lines:
            issues.append(reminder_issue(title, intro, lines))
    return checks, issues
