"""Akses database: migrasi, pemeriksaan akses, dan data kerja di skema etl.

Pesan error psycopg bisa memuat host dan nama user database, jadi pemanggil hanya mencetak
nama jenis error dan SQLSTATE (lihat cli.describe). Semua SQL memakai nama berskema.
"""

import json
import os
import re
import urllib.error
import urllib.request

import psycopg
from psycopg.conninfo import conninfo_to_dict

from confore.config import ROOT
from confore.fetch import Point, data_hash
from confore.smoke import NoRedirect

MIGRATIONS = ROOT / "supabase" / "migrations"
SUPABASE_CA = ROOT / "config" / "supabase-ca.crt"
SIZE_WARNING = 300 * 1024 * 1024
FAILURE_LIMIT = 3
LOCK_ID = 2026_10_30  # kunci advisory: satu run atau migrasi pada satu waktu


class Stop(Exception):
    """Kondisi yang membuat run berhenti; pesannya aman dicetak."""


def tls_options(url):
    """Opsi TLS koneksi: sslmode di string koneksi menang; bila tidak ada, verifikasi sertifikat
    server dengan CA Supabase (config/supabase-ca.crt) bila berkasnya ada, atau minimal enkripsi."""
    if "sslmode" in conninfo_to_dict(url):
        return {}
    if SUPABASE_CA.is_file():
        return {"sslmode": "verify-full", "sslrootcert": str(SUPABASE_CA)}
    return {"sslmode": "require"}


def connect():
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        raise Stop("SUPABASE_DB_URL belum diisi")
    return psycopg.connect(url, autocommit=True, prepare_threshold=None, connect_timeout=30,
                           **tls_options(url))


def lock(conn):
    """Kunci sesi supaya run dari laptop dan dari GitHub tidak menulis bersamaan."""
    if not conn.execute("select pg_try_advisory_lock(%s)", (LOCK_ID,)).fetchone()[0]:
        raise Stop("run atau migrasi lain sedang berjalan; coba lagi nanti")


def migrate(conn):
    """Terapkan migrasi yang belum tercatat, masing-masing dalam satu transaksi.

    Katalog akses diperiksa di dalam transaksi itu, jadi migrasi yang membuka akses dibatalkan.
    """
    applied = set()
    if conn.execute("select to_regclass('etl.schema_migrations')").fetchone()[0]:
        applied = {row[0] for row in conn.execute("select version from etl.schema_migrations")}
    done = []
    for path in sorted(MIGRATIONS.glob("*.sql")):
        if path.stem in applied:
            continue
        with conn.transaction():
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("insert into etl.schema_migrations (version) values (%s)", (path.stem,))
            problems = check_access(conn)
            if problems:
                raise Stop(f"migrasi {path.stem} dibatalkan, akses tidak aman: " + ", ".join(problems))
        done.append(path.stem)
    return done


