import logging
import os
import tempfile
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from datetime import date, datetime, timezone
from decimal import Decimal
from email.message import Message
from io import BytesIO
from unittest import mock

from confore import cli, config, db, fetch, revalidate
from confore.derive import chain, derive_all, ratio, share, yoy
from confore.fetch import FetchError, Point
from confore import publish
from confore.publish import (calendar_releases, display_decimals, last_release, next_releases, previous_value,
                             release_of, revision_rows)


def points(*pairs, frequency="Q"):
    return [Point(*fetch.period_of(period, frequency), Decimal(value)) for period, value in pairs]


class PeriodTest(unittest.TestCase):
    def test_formats_per_frequency(self):
        self.assertEqual(fetch.period_of("2025", "A"), ("2025", date(2025, 1, 1)))
        self.assertEqual(fetch.period_of("2026-Q3", "Q"), ("2026-Q3", date(2026, 7, 1)))
        self.assertEqual(fetch.period_of("2026-M09", "M"), ("2026-09", date(2026, 9, 1)))
        self.assertEqual(fetch.period_of("2026-09", "M"), ("2026-09", date(2026, 9, 1)))
        self.assertEqual(fetch.period_of("2026-10-29", "D")[1], date(2026, 10, 29))

    def test_rejects_mismatched_period(self):
        for raw, frequency in [("2026-Q5", "Q"), ("2026-13", "M"), ("2026", "M"), ("2026-Q1", "A")]:
            with self.assertRaises(ValueError):
                fetch.period_of(raw, frequency)


class ParseTest(unittest.TestCase):
    def test_skips_empty_values_and_sorts(self):
        body = "TIME_PERIOD,OBS_VALUE\n2026-M02,2.5\n2026-M01,\n2025-M12,3.1\n"
        result = fetch.parse(body, "M")
        self.assertEqual([p.period for p in result], ["2025-12", "2026-02"])
        self.assertEqual(result[-1].value, Decimal("2.5"))

    def test_nan_counts_as_missing(self):
        body = "TIME_PERIOD,OBS_VALUE\n2024,5.0\n2025,NaN\n"
        self.assertEqual([p.period for p in fetch.parse(body, "A")], ["2024"])

    def test_actual_only_drops_projection_years(self):
        body = ("TIME_PERIOD,OBS_VALUE,LATEST_ACTUAL_ANNUAL_DATA\n"
                "2025,5.1,2025\n2026,5.0,2025\n2027,x,2025\n")
        self.assertEqual([p.period for p in fetch.parse(body, "A", actual_only=True)], ["2025"])
        with self.assertRaises(FetchError):
            fetch.parse("TIME_PERIOD,OBS_VALUE\n2025,5.1\n", "A", actual_only=True)

    def test_dated_reads_the_edition_date_in_wib(self):
        head = "TIME_PERIOD,OBS_VALUE,PUBLICATION_DATE\n"
        # 13 Oktober 2026 pukul 02.00 UTC = 09.00 WIB; pukul 18.00 UTC sudah tanggal berikutnya di WIB.
        body = head + "2026,5.1,2026-10-13T02:00:00Z\n2027,5.2,2026-10-13T18:00:00Z\n"
        self.assertEqual([p.release for p in fetch.parse(body, "A", dated=True)],
                         [date(2026, 10, 13), date(2026, 10, 14)])
        self.assertEqual([p.release for p in fetch.parse(body, "A")], [None, None])
        for raw in ("", "x", "2026-10-13", "2026-10-13T02:00:00"):  # tanpa zona waktu, tanggal WIB-nya tidak pasti
            with self.subTest(raw), self.assertRaisesRegex(FetchError, "tanpa tanggal terbit"):
                fetch.parse(head + f"2026,5.1,{raw}\n", "A", dated=True)
        with self.assertRaisesRegex(FetchError, "tanpa tanggal terbit"):
            fetch.parse("TIME_PERIOD,OBS_VALUE\n2026,5.1\n", "A", dated=True)

    def test_dated_key_reaches_the_parser(self):
        item = {"source": "imf", "query": "IMF.RES,WEO/MYS.LUR.A?startPeriod=2024", "frequency": "A"}
        body = "TIME_PERIOD,OBS_VALUE,PUBLICATION_DATE\n2026,3.0,2026-10-13T02:00:00Z\n"
        with mock.patch.object(fetch, "get", return_value=body):
            self.assertEqual(fetch.fetch_series({**item, "dated": True})[0].release, date(2026, 10, 13))
            self.assertIsNone(fetch.fetch_series(item)[0].release)

    def test_contract_errors(self):
        cases = ["PERIOD,VALUE\n2025,1\n",                        # kolom berubah
                 "TIME_PERIOD,OBS_VALUE\n2025,1\n2025,2\n",       # dua seri tercampur
                 "TIME_PERIOD,OBS_VALUE\n2025,\n",                # tanpa data
                 "TIME_PERIOD,OBS_VALUE\n2025,NaN\n",             # hanya nilai hilang
                 "TIME_PERIOD,OBS_VALUE\n2025,abc\n",             # nilai tidak valid
                 "TIME_PERIOD,OBS_VALUE\n2025,Infinity\n",
                 "TIME_PERIOD,OBS_VALUE\n2025-Q1,1\n"]            # periode salah frekuensi
        for body in cases:
            with self.assertRaises(FetchError):
                fetch.parse(body, "A")

    def test_hash_ignores_trailing_zeros(self):
        a = fetch.parse("TIME_PERIOD,OBS_VALUE\n2025,5.750\n2024,100\n", "A")
        b = fetch.parse("TIME_PERIOD,OBS_VALUE\n2025,5.75\n2024,1E+2\n", "A")
        self.assertEqual(fetch.data_hash(a), fetch.data_hash(b))


