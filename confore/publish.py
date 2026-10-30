"""Isi ulang tabel public.* dalam satu transaksi dengan DELETE lalu INSERT.

Jangan pernah DROP TABLE atau CREATE TABLE AS di sini: tabel baru tidak membawa GRANT, RLS,
dan kebijakan baca dari migrasi.
"""

from psycopg.types.json import Jsonb

from confore import db
from confore.derive import derive_all

TABLES = ("sources", "series_meta", "latest_values", "chart_series", "targets",
          "release_calendar", "site_status")


def next_releases(calendar, today):
    """Tanggal rilis terdekat yang belum lewat, per seri."""
    nearest = {}
    for series_id, _, _, release_date in calendar:
        if release_date >= today:
            nearest[series_id] = min(release_date, nearest.get(series_id, release_date))
    return nearest


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

    meta, latest, charts = [], [], []
    for item in items:
        points = data.get(item["id"], [])
        last = points[-1] if points else None
        meta.append((item["id"], item["source"], item.get("country", "IDN"), item["name"],
                     item["unit"], item["concept"], item["frequency"], item["citation"],
                     last.period if last else None, last.release if last else None,
                     upcoming.get(item["id"])))
        if last:
            previous = previous_value(points, item["concept"])
            latest.append((item["id"], last.period, last.value, previous, last.release, last.seen,
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
              frequency, citation, last_period, last_release_date, next_release_date)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, meta)
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
