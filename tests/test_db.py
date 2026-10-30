"""Uji migrasi, penulisan, dan publikasi terhadap Postgres lokal sekali pakai.

Dilewati kecuali CONFORE_TEST_DB_URL diisi sebagai variabel environment (tidak dibaca dari .env),
koneksinya tersambung ke alamat mesin ini, dan nama databasenya berakhiran `_test`, karena tes ini
menghapus skema etl dan tabel public. Contoh untuk Postgres lokal tanpa TLS:
postgresql://postgres@localhost:55432/confore_test?sslmode=disable
Database uji harus punya peran anon, authenticated, dan service_role seperti Supabase; setUp
memasang default privileges lama Supabase (tabel baru terbuka untuk ketiganya) sebelum migrasi.
"""

import os
import unittest
from argparse import Namespace
from datetime import date
from decimal import Decimal
from unittest import mock
from urllib.parse import urlsplit

from confore import config, fetch
from confore.fetch import FetchError, Point

URL = os.environ.get("CONFORE_TEST_DB_URL", "")
LOCAL = urlsplit(URL).hostname in ("localhost", "127.0.0.1", "::1")
SUPABASE_DEFAULTS = """
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
"""


def quarterly(*pairs):
    return [Point(*fetch.period_of(p, "Q"), Decimal(v)) for p, v in pairs]