def check_access(conn):
    """Akses yang salah: objek di public, tabel etl, default privileges, dan hak skema."""
    write = "INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER"
    if conn.info.server_version >= 170000:
        write += ",MAINTAIN"
    tables = conn.execute(f"""
        select c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p','v','m','f')
          and ((c.relkind in ('r','p') and not c.relrowsecurity)
            or not has_table_privilege('anon', c.oid, 'SELECT')
            or has_table_privilege('anon', c.oid, '{write}')
            or has_any_column_privilege('anon', c.oid, 'INSERT,UPDATE,REFERENCES')
            or has_table_privilege('authenticated', c.oid, 'SELECT,{write}')
            or has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
            or (c.relkind in ('r','p') and not exists (
                  select 1 from pg_policies p
                  where p.schemaname = n.nspname and p.tablename = c.relname
                    and p.cmd in ('SELECT','ALL') and p.permissive = 'PERMISSIVE'
                    and p.roles && array['anon','public']::name[]))
            or c.relkind in ('m','f')
            or (c.relkind = 'v'
                and not coalesce(c.reloptions @> array['security_invoker=true'], false)))
    """).fetchall()
    etl_tables = conn.execute(f"""
        select 'etl.' || c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'etl' and c.relkind in ('r','p','v','m','f')
          and (has_table_privilege('anon', c.oid, 'SELECT,{write}')
            or has_table_privilege('authenticated', c.oid, 'SELECT,{write}'))
    """).fetchall()
    sequences = conn.execute("""
        select c.relname
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'etl') and c.relkind = 'S'
          and (has_sequence_privilege('anon', c.oid, 'USAGE,SELECT,UPDATE')
            or has_sequence_privilege('authenticated', c.oid, 'USAGE,SELECT,UPDATE'))
    """).fetchall()
    # Fungsi trigger dan event trigger tidak bisa dipanggil langsung (juga lewat RPC), jadi tidak
    # dihitung. Contoh: public.rls_auto_enable bawaan Supabase untuk event trigger ensure_rls.
    functions = conn.execute("""
        select p.proname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
          and (has_function_privilege('anon', p.oid, 'EXECUTE')
               or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    """).fetchall()
    defaults = conn.execute("""
        select 'default privileges ' || n.nspname
        from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
        where d.defaclrole = 'postgres'::regrole and n.nspname in ('public', 'etl')
          and exists (select 1 from aclexplode(d.defaclacl) a
                      where a.grantee in ('anon'::regrole, 'authenticated'::regrole))
    """).fetchall()
    schemas = conn.execute("""
        select 'skema ' || n.nspname
        from pg_namespace n
        where (n.nspname = 'etl' and (has_schema_privilege('anon', n.oid, 'USAGE')
                                      or has_schema_privilege('authenticated', n.oid, 'USAGE')))
           or (n.nspname in ('etl', 'public') and (has_schema_privilege('anon', n.oid, 'CREATE')
                                                   or has_schema_privilege('authenticated', n.oid, 'CREATE')))
    """).fetchall()
    return sorted(row[0] for row in tables + etl_tables + sequences + functions + defaults + schemas)


def check_data_api():
    """Uji Data API dengan publishable key: baca boleh, tulis ditolak, skema etl tidak dibuka.

    Fungsi RPC tidak diuji di sini: public tidak punya fungsi, dan cek katalog sudah menolak
    fungsi public yang bisa dipanggil anon.

    Kembalikan None bila SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY belum diisi, atau daftar
    nama uji yang gagal.
    """
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if not url or not key:
        return None
    if not url.startswith("https://") or not re.fullmatch(r"[A-Za-z0-9_.-]+", key):
        raise Stop("format SUPABASE_URL atau SUPABASE_PUBLISHABLE_KEY tidak valid")
    opener = urllib.request.build_opener(NoRedirect)

    def status(method, path, body=None, profile=None):
        headers = {"apikey": key, "Content-Type": "application/json"}
        if profile:
            headers["Accept-Profile"] = profile
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url + path, data=data, headers=headers, method=method)
        try:
            with opener.open(request, timeout=30) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    checks = {
        "baca public": status("GET", "/rest/v1/site_status?select=id") == 200,
        "tulis public ditolak": status("POST", "/rest/v1/sources", {"source_id": "uji"}) in (401, 403),
        "etl tidak terlihat": status("GET", "/rest/v1/runs?select=run_id", profile="etl") >= 400,
    }
    return [name for name, passed in checks.items() if not passed]


def size(conn):
    return conn.execute("select pg_database_size(current_database())").fetchone()[0]


