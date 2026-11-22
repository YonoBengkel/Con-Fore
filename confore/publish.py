"""Isi ulang tabel public.* dalam satu transaksi dengan DELETE lalu INSERT.

Jangan pernah DROP TABLE atau CREATE TABLE AS di sini: tabel baru tidak membawa GRANT, RLS,
dan kebijakan baca dari migrasi.
"""

from decimal import ROUND_HALF_UP, Decimal

from psycopg.types.json import Jsonb

from confore import db
from confore.derive import derive_all

TABLES = ("sources", "series_meta", "latest_values", "chart_series", "targets",
          "release_calendar", "revisions", "site_status")
MODEL_TABLES = ("forecast_latest", "backtest_scores", "track_record")

#: Revisi yang diterbitkan: hanya periode terakhir setiap seri, dan paling banyak sekian baris per seri.
REVISION_PERIODS = 24
REVISION_ROWS = 30
TRILLION = Decimal(10) ** 12


def next_releases(calendar, today):
    """Tanggal rilis terdekat yang belum lewat, per seri."""
    nearest = {}
    for series_id, _, _, release_date in calendar:
        if release_date >= today:
            nearest[series_id] = min(release_date, nearest.get(series_id, release_date))
    return nearest


def calendar_releases(calendar, items, today):
    """Tanggal rilis yang sudah lewat, hanya dari kalender milik sumber seri itu sendiri.

    WebAPI BPS tidak memberi tanggal rilis per angka, jadi kalender BPS mengisinya. Salinan IMF terbit
    beberapa minggu sesudah tanggal BPS, dan tanggal perkiraan (bps-perkiraan) belum tentu tanggal rilis,
    jadi keduanya tidak dipakai.
    """
    sources = {item["id"]: item["source"] for item in items}
    return {(series_id, period): release_date
            for series_id, period, calendar_source, release_date in calendar
            if release_date <= today and calendar_source == sources.get(series_id)}


def release_of(point, series_id, released):
    """Tanggal rilis satu angka: dari sumbernya, atau dari kalender bila tidak sesudah hari Con-Fore
    pertama kali melihat angka itu."""
    if point.release:
        return point.release
    release = released.get((series_id, point.period))
    return release if release and (point.seen is None or release <= point.seen) else None


def display_decimals(size, concept):
    """Desimal angka tampil di situs untuk besar angka itu, sama dengan desimalUntuk di web/lib/format.ts."""
    if concept in ("rate", "round_rate"):
        return 0 if size >= 1000 else 2
    if concept != "level":
        return 1
    return 0 if size >= 1000 else 1 if size >= 10 else 4


def shown(value, size, concept):
    """Angka seperti yang tampil di situs, termasuk "triliun" untuk angka sangat besar (nilaiPendek)."""
    value = Decimal(value)
    if size >= TRILLION:
        return (value / TRILLION).quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return value.quantize(Decimal(1).scaleb(-display_decimals(size, concept)), rounding=ROUND_HALF_UP)


def revision_rows(changes, concepts, recent):
    """Baris public.revisions: versi yang mengubah angka tampil (PRD 4.4), paling baru dulu.

    changes berasal dari db.vintage_changes. Hanya periode di `recent` (periode terakhir setiap seri),
    dan paling banyak REVISION_ROWS baris per seri, supaya tabelnya tetap kecil walau seri seperti
    indikator pendahulu OECD merevisi seluruh riwayatnya setiap bulan.
    """
    rows, counts = [], {}
    for series_id, period, vintage, old, new, release in sorted(changes, key=lambda r: (r[2], r[1]), reverse=True):
        size = max(abs(Decimal(old)), abs(Decimal(new)))
        concept = concepts.get(series_id)
        if period not in recent.get(series_id, ()) or concept is None:
            continue
        if shown(old, size, concept) == shown(new, size, concept) or counts.get(series_id, 0) >= REVISION_ROWS:
            continue
        counts[series_id] = counts.get(series_id, 0) + 1
        rows.append((series_id, period, vintage, old, new, release))
    return rows


