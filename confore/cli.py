"""Perintah pipeline: `python -m confore <migrate, run, backtest, backup, restore, status>`.

Hasil dicetak sebagai tabel markdown ke layar dan ke ringkasan job GitHub. Error tak terduga
dicetak tanpa isi pesannya (bisa memuat host atau user database): hanya baris kode dan jenis error.
"""

import argparse
import logging
import os
import sys
import time
import traceback
from datetime import date, datetime, timedelta, timezone

from confore import availability, backup, config, db, fetch, publish, revalidate
from confore.derive import derive_all
from confore.smoke import load_dotenv

WIB = availability.WIB
PAUSE = 1.0  # jeda antarpermintaan, supaya sopan ke API sumber
TRIGGERS = {"schedule": "schedule", "workflow_dispatch": "dispatch", "push": "push"}


def wib_date(moment=None):
    """Tanggal kalender WIB (UTC+7, tanpa musim panas)."""
    return (moment or datetime.now(timezone.utc)).astimezone(WIB).date()


def quiet_psycopg():
    """Log peringatan psycopg (dan logger turunannya) bisa memuat host dan user database."""
    logging.getLogger("psycopg").setLevel(logging.CRITICAL + 1)


def describe(error):
    code = getattr(error, "sqlstate", None)
    return f"{type(error).__name__} {code}" if code else type(error).__name__


def report(title, header, rows):
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join("" if cell is None else str(cell) for cell in row) + " |"
              for row in rows]
    print(f"## {title}\n\n" + "\n".join(lines) + "\n")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write(f"## {title}\n\n" + "\n".join(lines) + "\n\n")


def fetch_all(items):
    """Ambil setiap seri; kembalikan daftar (item, points, error, http_status)."""
    results = []
    for i, item in enumerate(items):
        if i:
            time.sleep(PAUSE)
        try:
            results.append((item, fetch.fetch_series(item), None, 200))
        except fetch.FetchError as error:
            results.append((item, [], error.code, error.http_status))
        except Exception as error:  # parser rusak tidak boleh menghentikan seri lain
            results.append((item, [], type(error).__name__, None))
    return results


def cmd_migrate(args):
    with db.connect() as conn:
        db.lock(conn)
        done = db.migrate(conn)
        problems = db.check_access(conn)
    print("Migrasi diterapkan: " + (", ".join(done) if done else "tidak ada yang baru"))
    if problems:
        raise db.Stop("akses public tidak aman: " + ", ".join(problems))
    failed = db.check_data_api()
    if failed is None and os.environ.get("GITHUB_ACTIONS") == "true":
        raise db.Stop("Secret SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY wajib untuk uji Data API")
    if failed is None:
        print("Uji Data API dilewati: SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY belum diisi")
    elif failed:
        raise db.Stop("uji Data API gagal: " + ", ".join(failed))
    else:
        print("Uji Data API lulus")
    return 0


def cmd_run(args):
    cfg = config.load()
    items = [s for s in cfg["series"]
             if "derive" not in s and (not args.source or s["source"] == args.source)]
    if args.dry_run:
        return dry_run(cfg, items)

    # Ambil semua seri sebelum membuka koneksi, supaya koneksi tidak menganggur saat sumber lambat.
    results = fetch_all(items)
    today = wib_date()
    with db.connect() as conn:
        code = write_and_publish(conn, args, cfg, items, results, today)
    code = refresh_site(cfg) or code
    return run_models(cfg, today) or code