def sync_config(conn, cfg):
    """Salin isi config/ ke etl: sumber dan seri di-upsert, target dan kalender diganti penuh."""
    with conn.transaction(), conn.cursor() as cur:
        cur.executemany("""
            insert into etl.sources (source_id, name, url, terms_url, license, attribution_text)
            values (%(source_id)s, %(name)s, %(url)s, %(terms_url)s, %(license)s, %(attribution_text)s)
            on conflict (source_id) do update set name = excluded.name, url = excluded.url,
              terms_url = excluded.terms_url, license = excluded.license,
              attribution_text = excluded.attribution_text
        """, cfg["sources"])
        cur.executemany("""
            insert into etl.series (series_id, source_id, country, dataset, source_key, frequency,
                                    unit, concept, is_target, name_id, citation, active)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            on conflict (series_id) do update set source_id = excluded.source_id,
              country = excluded.country, dataset = excluded.dataset,
              source_key = excluded.source_key, frequency = excluded.frequency,
              unit = excluded.unit, concept = excluded.concept, is_target = excluded.is_target,
              name_id = excluded.name_id, citation = excluded.citation, active = true
        """, [(s["id"], s["source"], s.get("country", "IDN"), s.get("dataset", "turunan"),
               s.get("query"), s["frequency"], s["unit"], s["concept"], s.get("is_target", False),
               s["name"], s["citation"]) for s in cfg["series"]])
        cur.execute("update etl.series set active = false where series_id <> all(%s)",
                    ([s["id"] for s in cfg["series"]],))
        cur.execute("delete from etl.targets")
        cur.executemany("""
            insert into etl.targets (series_id, year, target_kind, value, lower, upper, document,
                                     url, last_verified, verification)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, cfg["targets"])
        cur.execute("delete from etl.release_calendar")
        cur.executemany("""
            insert into etl.release_calendar (series_id, ref_period, calendar_source, release_date)
            values (%s, %s, %s, %s)
        """, cfg["calendar"])


def start_run(conn, trigger, git_sha):
    return conn.execute("insert into etl.runs (trigger, git_sha) values (%s, %s) returning run_id",
                        (trigger, git_sha)).fetchone()[0]


def finish_run(conn, run_id, status):
    conn.execute("update etl.runs set status = %s, finished_at = now() where run_id = %s",
                 (status, run_id))


def mark_site_failed(conn):
    conn.execute("update public.site_status set last_run_status = 'failed' where id = 1")


def withdraw_limit(live):
    """Berapa periode boleh hilang dari sumber dalam satu pengambilan tanpa dianggap error."""
    return max(5, live // 10)


def save_fetch(conn, run_id, item, points, error, http_status, vintage, force=False):
    """Tulis observasi yang berubah (termasuk periode yang ditarik sumber) dan satu baris fetch_log.

    Penulisan dilewati bila hash data sama dengan hash terakhir seri itu, kecuali force (mode
    full refresh, misalnya setelah tabel observasi diubah manual atau dipulihkan dari backup).
    Bila terlalu banyak periode hilang sekaligus, pengambilan dicatat sebagai error dan tidak
    ditulis, kecuali force. Kembalikan (jumlah baris observasi yang ditambah, dikoreksi, atau
    dihapus; error efektif).
    """
    digest = data_hash(points) if points else None
    with conn.transaction(), conn.cursor() as cur:
        changed, written = None, 0
        if digest:
            cur.execute("""select data_hash from etl.fetch_log
                           where series_id = %s and data_hash is not null
                           order by id desc limit 1""", (item["id"],))
            previous = cur.fetchone()
            changed = previous is None or previous[0] != digest
        if changed or (force and points):
            cur.execute("""
                select count(*), count(*) filter (where period <> all(%s))
                from (select distinct on (period) period, value from etl.observations
                      where series_id = %s order by period, vintage_date desc) live
                where value is not null
            """, ([p.period for p in points], item["id"]))
            live, missing = cur.fetchone()
            if missing > withdraw_limit(live) and not force:
                error, changed = "terlalu banyak periode hilang", None
            else:
                written = write_observations(cur, item, points, vintage)
        cur.execute("""
            insert into etl.fetch_log (run_id, series_id, source_id, http_status, error, data_hash,
                                       n_rows, max_period, changed)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (run_id, item["id"], item["source"], http_status, error,
              None if error else digest, len(points), points[-1].period if points else None, changed))
    return written, error