def response(body, missing=0):
    """Jawaban HTTP palsu; missing = sisa byte Content-Length yang belum terbaca."""
    handle = mock.MagicMock()
    handle.__enter__.return_value.read.return_value = body
    handle.__enter__.return_value.length = missing
    handle.__enter__.return_value.headers = Message()
    return handle


class GetTest(unittest.TestCase):
    def http_error(self, code):
        return urllib.error.HTTPError("https://example.test/key/RAHASIA", code, "x", Message(), BytesIO())

    def test_retries_then_succeeds(self):
        ok = response(b"TIME_PERIOD,OBS_VALUE\n")
        with mock.patch.object(fetch.OPENER, "open", side_effect=[self.http_error(503), ok]), \
                mock.patch("time.sleep") as sleep:
            self.assertEqual(fetch.get("https://example.test", {}), "TIME_PERIOD,OBS_VALUE\n")
        sleep.assert_called_once()

    def test_low_ratelimit_remaining_pauses(self):
        for headers, wait in [({"RateLimit-Remaining": "19"}, None),
                              ({"RateLimit-Remaining": "3"}, 60),
                              ({"RateLimit-Remaining": "0", "RateLimit-Reset": "7"}, 7),
                              ({"RateLimit-Remaining": "0", "RateLimit-Reset": "999"}, 60)]:
            ok = response(b"TIME_PERIOD,OBS_VALUE\n")
            for name, value in headers.items():
                ok.__enter__.return_value.headers[name] = value
            with self.subTest(headers=headers), \
                    mock.patch.object(fetch.OPENER, "open", return_value=ok), \
                    mock.patch("time.sleep") as sleep:
                fetch.get("https://example.test", {})
            if wait is None:
                sleep.assert_not_called()
            else:
                sleep.assert_called_once_with(wait)

    def test_truncated_body_is_retried_then_rejected(self):
        for cut in [response(b"TIME_PERIOD,OBS_VALUE\n2026-10-29,20193", missing=3),
                    response(b"TIME_PERIOD,OBS_VALUE\n2026-10-29,20193")]:  # tanpa Content-Length
            with mock.patch.object(fetch.OPENER, "open", return_value=cut), mock.patch("time.sleep"):
                with self.assertRaises(FetchError) as caught:
                    fetch.get("https://example.test", {})
            self.assertEqual(caught.exception.code, "IncompleteRead")

    def test_redirect_only_to_https(self):
        handler = fetch.HttpsOnlyRedirect()
        request = urllib.request.Request("https://api.example.test/data")
        self.assertIsNone(handler.redirect_request(request, None, 302, "x", Message(),
                                                   "http://api.example.test/data"))
        self.assertIsNotNone(handler.redirect_request(request, None, 302, "x", Message(),
                                                      "https://cdn.example.test/data"))

    def test_error_code_has_no_url(self):
        with mock.patch.object(fetch.OPENER, "open", side_effect=self.http_error(404)):
            with self.assertRaises(FetchError) as caught:
                fetch.get("https://example.test/key/RAHASIA", {})
        self.assertEqual(caught.exception.code, "HTTP 404")
        self.assertIsNone(caught.exception.__cause__)
        self.assertTrue(caught.exception.__suppress_context__)

    def test_data_sends_post(self):
        with mock.patch.object(fetch.KEYED_OPENER, "open", return_value=response(b'{"ok":true}')) as opened:
            fetch.get("https://example.test", {}, opener=fetch.KEYED_OPENER,
                      complete=fetch.json_complete, data=b"")
        self.assertEqual(opened.call_args.args[0].get_method(), "POST")