def run_models(cfg, today):
    """Ramalan harian, paling akhir dan dengan koneksi sendiri. Data sudah terbit dan situs sudah
    segar, jadi kegagalan di sini hanya membuat job merah."""
    try:
        from confore.models import forecast
        from confore.models.data import MissingInput
    except ImportError as error:
        print(f"Model gagal dimuat: {describe(error)}", file=sys.stderr)
        return 1
    try:
        with db.connect() as conn:
            db.lock(conn)
            counts = forecast.step(conn, cfg, today, os.environ.get("GITHUB_SHA"))
    except MissingInput as error:
        print(f"Model dilewati: seri {error} belum ada")
        return 0
    except (config.ConfigError, db.Stop) as error:  # pesannya aman dicetak
        print(f"Model gagal: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        traceback.print_tb(error.__traceback__)
        print(f"Model gagal: {describe(error)}", file=sys.stderr)
        return 1
    if counts is None:
        print("Model tidak dijalankan ulang: data masukan, backtest, dan kode tidak berubah")
        return 0
    report("Ramalan baru", ["Model", "Baris"], sorted(counts.items()))
    return refresh_site(cfg)  # supaya tab Prediksi langsung memakai ramalan baru


def cmd_backtest(args):
    """Backtest penuh. --dry-run mengambil data langsung dari sumber dan tidak menulis ke database."""
    from confore.models import backtest, forecast
    from confore.models.data import MissingInput, build

    cfg = config.load()
    today = wib_date()
    try:
        if args.dry_run:
            results = fetch_all([s for s in cfg["series"] if "derive" not in s])
            data = {item["id"]: points for item, points, _, _ in results}
            derive_all(cfg["series"], data)
            inputs = build(data, config.load_holidays(), today)
        else:
            with db.connect() as conn:
                inputs = forecast.latest_inputs(conn, cfg, today)
    except MissingInput as error:
        raise db.Stop(f"seri {error} belum ada") from None
    started = time.monotonic()
    frame, missed = backtest.run(inputs)
    print(f"Backtest selesai dalam {time.monotonic() - started:.0f} detik, {len(frame)} baris")
    for title, header, rows in backtest.tables(frame, missed):
        report(title, header, rows)
    offsets = backtest.error_offsets(frame)
    chosen = backtest.main_models(frame)
    rows = forecast.rows_for(inputs, offsets, today)
    report_forecasts(rows, chosen)
    if not args.dry_run:
        with db.connect() as conn:
            db.lock(conn)
            written = db.replace_backtest(conn, backtest.db_rows(frame), os.environ.get("GITHUB_SHA"))
        print(f"etl.backtest diganti: {written} baris")
    return 0


def report_forecasts(rows, chosen):
    """Tabel ramalan terbaru per seri: titik dan rentang 80% dari model angka utama horizon itu."""
    from confore.models.backtest import BASELINES, LABELS, number

    values = {(r[0], r[1], r[2], r[3]): r[4] for r in rows}
    out = []
    for series_id, ref, model, stat, value, horizon in rows:
        # Horizon yang belum pernah terjadi di backtest memakai baseline pertama.
        main = chosen.get((series_id, horizon), BASELINES[0])
        if stat != "point" or model != main:
            continue
        band = [values.get((series_id, ref, model, s)) for s in ("lo80", "hi80")]
        text = f"{number(band[0], 2)} sampai {number(band[1], 2)}" if None not in band else "-"
        out.append((series_id, ref, LABELS.get(model, model), number(value, 2), text))
    report("Ramalan terbaru memakai angka utama per horizon",
           ["Seri", "Periode", "Model", "Titik", "Rentang 80%"], out)


def cmd_backup(args):
    """Tulis arsip dari satu snapshot. Hanya membaca database."""
    with db.connect() as conn:
        tables = backup.export(conn, args.path, os.environ.get("GITHUB_SHA"))
    report("Backup", ["Tabel", "Baris"], tables.items())
    print(f"Arsip ditulis: {os.path.basename(args.path)}, {os.path.getsize(args.path) / 1024:.0f} KB")
    return 0


def cmd_restore(args):
    """Isi database baru dari arsip. Menolak tabel yang sudah berisi."""
    with db.connect() as conn:
        db.lock(conn)
        tables = backup.restore(conn, args.path)
    report("Pemulihan", ["Tabel", "Baris"], tables.items())
    print("Lanjutkan dengan: python -m confore run")
    return 0


def cmd_status(args):
    """Hasil per hari untuk uji tujuh hari, dan keadaan situs sekarang. Hanya membaca database."""
    if args.days < 1:
        raise db.Stop("--days minimal 1")
    now = datetime.now(timezone.utc)
    start = args.since or wib_date(now) - timedelta(days=args.days - 1)
    with db.connect() as conn:
        runs = db.all_runs(conn)
        site = db.site_status(conn)
    result = availability.evaluate(runs, start, args.days, now)
    names = {True: "lulus", False: "gagal", None: "belum"}
    report(f"Uji {args.days} hari sejak {start}",
           ["Tanggal", "Run harian", "Run hari rilis", "Run lain, tidak dihitung", "Hasil"],
           [(d.day, d.daily, d.release, d.other, names[d.passed]) for d in result.days])
    if result.largest_gap is not None:
        print(f"Selang terbesar antar-run otomatis yang sukses: {result.largest_gap:.1f} jam "
              f"(batas {availability.MAX_GAP_HOURS})")
    if site:
        print(f"Pembaruan terakhir: {site[0].astimezone(WIB):%Y-%m-%d %H.%M} WIB, "
              f"{(now - site[0]).total_seconds() / 3600:.1f} jam lalu, status {site[1]}, "
              f"sumber terlambat: {', '.join(site[2]) or '-'}")
    done = sum(1 for d in result.days if d.passed)
    print(f"Hasil: {result.verdict}, {done} dari {args.days} hari lulus")
    return 1 if result.verdict == "gagal" else 0


def refresh_site(cfg):
    """Segarkan situs sesudah data terbit. Data sudah aman, jadi kegagalan di sini hanya membuat
    job merah (GitHub mengirim email), tanpa mengubah status run di database."""
    try:
        result = revalidate.refresh([s["id"] for s in cfg["series"]])
    except fetch.FetchError as error:
        print(f"Revalidasi situs gagal: {error.code}", file=sys.stderr)
        return 1
    if result is None:
        if os.environ.get("GITHUB_ACTIONS") == "true":
            print("Revalidasi situs gagal: Secret SITE_URL dan REVALIDATE_SECRET belum diisi",
                  file=sys.stderr)
            return 1
        print("Revalidasi situs dilewati: SITE_URL atau REVALIDATE_SECRET belum diisi")
        return 0
    report("Revalidasi situs", ["Alamat dipicu", "Belum punya halaman (404)", "Pemanasan berhenti"],
           [(result.warmed, result.missing, result.stopped or "-")])
    return 0


def run_trigger(explicit):
    """Pemicu yang dicatat di etl.runs. Run ulang dari tab Actions memakai nama pemicu aslinya, tetapi
    itu campur tangan manual, jadi tidak boleh dihitung otomatis di uji tujuh hari."""
    if os.environ.get("GITHUB_RUN_ATTEMPT", "1") != "1":
        return "dispatch"
    return explicit or TRIGGERS.get(os.environ.get("GITHUB_EVENT_NAME", ""), "laptop")


def write_and_publish(conn, args, cfg, items, results, today):
    db.lock(conn)
    problems = db.check_access(conn)
    if problems:
        raise db.Stop("akses public tidak aman: " + ", ".join(problems))
    if db.size(conn) > db.SIZE_WARNING:
        print("Peringatan: ukuran database melewati 300 MB dari batas 500 MB")
    trigger = run_trigger(args.trigger)
    run_id = db.start_run(conn, trigger, os.environ.get("GITHUB_SHA"))
    try:
        db.sync_config(conn, cfg)
        rows = []
        for item, points, error, http_status in results:
            written, error = db.save_fetch(conn, run_id, item, points, error, http_status, today,
                                           force=args.full_refresh)
            rows.append((item["id"], error or "ok", len(points),
                         points[-1].period if points else None, written))
        # Status menilai semua seri, bukan hanya yang diambil run ini (--source).
        every = [s["id"] for s in cfg["series"] if "derive" not in s]
        failing = db.repeated_failures(conn, every)
        if failing or not any(row[1] == "ok" for row in rows):
            status = "failed"
        else:
            status = "partial" if db.stale_series(conn, every) else "ok"
        result = publish.publish(conn, cfg, status, today)
    except BaseException:
        try:
            db.finish_run(conn, run_id, "failed")
            db.mark_site_failed(conn)
        except Exception:
            pass  # error aslinya yang dilaporkan
        raise
    db.finish_run(conn, run_id, status)
    report(f"Run {run_id} ({trigger}): {status}",
           ["Seri", "Hasil", "Baris", "Periode terakhir", "Baris vintage baru"], rows)
    print(f"Publikasi: {result['series']} seri, {result['latest']} angka terbaru, "
          f"terlambat: {', '.join(result['stale']) or '-'}")
    if failing:
        print(f"Gagal {db.FAILURE_LIMIT} kali berturut-turut: {', '.join(failing)}")
    return 1 if status == "failed" else 0


def dry_run(cfg, items):
    """Ambil dan hitung turunan tanpa database, lalu cetak ringkasannya."""
    results = fetch_all(items)
    data = {item["id"]: points for item, points, _, _ in results}
    derive_all(cfg["series"], data)
    errors = {item["id"]: error for item, _, error, _ in results if error}
    rows = []
    for item in cfg["series"]:
        if item["id"] not in data:
            continue
        points = data[item["id"]]
        last = points[-1] if points else None
        rows.append((item["id"], errors.get(item["id"], "ok"), len(points),
                     last.period if last else None, last.value if last else None))
    report("Uji tanpa database", ["Seri", "Hasil", "Baris", "Periode terakhir", "Nilai terakhir"], rows)
    return 1 if errors else 0


def main(argv=None):
    load_dotenv()
    quiet_psycopg()
    parser = argparse.ArgumentParser(prog="python -m confore")
    commands = parser.add_subparsers(required=True)
    migrate = commands.add_parser("migrate", help="terapkan migrasi SQL, lalu uji akses")
    migrate.set_defaults(func=cmd_migrate)
    run = commands.add_parser("run", help="ambil data, simpan, dan publikasi")
    run.add_argument("--source", choices=sorted(fetch.BASES), help="hanya ambil satu sumber")
    run.add_argument("--trigger", choices=["schedule", "release", "push", "dispatch", "laptop"])
    run.add_argument("--dry-run", action="store_true", help="ambil dan hitung tanpa database")
    run.add_argument("--full-refresh", action="store_true",
                     help="tulis ulang observasi walau hash data sama dengan run sebelumnya")
    run.set_defaults(func=cmd_run)
    test = commands.add_parser("backtest", help="uji model pada data lama, lalu tulis etl.backtest")
    test.add_argument("--dry-run", action="store_true", help="ambil data dari sumber, tanpa database")
    test.set_defaults(func=cmd_backtest)
    save = commands.add_parser("backup", help="tulis arsip tabel yang tidak bisa dibangun ulang")
    save.add_argument("path", help="berkas tujuan, misalnya confore-backup-2026-11-09.tar.gz")
    save.set_defaults(func=cmd_backup)
    load = commands.add_parser("restore", help="isi database baru dari arsip backup")
    load.add_argument("path", help="berkas arsip")
    load.set_defaults(func=cmd_restore)
    status = commands.add_parser("status", help="hasil per hari untuk uji tujuh hari")
    status.add_argument("--since", type=date.fromisoformat, help="tanggal WIB hari pertama, YYYY-MM-DD")
    status.add_argument("--days", type=int, default=7, help="panjang jendela, bawaan 7 hari")
    status.set_defaults(func=cmd_status)
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (config.ConfigError, db.Stop) as error:
        print(f"Berhenti: {error}", file=sys.stderr)
    except Exception as error:
        traceback.print_tb(error.__traceback__)
        print(f"Gagal: {describe(error)}", file=sys.stderr)
    return 1