def publish_models(conn, forecasts, scores, records):
    """Isi ulang tabel tab Prediksi dalam satu transaksi, terpisah dari publikasi data.

    Model yang gagal hanya membuat tabel ini tertinggal, dengan tanggal ramalannya tetap tampil.
    """
    with conn.transaction(), conn.cursor() as cur:
        for table in MODEL_TABLES:
            cur.execute(f"delete from public.{table}")
        cur.executemany("""
            insert into public.forecast_latest (series_id, ref_period, model, is_main, horizon, point,
              lo80, hi80, origin_date)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, forecasts)
        cur.executemany("""
            insert into public.backtest_scores (series_id, model, horizon, window_name, is_main, mae, rmse, n)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
        """, scores)
        cur.executemany("""
            insert into public.track_record (series_id, ref_period, model, origin_date, is_main, forecast,
              first_release_actual, latest_actual, abs_error, lo80, hi80)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, records)


def previous_value(points, concept):
    """Pembanding angka terbaru: periode sebelumnya, atau untuk TPT per ronde Sakernas
    (round_rate) ronde bulan yang sama tahun sebelumnya (ARCHITECTURE 4.3)."""
    if len(points) < 2:
        return None
    if concept != "round_rate":
        return points[-2].value
    last = points[-1]
    year_ago = last.start.replace(year=last.start.year - 1)
    return next((p.value for p in points if p.start == year_ago), None)


def publish(conn, cfg, status, today):
    """status adalah status run ini; last_success_at hanya maju bila status bukan failed."""
    items = cfg["series"]
    fetched = [s["id"] for s in items if "derive" not in s]
    data = db.latest_points(conn, fetched)
    derive_all(items, data)
    stale = db.stale_series(conn, fetched)
    for item in items:
        if "derive" in item and stale.intersection(item["inputs"]):
            stale.add(item["id"])
    upcoming = next_releases(cfg["calendar"], today)
    released = calendar_releases(cfg["calendar"], items, today)
    versions = db.first_vintages(conn, fetched)
    revisions = revision_rows(db.vintage_changes(conn, fetched), {s["id"]: s["concept"] for s in items},
                              {sid: {p.period for p in pts[-REVISION_PERIODS:]} for sid, pts in data.items()})

    meta, latest, charts = [], [], []
    for item in items:
        points = data.get(item["id"], [])
        last = points[-1] if points else None
        release = release_of(last, item["id"], released) if last else None
        meta.append((item["id"], item["source"], item.get("country", "IDN"), item["name"],
                     item["unit"], item["concept"], item["frequency"], item["citation"],
                     last.period if last else None, release,
                     upcoming.get(item["id"]), versions.get(item["id"])))
        if last:
            previous = previous_value(points, item["concept"])
            latest.append((item["id"], last.period, last.value, previous, release, last.seen,
                           item["source"], item["id"] in stale))
            charts.append((item["id"], [item["id"]],
                           Jsonb({item["id"]: [[p.period, float(p.value)] for p in points]})))

    stale_sources = sorted({s["source"] for s in items if s["id"] in stale})
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("select last_success_at from public.site_status where id = 1")
        previous = cur.fetchone()
        for table in TABLES:
            cur.execute(f"delete from public.{table}")
        cur.execute("""insert into public.sources select source_id, name, url, terms_url, license,
                       attribution_text from etl.sources""")
        cur.execute("""insert into public.targets select series_id, year, target_kind, value, lower,
                       upper, document, url, last_verified, verification from etl.targets""")
        cur.execute("""
            insert into public.release_calendar (series_id, ref_period, release_date, calendar_source)
            select distinct on (series_id, ref_period) series_id, ref_period, release_date,
                   calendar_source
            from etl.release_calendar where release_date >= %s
            order by series_id, ref_period, release_date
        """, (today,))
        cur.executemany("""
            insert into public.series_meta (series_id, source_id, country, name_id, unit, concept,
              frequency, citation, last_period, last_release_date, next_release_date, versions_since)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, meta)
        cur.executemany("""
            insert into public.revisions (series_id, period, vintage_date, old_value, new_value, release_date)
            values (%s, %s, %s, %s, %s, %s)
        """, revisions)
        cur.executemany("""
            insert into public.latest_values (series_id, period, value, previous_value,
              release_date, seen_date, source_id, is_stale)
            values (%s, %s, %s, %s, %s, %s, %s, %s)
        """, latest)
        cur.executemany("""
            insert into public.chart_series (chart_id, series_ids, points, updated_at)
            values (%s, %s, %s, now())
        """, charts)
        if status != "failed" or previous:
            kept = previous[0] if status == "failed" else None
            cur.execute("""insert into public.site_status (id, last_success_at, last_run_status,
                           stale_sources) values (1, coalesce(%s::timestamptz, now()), %s, %s)""",
                        (kept, status, stale_sources))
    return {"series": len(meta), "latest": len(latest), "stale": sorted(stale)}