def write_observations(cur, item, points, vintage):
    cur.execute("create temp table tmp_obs (like etl.observations including defaults) on commit drop")
    with cur.copy("""copy tmp_obs (series_id, period, vintage_date, period_start, value,
                                   source_id, source_status) from stdin""") as copy:
        for p in points:
            copy.write_row((item["id"], p.period, vintage, p.start, p.value, item["source"], p.status))
    # Periode yang masih tampil tetapi tidak ada lagi di sumber: catat sebagai vintage NULL.
    cur.execute("""
        insert into tmp_obs (series_id, period, vintage_date, period_start, value, source_id)
        select o.series_id, o.period, %s, o.period_start, null, o.source_id
        from (select distinct on (period) series_id, period, period_start, value, source_id
              from etl.observations where series_id = %s
              order by period, vintage_date desc) o
        where o.value is not null and not exists (select 1 from tmp_obs s where s.period = o.period)
    """, (vintage, item["id"]))
    # Koreksi di hari yang sama yang mengembalikan nilai ke vintage sebelumnya: hapus baris hari ini.
    cur.execute("""
        delete from etl.observations o using tmp_obs s
        where o.series_id = s.series_id and o.period = s.period and o.vintage_date = s.vintage_date
          and o.value is distinct from s.value
          and s.value is not distinct from (select p.value from etl.observations p
                                           where p.series_id = o.series_id and p.period = o.period
                                             and p.vintage_date < o.vintage_date
                                           order by p.vintage_date desc limit 1)
    """)
    removed = cur.rowcount
    cur.execute("""
        insert into etl.observations (series_id, period, vintage_date, period_start, value,
                                      release_date, source_id, source_status, seen_at)
        select s.series_id, s.period, s.vintage_date, s.period_start, s.value,
               s.release_date, s.source_id, s.source_status, now()
        from tmp_obs s
        left join lateral (
          select o.value from etl.observations o
          where o.series_id = s.series_id and o.period = s.period
          order by o.vintage_date desc
          limit 1
        ) last on true
        where last.value is distinct from s.value
        on conflict (series_id, period, vintage_date) do update
          set value = excluded.value, seen_at = now()
          where etl.observations.value is distinct from excluded.value
    """)
    return removed + cur.rowcount


def repeated_failures(conn, series_ids):
    """Seri yang gagal diambil pada FAILURE_LIMIT percobaan terakhirnya."""
    rows = conn.execute("""
        select series_id from (
          select series_id, error,
                 row_number() over (partition by series_id order by id desc) as rn
          from etl.fetch_log where series_id = any(%s)) recent
        where rn <= %s
        group by series_id
        having count(*) = %s and bool_and(error is not null)
    """, (series_ids, FAILURE_LIMIT, FAILURE_LIMIT)).fetchall()
    return sorted(row[0] for row in rows)


def stale_series(conn, series_ids):
    """Seri yang pengambilan terakhirnya gagal atau belum pernah berhasil diambil."""
    rows = conn.execute("""select distinct on (series_id) series_id, error is null
                           from etl.fetch_log where series_id = any(%s)
                           order by series_id, id desc""", (series_ids,)).fetchall()
    healthy = {series_id for series_id, ok in rows if ok}
    return set(series_ids) - healthy


def latest_points(conn, series_ids):
    """Vintage terbaru setiap periode, per seri, terurut menurut waktu; periode yang ditarik
    sumber (vintage terbarunya NULL) tidak ikut."""
    data = {series_id: [] for series_id in series_ids}
    rows = conn.execute("""
        select * from (
          select distinct on (series_id, period)
                 series_id, period, period_start, value, release_date, vintage_date
          from etl.observations where series_id = any(%s)
          order by series_id, period, vintage_date desc) latest
        where value is not null
    """, (series_ids,))
    for series_id, period, start, value, release, seen in rows:
        data[series_id].append(Point(period, start, value, seen=seen, release=release))
    for points in data.values():
        points.sort(key=lambda p: p.start)
    return data