@unittest.skipUnless(URL and LOCAL, "CONFORE_TEST_DB_URL (localhost, database *_test) belum diisi")
class DatabaseTest(unittest.TestCase):
    def setUp(self):
        import psycopg

        from confore import db, publish
        self.db, self.publish = db, publish
        self.conn = psycopg.connect(URL, autocommit=True)
        info = self.conn.info
        if (info.hostaddr not in ("127.0.0.1", "::1") and not info.host.startswith("/")) \
                or not info.dbname.endswith("_test"):
            self.conn.close()
            self.skipTest("koneksi uji bukan database *_test di mesin ini")
        self.conn.execute("drop schema if exists etl cascade")
        for table in publish.TABLES + ("baru",):
            self.conn.execute(f"drop table if exists public.{table}")
        self.conn.execute(SUPABASE_DEFAULTS)
        self.assertEqual(len(db.migrate(self.conn)), 3)
        self.cfg = config.load()
        db.sync_config(self.conn, self.cfg)
        self.run_id = db.start_run(self.conn, "laptop", None)
        self.item = next(s for s in self.cfg["series"] if s["id"] == "idn_gdp_real_q")

    def tearDown(self):
        self.conn.close()

    def write(self, value, day):
        with self.conn.transaction(), self.conn.cursor() as cur:
            point = Point("2026-Q2", date(2026, 4, 1), Decimal(value))
            return self.db.write_observations(cur, self.item, [point], day)

    def vintages(self, period="2026-Q2"):
        return self.conn.execute("""select vintage_date, value from etl.observations
                                    where series_id = 'idn_gdp_real_q' and period = %s
                                    order by vintage_date""", (period,)).fetchall()

    def save(self, points, day, force=False):
        return self.db.save_fetch(self.conn, self.run_id, self.item, points, None, 200, day, force)

    def test_migrations_are_recorded_and_access_is_closed(self):
        self.assertEqual(self.db.migrate(self.conn), [])
        self.assertEqual(self.db.check_access(self.conn), [])
        # Default privileges lama Supabase sudah dicabut 0001: tabel baru tidak terbuka.
        self.conn.execute("create table public.baru (x int)")
        opened = self.conn.execute("""select has_table_privilege('anon', 'public.baru', 'SELECT')
                                      or has_table_privilege('authenticated', 'public.baru', 'INSERT')""")
        self.assertFalse(opened.fetchone()[0])
        self.assertIn("baru", self.db.check_access(self.conn))  # tetap ditolak: tanpa RLS dan GRANT

    def test_callable_functions_are_refused_but_trigger_functions_are_not(self):
        # Meniru public.rls_auto_enable bawaan Supabase: event trigger yang bisa "dieksekusi" anon.
        self.conn.execute("""create function public.uji_evt() returns event_trigger
                             language plpgsql security definer as $$ begin end $$""")
        self.conn.execute("create function public.uji_rpc() returns int language sql as 'select 1'")
        try:
            self.conn.execute("grant execute on function public.uji_evt(), public.uji_rpc() to anon")
            self.assertEqual(self.db.check_access(self.conn), ["uji_rpc"])
        finally:
            self.conn.execute("drop function public.uji_evt(), public.uji_rpc()")

    def test_vintages_only_on_change(self):
        day1, day2 = date(2026, 11, 1), date(2026, 11, 2)
        self.assertEqual(self.write("1.0", day1), 1)
        self.assertEqual(self.write("1.00", day1), 0)
        self.assertEqual(self.write("1.0", day2), 0)
        self.assertEqual(self.write("2.0", day2), 1)
        self.assertEqual(self.write("3.0", day2), 1)
        self.assertEqual(self.vintages(), [(day1, Decimal("1.0")), (day2, Decimal("3.0"))])
        self.write("1.0", day2)  # koreksi kembali ke vintage sebelumnya
        self.assertEqual(self.vintages(), [(day1, Decimal("1.0"))])

    def test_save_fetch_logs_hash_and_skips_unchanged(self):
        level = quarterly(("2025-Q1", "100"), ("2025-Q2", "200"), ("2026-Q1", "105"))
        today = date(2026, 11, 1)
        self.assertEqual(self.save(level, today), (3, None))
        self.assertEqual(self.save(level, today), (0, None))
        self.assertEqual(self.save(level, today, force=True), (0, None))
        changed = self.conn.execute("select changed from etl.fetch_log order by id").fetchall()
        self.assertEqual(changed, [(True,), (False,), (False,)])

    def test_withdrawn_period_becomes_null_vintage_and_can_return(self):
        full = quarterly(("2025-Q1", "100"), ("2025-Q2", "200"), ("2026-Q1", "105"))
        day1, day2, day3 = date(2026, 11, 1), date(2026, 11, 2), date(2026, 11, 3)
        self.save(full, day1)
        self.assertEqual(self.save([full[0], full[2]], day2), (1, None))
        self.assertEqual(self.vintages("2025-Q2"), [(day1, Decimal("200")), (day2, None)])
        latest = self.db.latest_points(self.conn, ["idn_gdp_real_q"])["idn_gdp_real_q"]
        self.assertEqual([p.period for p in latest], ["2025-Q1", "2026-Q1"])
        self.save(full, day3)
        self.assertEqual(self.vintages("2025-Q2")[-1], (day3, Decimal("200")))

    def test_mass_withdrawal_is_refused_unless_forced(self):
        many = quarterly(*[(f"{y}-Q{q}", "1") for y in range(2020, 2026) for q in range(1, 5)])
        self.save(many, date(2026, 11, 1))
        self.assertEqual(self.save(many[:10], date(2026, 11, 2)), (0, "terlalu banyak periode hilang"))
        self.assertEqual(len(self.db.latest_points(self.conn, ["idn_gdp_real_q"])["idn_gdp_real_q"]), 24)
        written, error = self.save(many[:10], date(2026, 11, 2), force=True)
        self.assertEqual((written, error), (14, None))

    def test_repeated_failures_and_publish(self):
        self.save(quarterly(("2025-Q1", "100"), ("2025-Q2", "200"), ("2026-Q1", "105")), date(2026, 11, 1))
        cpi = next(s for s in self.cfg["series"] if s["id"] == "idn_cpi_yoy_m")
        for _ in range(3):
            self.db.save_fetch(self.conn, self.run_id, cpi, [], "HTTP 503", 503, date(2026, 11, 1))
        self.assertEqual(self.db.repeated_failures(self.conn, ["idn_cpi_yoy_m", "idn_gdp_real_q"]),
                         ["idn_cpi_yoy_m"])

        result = self.publish.publish(self.conn, self.cfg, "partial", date(2026, 11, 3))
        self.assertEqual(result["series"], len(self.cfg["series"]))
        self.assertIn("idn_cpi_yoy_m", result["stale"])          # gagal terakhir
        self.assertIn("wld_coal_m", result["stale"])             # belum pernah diambil
        self.assertNotIn("idn_gdp_growth_q", result["stale"])    # turunan dari seri yang sehat
        growth = self.conn.execute("""select period, value, previous_value, is_stale
                                      from public.latest_values
                                      where series_id = 'idn_gdp_growth_q'""").fetchone()
        self.assertEqual(growth, ("2026-Q1", Decimal("5.0000"), None, False))
        upcoming = self.conn.execute("select min(release_date) from public.release_calendar").fetchone()[0]
        self.assertGreaterEqual(upcoming, date(2026, 11, 3))
        self.assertEqual(self.db.check_access(self.conn), [])

    def run_cli(self, fake_fetch, source=None):
        from confore import cli
        url = URL if "sslmode" in URL else URL + ("&" if "?" in URL else "?") + "sslmode=disable"
        args = Namespace(source=source, trigger="laptop", dry_run=False, full_refresh=False)
        with mock.patch.dict(os.environ, {"SUPABASE_DB_URL": url}), \
                mock.patch.object(cli.fetch, "fetch_series", side_effect=fake_fetch), \
                mock.patch.object(cli, "PAUSE", 0):
            code = cli.cmd_run(args)
        row = self.conn.execute("select status from etl.runs order by run_id desc limit 1").fetchone()
        site = self.conn.execute("select last_success_at, last_run_status from public.site_status").fetchone()
        return code, row[0], site

    def test_run_status_and_last_success(self):
        level = quarterly(("2025-Q1", "100"), ("2026-Q1", "105"), ("2026-Q2", "110"))

        def one_ok(item):
            if item["id"] != "idn_gdp_real_q":
                raise FetchError("HTTP 503", 503)
            return level

        def none_ok(item):
            raise FetchError("HTTP 503", 503)

        code, status, site = self.run_cli(one_ok)
        self.assertEqual((code, status, site[1]), (0, "partial", "partial"))
        first_success = site[0]

        code, status, site = self.run_cli(none_ok)
        self.assertEqual((code, status, site), (1, "failed", (first_success, "failed")))

        # Run --source imf yang sukses semua tetap partial, karena sumber lain masih gagal.
        code, status, site = self.run_cli(lambda item: level, source="imf")
        self.assertEqual((code, status, site[1]), (0, "partial", "partial"))
        self.assertGreater(site[0], first_success)

        # Seri BIS gagal untuk ketiga kalinya berturut-turut: run gagal, last_success_at tetap.
        code, status, after = self.run_cli(none_ok, source="bis")
        self.assertEqual((code, status, after), (1, "failed", (site[0], "failed")))

    def test_run_refuses_to_overlap(self):
        import psycopg
        other = psycopg.connect(URL, autocommit=True)
        try:
            self.db.lock(other)
            with self.assertRaises(self.db.Stop):
                self.run_cli(lambda item: [])
            self.assertEqual(self.conn.execute("select count(*) from etl.runs").fetchone()[0], 1)
        finally:
            other.close()

    def test_anon_reads_public_but_cannot_write_or_see_etl(self):
        import psycopg
        self.publish.publish(self.conn, self.cfg, "ok", date(2026, 11, 1))
        with self.conn.transaction():
            self.conn.execute("set local role anon")
            self.assertEqual(self.conn.execute("select count(*) from public.site_status").fetchone()[0], 1)
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                with self.conn.transaction():
                    self.conn.execute("insert into public.sources values ('x','x','x','x','x','x')")
            with self.assertRaises(psycopg.errors.InsufficientPrivilege):
                with self.conn.transaction():
                    self.conn.execute("select count(*) from etl.runs")


if __name__ == "__main__":
    unittest.main()