class RevalidateTest(unittest.TestCase):
    SITE = {"SITE_URL": "https://situs.test/", "REVALIDATE_SECRET": "RAHASIA"}
    KOSONG = {"SITE_URL": "", "REVALIDATE_SECRET": ""}

    def refresh(self, env, side_effect=None):
        with mock.patch.dict(os.environ, env), mock.patch("time.sleep"), \
                mock.patch.object(fetch, "get", side_effect=side_effect) as get:
            return revalidate.refresh(["a"]), get

    def test_skipped_without_config(self):
        result, get = self.refresh(self.KOSONG)
        self.assertIsNone(result)
        get.assert_not_called()

    def test_posts_without_redirect_then_warms_every_address(self):
        result, get = self.refresh(self.SITE)
        self.assertEqual(result, revalidate.Result(12, 0, None))
        post, *warm = get.call_args_list
        self.assertEqual(post.args, ("https://situs.test/api/revalidate", {"x-revalidate-secret": "RAHASIA"}))
        self.assertIs(post.kwargs["opener"], fetch.KEYED_OPENER)
        self.assertEqual(post.kwargs["data"], b"")
        self.assertEqual([call.args for call in warm],
                         [(f"https://situs.test{path}", {})
                          for path in ["/indonesia", "/indonesia/harga", "/indonesia/kerja", "/indonesia/ekonomi",
                                       "/indonesia/ke-depan", "/banding/malaysia", "/banding/thailand",
                                       "/banding/filipina", "/banding/vietnam", "/tentang-data", "/indikator/a",
                                       "/api/csv/a"]])

    def test_new_series_404_is_counted(self):
        # POST, sepuluh halaman, lalu halaman data per seri baru yang belum dibangun (404), lalu CSV-nya.
        result, _ = self.refresh(self.SITE, [None] * 11 + [FetchError("HTTP 404", 404), None])
        self.assertEqual(result, revalidate.Result(11, 1, None))

    def test_other_warm_error_stops_without_raising(self):
        result, get = self.refresh(self.SITE, [None, None, FetchError("HTTP 500", 500)])
        self.assertEqual(result, revalidate.Result(1, 0, "HTTP 500"))
        self.assertEqual(get.call_count, 3)

    def test_post_error_reaches_caller(self):
        with self.assertRaises(FetchError):
            self.refresh(self.SITE, FetchError("HTTP 401", 401))

    def test_rejects_plain_http(self):
        with mock.patch.dict(os.environ, {**self.SITE, "SITE_URL": "http://situs.test"}), \
                mock.patch.object(fetch, "get") as get:
            with self.assertRaises(FetchError):
                revalidate.refresh(["a"])
        get.assert_not_called()

    def test_refresh_site_exit_code(self):
        cfg = {"series": [{"id": "a"}]}
        for name, env, outcome, code in [
                ("berhasil", {}, {"return_value": revalidate.Result(1, 0, None)}, 0),
                ("pemanasan berhenti", {}, {"return_value": revalidate.Result(1, 0, "HTTP 500")}, 0),
                ("POST gagal", {}, {"side_effect": FetchError("HTTP 401", 401)}, 1),
                ("kosong di laptop", {"GITHUB_ACTIONS": "false"}, {"return_value": None}, 0),
                ("kosong di GitHub", {"GITHUB_ACTIONS": "true"}, {"return_value": None}, 1)]:
            with self.subTest(name), mock.patch.dict(os.environ, env), \
                    mock.patch.object(revalidate, "refresh", **outcome), \
                    mock.patch.object(cli, "report"), mock.patch("builtins.print"):
                self.assertEqual(cli.refresh_site(cfg), code)

    def test_projection_series_have_a_csv_but_no_detail_page(self):
        paths = revalidate.paths(["bps_cpi_yoy_m", "idn_gdp_growth_weo_a"])
        self.assertIn("/indikator/bps_cpi_yoy_m", paths)
        self.assertNotIn("/indikator/idn_gdp_growth_weo_a", paths)
        self.assertIn("/api/csv/idn_gdp_growth_weo_a", paths)

    def test_cmd_run_refreshes_after_connection_closes(self):
        args = mock.Mock(source=None, dry_run=False)
        for written, refreshed, models, code in [(0, 0, 0, 0), (1, 0, 0, 1), (0, 1, 0, 1), (0, 0, 1, 1)]:
            order = mock.MagicMock()
            order.write.return_value = written
            order.refresh.return_value = refreshed
            order.models.return_value = models
            with self.subTest(written=written, refreshed=refreshed, models=models), \
                    mock.patch.object(config, "load", return_value={"series": []}), \
                    mock.patch.object(db, "connect", order.connect), \
                    mock.patch.object(cli, "write_and_publish", order.write), \
                    mock.patch.object(cli, "refresh_site", order.refresh), \
                    mock.patch.object(cli, "run_models", order.models):
                self.assertEqual(cli.cmd_run(args), code)
            names = [call[0] for call in order.mock_calls]
            self.assertLess(names.index("write"), names.index("connect().__exit__"))
            self.assertLess(names.index("connect().__exit__"), names.index("refresh"))
            # Model paling akhir: model yang macet tidak boleh menahan penyegaran situs.
            self.assertLess(names.index("refresh"), names.index("models"))

    def test_cmd_run_does_not_refresh_when_publish_raises(self):
        args = mock.Mock(source=None, dry_run=False)
        with mock.patch.object(config, "load", return_value={"series": []}), \
                mock.patch.object(db, "connect", mock.MagicMock()), \
                mock.patch.object(cli, "write_and_publish", side_effect=db.Stop("x")), \
                mock.patch.object(cli, "refresh_site") as refresh:
            with self.assertRaises(db.Stop):
                cli.cmd_run(args)
        refresh.assert_not_called()


