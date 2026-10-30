import logging
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

from confore import cli, config, db, fetch
from confore.derive import derive_all, ratio, yoy
from confore.fetch import FetchError, Point
from confore.publish import next_releases, previous_value


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

    def test_registry_derivations_follow_inputs(self):
        cfg = config.load()
        data = {s["id"]: [] for s in cfg["series"] if "derive" not in s}
        derive_all(cfg["series"], data)
        self.assertEqual(data["idn_gdp_growth_q"], [])
        self.assertIn("usd_idr_d", data)


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


if __name__ == "__main__":
    unittest.main()