class DeriveTest(unittest.TestCase):
    def test_yoy_needs_same_period_last_year(self):
        level = points(("2025-Q1", "100"), ("2025-Q2", "200"), ("2026-Q1", "105"), ("2026-Q2", "190"))
        self.assertEqual([(p.period, p.value) for p in yoy(level)],
                         [("2026-Q1", Decimal("5.0000")), ("2026-Q2", Decimal("-5.0000"))])

    def test_ratio_matches_periods(self):
        top = points(("2026-10-28", "20000"), ("2026-10-29", "20193.16"), frequency="D")
        bottom = points(("2026-10-29", "1.113"), frequency="D")
        self.assertEqual([(p.period, p.value) for p in ratio(top, bottom)],
                         [("2026-10-29", Decimal("18143.0009"))])

    def test_chain_compounds_only_twelve_consecutive_months(self):
        months = [f"2025-{month:02d}" for month in range(1, 13)] + ["2026-01", "2026-03"]
        result = chain(points(*[(month, "1") for month in months], frequency="M"))
        self.assertEqual([(p.period, p.value) for p in result],
                         [("2025-12", Decimal("12.6825")), ("2026-01", Decimal("12.6825"))])
        self.assertEqual(chain(points(("2025-01", "1"), frequency="M")), [])

    def test_share_needs_every_part_in_the_same_period(self):
        first = points(("2025-08", "5063122"), ("2026-02", "5310544"), frequency="M")
        second = points(("2025-08", "56777423"), ("2026-02", "54615241"), frequency="M")
        total = points(("2026-02", "147667630"), ("2026-08", "150000000"), frequency="M")
        self.assertEqual([(p.period, p.value) for p in share(first, second, total)],
                         [("2026-02", Decimal("40.5815"))])

    def test_registry_derivations_follow_inputs(self):
        cfg = config.load()
        data = {s["id"]: [] for s in cfg["series"] if "derive" not in s}
        derive_all(cfg["series"], data)
        self.assertEqual(data["idn_gdp_growth_q"], [])
        self.assertIn("usd_idr_d", data)
        self.assertEqual(data["bps_formal_share_round"], [])


class ConfigTest(unittest.TestCase):
    def test_repository_config_is_valid(self):
        cfg = config.load()
        ids = {s["id"] for s in cfg["series"]}
        self.assertTrue({"idn_gdp_growth_a", "idn_cpi_eop_a", "idn_unemp_a"} <= ids)
        self.assertTrue(all(row[0] in ids for row in cfg["targets"]))

    def test_rejects_bad_target(self):
        series = {"idn_gdp_growth_a": {"frequency": "A"}}
        row = {"series_id": "idn_gdp_growth_a", "year": "2026", "target_kind": "apbn", "value": "",
               "lower": "5", "upper": "4", "document": "UU", "url": "https://x.test",
               "last_verified": "2026-10-25", "verification": "berita"}
        with self.assertRaises(config.ConfigError):
            config.check_targets([row], series)
        with self.assertRaises(config.ConfigError):
            config.check_targets([{**row, "lower": "", "upper": ""}], series)

    def test_rejects_duplicate_calendar_row(self):
        series = {"s": {"frequency": "M"}}
        row = {"series_id": "s", "ref_period": "2026-11", "calendar_source": "bps",
               "release_date": "2026-12-01"}
        with self.assertRaises(config.ConfigError):
            config.check_calendar([row, dict(row)], series)

    def test_comparison_series_cover_four_countries(self):
        weo = {s["id"]: s for s in config.load()["series"] if s["id"].endswith("_weo_a")}
        self.assertEqual(len(weo), 15)
        for prefix, country in [("idn", "IDN"), ("mys", "MYS"), ("tha", "THA"), ("phl", "PHL"), ("vnm", "VNM")]:
            for name, code in [("gdp_growth", "NGDP_RPCH"), ("cpi_eop", "PCPIEPCH"), ("unemp", "LUR")]:
                item = weo[f"{prefix}_{name}_weo_a"]
                with self.subTest(item["id"]):
                    self.assertEqual(item.get("country", "IDN"), country)
                    self.assertTrue(item["query"].startswith(f"IMF.RES,WEO/{country}.{code}.A?startPeriod="))
                    self.assertTrue(item["dated"])
                    twin = weo[f"idn_{name}_weo_a"]
                    self.assertEqual((item["unit"], item["concept"], item["citation"]),
                                     (twin["unit"], twin["concept"], twin["citation"]))

    def test_rejects_dated_without_the_full_weo_answer(self):
        base = {"id": "a", "source": "imf", "frequency": "A", "unit": "%", "concept": "yoy",
                "name": "A", "citation": "c", "dataset": "WEO", "query": "IMF.RES,WEO/IDN.LUR.A?startPeriod=2024"}
        for key in ("dated", "actual_only"):
            self.assertIn("a", config.check_series([{**base, key: True}], {"imf"}))
            for change in ({"query": base["query"] + "&detail=dataonly"}, {"dataset": "QNEA"}):
                with self.subTest(key=key, **change), self.assertRaises(config.ConfigError):
                    config.check_series([{**base, **change, key: True}], {"imf"})

    def test_rejects_derive_before_input(self):
        items = [{"id": "b", "source": "imf", "frequency": "Q", "unit": "%", "concept": "yoy",
                  "name": "B", "citation": "c", "derive": "yoy", "inputs": ["a"]}]
        with self.assertRaises(config.ConfigError):
            config.check_series(items, {"imf"})


class TimeAndSafetyTest(unittest.TestCase):
    def test_wib_date_at_midnight_boundary(self):
        # Cron harian 23.17 UTC = 06.17 WIB keesokan harinya.
        self.assertEqual(cli.wib_date(datetime(2026, 10, 30, 16, 59, tzinfo=timezone.utc)),
                         date(2026, 10, 30))
        self.assertEqual(cli.wib_date(datetime(2026, 10, 30, 17, 0, tzinfo=timezone.utc)),
                         date(2026, 10, 31))
        self.assertEqual(cli.wib_date(datetime(2026, 10, 30, 23, 17, tzinfo=timezone.utc)),
                         date(2026, 10, 31))

    def test_describe_hides_message(self):
        error = RuntimeError("password=RAHASIA host=db.contoh")
        error.sqlstate = "28P01"
        self.assertEqual(cli.describe(error), "RuntimeError 28P01")

    def test_psycopg_child_loggers_are_quiet(self):
        cli.quiet_psycopg()
        self.assertFalse(logging.getLogger("psycopg.transaction").isEnabledFor(logging.CRITICAL))

    def test_tls_requires_encryption_and_verifies_with_ca(self):
        url = "postgresql://postgres.ref:pw_sslmode_x@pooler.example.test:5432/postgres"
        with tempfile.TemporaryDirectory() as folder:
            missing = Path(folder) / "tidak-ada.crt"
            with mock.patch.object(db, "SUPABASE_CA", missing):
                self.assertEqual(db.tls_options(url), {"sslmode": "require"})
                self.assertEqual(db.tls_options(url + "?sslmode=disable"), {})
            ca = Path(folder) / "ca.crt"
            ca.write_text("x")
            with mock.patch.object(db, "SUPABASE_CA", ca):
                self.assertEqual(db.tls_options(url),
                                 {"sslmode": "verify-full", "sslrootcert": str(ca)})

    def test_previous_value_compares_same_sakernas_round(self):
        rounds = points(("2025-02", "4.76"), ("2025-08", "4.85"), ("2025-11", "4.74"),
                        ("2026-02", "4.68"), frequency="M")
        self.assertEqual(previous_value(rounds, "round_rate"), Decimal("4.76"))
        self.assertEqual(previous_value(rounds, "rate"), Decimal("4.74"))
        self.assertIsNone(previous_value(rounds[1:], "round_rate"))  # Februari 2025 tidak ada

    def test_next_release_skips_past_dates(self):
        calendar = [("s", "2026-09", "bps", date(2026, 10, 1)),
                    ("s", "2026-11", "bps", date(2026, 12, 1)),
                    ("s", "2026-10", "bps", date(2026, 11, 2))]
        self.assertEqual(next_releases(calendar, date(2026, 10, 31)), {"s": date(2026, 11, 2)})

    def test_calendar_release_only_from_the_series_own_source(self):
        items = [{"id": "bps_x", "source": "bps"}, {"id": "idn_x", "source": "imf"}]
        calendar = [("bps_x", "2026-10", "bps", date(2026, 11, 2)),
                    ("idn_x", "2026-10", "bps", date(2026, 11, 2)),           # salinan IMF terbit belakangan
                    ("bps_x", "2026-09", "bps-perkiraan", date(2026, 10, 5)),  # perkiraan, bukan rilis
                    ("bps_x", "2026-11", "bps", date(2026, 12, 1))]            # belum lewat
        self.assertEqual(calendar_releases(calendar, items, date(2026, 11, 20)),
                         {("bps_x", "2026-10"): date(2026, 11, 2)})

    def test_release_of_prefers_the_source_and_never_follows_the_day_it_was_seen(self):
        released = {("s", "2026-10"): date(2026, 11, 2)}
        point = Point("2026-10", date(2026, 10, 1), Decimal("3.2"), seen=date(2026, 11, 2))
        self.assertEqual(release_of(point, "s", released), date(2026, 11, 2))
        self.assertIsNone(release_of(point._replace(seen=date(2026, 11, 1)), "s", released))
        self.assertEqual(release_of(point._replace(seen=None), "s", released), date(2026, 11, 2))
        self.assertEqual(release_of(point._replace(release=date(2026, 11, 3)), "s", released), date(2026, 11, 3))
        self.assertIsNone(release_of(point._replace(period="2026-09"), "s", released))

    def test_last_release_is_the_newest_edition_of_the_series(self):
        # Edisi baru yang hanya mengubah 2027: angka 2026 dan 2031 tetap bertanggal edisi lama.
        old, new = date(2026, 4, 14), date(2026, 10, 13)
        rows = [Point(str(year), date(year, 1, 1), Decimal("3"), release=release)
                for year, release in [(2026, old), (2027, new), (2031, old)]]
        self.assertEqual(last_release(rows, old), new)
        # Sumber tanpa tanggal (BPS): tanggal dari kalender tetap dipakai.
        bare = [p._replace(release=None) for p in rows]
        self.assertEqual(last_release(bare, old), old)
        self.assertIsNone(last_release([], None))

    def test_display_decimals_match_the_site(self):
        # Sama dengan desimalUntuk di web/lib/format.ts.
        self.assertEqual(display_decimals(Decimal("4.75"), "round_rate"), 2)
        self.assertEqual(display_decimals(Decimal("18143"), "rate"), 0)
        self.assertEqual(display_decimals(Decimal("3.2"), "yoy"), 1)
        self.assertEqual(display_decimals(Decimal("0.5"), "level"), 4)
        self.assertEqual(display_decimals(Decimal("15"), "level"), 1)
        self.assertEqual(display_decimals(Decimal("18143"), "level"), 0)

    def test_revisions_only_when_the_shown_number_changes(self):
        concepts = {"s": "yoy", "big": "level"}
        recent = {"s": {"2026-09", "2026-10"}, "big": {"2026-Q3"}}
        changes = [
            ("s", "2026-10", date(2026, 11, 3), Decimal("3.23"), Decimal("3.24"), None),  # tetap 3,2
            ("s", "2026-10", date(2026, 11, 4), Decimal("3.24"), Decimal("3.31"), None),  # 3,2 jadi 3,3
            ("s", "2026-09", date(2026, 11, 4), Decimal("2.95"), Decimal("2.84"), None),  # 3,0 jadi 2,8
            ("s", "2025-01", date(2026, 11, 4), Decimal("1.0"), Decimal("9.0"), None),    # bukan periode terakhir
            ("big", "2026-Q3", date(2026, 11, 4), Decimal("3.2e15"), Decimal("3.2001e15"), None),  # tetap 3.200 triliun
            ("other", "2026-10", date(2026, 11, 4), Decimal("1"), Decimal("2"), None),     # seri tidak dikenal
        ]
        self.assertEqual(revision_rows(changes, concepts, recent), [
            ("s", "2026-10", date(2026, 11, 4), Decimal("3.24"), Decimal("3.31"), None),
            ("s", "2026-09", date(2026, 11, 4), Decimal("2.95"), Decimal("2.84"), None),
        ])
        with mock.patch.object(publish, "REVISION_ROWS", 1):
            self.assertEqual(len(revision_rows(changes, concepts, recent)), 1)


if __name__ == "__main__":
    unittest.main()
