"""Tes pengambil data BPS WebAPI dengan fixture JSON kecil (dipangkas dari jawaban asli, tanpa key)."""

import json
import os
import urllib.error
from datetime import date
from decimal import Decimal
from email.message import Message
from io import BytesIO
from unittest import TestCase, main, mock

from confore import config, fetch
from confore.fetch import FetchError
from confore.smoke import NoRedirect

FAKE_KEY = "FAKEKEY123abc"


def bps_body(vervar, var, turvar, tahun, turtahun, content, status="OK"):
    return json.dumps({
        "status": status, "data-availability": "available", "last_update": "2026-10-01 11:00:00",
        "var": [{"val": var, "label": "Variabel uji", "unit": "Persen", "decimal": 2}],
        "turvar": [{"val": turvar, "label": "Tidak ada"}],
        "labelvervar": "38 Provinsi",
        "vervar": [{"val": v, "label": "INDONESIA"} for v in vervar],
        "tahun": [{"val": val, "label": label} for val, label in tahun],
        "turtahun": [{"val": val, "label": label} for val, label in turtahun],
        "datacontent": content, "related": None,
    })


# Inflasi y-on-y (var 2263, baris INDONESIA 9999): Agustus dan September 2026, plus Tahunan 2025.
CPI = bps_body([9999], 2263, "0", [(125, "2025"), (126, "2026")],
               [(8, "Agustus"), (9, "September"), (13, "Tahunan")],
               {"9999226301258": 2.31, "9999226301259": 2.65, "99992263012513": 2.92,
                "9999226301268": 3.19, "9999226301269": 3.28, "99992263012613": ""})
# Laju pertumbuhan PDB y-on-y (var 104, baris PDB 99003, turvar 5).
GDP = bps_body([99003], 104, 5, [(126, "2026")],
               [(31, "Triwulan I"), (32, "Triwulan II"), (33, "Triwulan III"), (35, "Tahunan")],
               {"99003104512631": 5.61, "99003104512632": 5.29})
# TPT per ronde Sakernas (var 2562): Februari dan Mei 2026; Agustus belum rilis.
TPT = bps_body([9999], 2562, "0", [(126, "2026")],
               [(325, "Februari"), (326, "Mei"), (327, "Agustus"), (328, "November")],
               {"999925620126325": 4.68, "999925620126326": 4.65})
# Tiga jawaban OK dengan datacontent kosong (bentuk dicek ke WebAPI 2026-10-30). Hanya yang
# pertama berarti tahun itu belum ada data: var, vervar, dan turvar tetap satu baris.
EMPTY = bps_body([9999], 2263, "0", [], [(1, "Januari"), (13, "Tahunan")], [])
UNKNOWN_VAR = json.dumps({"status": "OK", "data-availability": "available", "var": [],
                          "turvar": [], "vervar": [], "tahun": [], "turtahun": [],
                          "datacontent": [], "related": None})
UNKNOWN_ROW = bps_body([], 2263, "0", [(126, "2026")], [(1, "Januari"), (13, "Tahunan")], [])


class PeriodTest(TestCase):
    def test_labels_map_to_standard_periods(self):
        self.assertEqual(fetch.bps_period("2026", "September", "M"), ("2026-09", date(2026, 9, 1)))
        self.assertEqual(fetch.bps_period("2026", "Mei", "M"), ("2026-05", date(2026, 5, 1)))
        self.assertEqual(fetch.bps_period("2026", "Triwulan II", "Q"), ("2026-Q2", date(2026, 4, 1)))
        self.assertIsNone(fetch.bps_period("2026", "Tahunan", "Q"))

    def test_rejects_unknown_labels(self):
        for year, sub, frequency in [("2026", "Triwulan I", "M"), ("2026", "Januari", "Q"),
                                     ("2026", "Semester I", "M"), ("26", "Mei", "M"),
                                     ("2026", "Triwulan V", "Q")]:
            with self.assertRaises(ValueError):
                fetch.bps_period(year, sub, frequency)

    def test_th_ids_and_three_year_chunks(self):
        self.assertEqual(fetch.bps_th([2024, 2025, 2026]), "124:126")
        self.assertEqual(fetch.bps_th([2011]), "111")
        chunks = fetch.bps_year_chunks(2011, 2026)
        self.assertEqual(chunks[0], [2024, 2025, 2026])
        self.assertEqual(chunks[-1], [2011])
        self.assertEqual(sorted(y for chunk in chunks for y in chunk), list(range(2011, 2027)))
        self.assertEqual(fetch.bps_year_chunks(2024, 2026), [[2024, 2025, 2026]])


class ParseTest(TestCase):
    def test_monthly_cpi(self):
        result = fetch.parse_bps(CPI, "M", [2025, 2026])
        self.assertEqual([p.period for p in result], ["2025-08", "2025-09", "2026-08", "2026-09"])
        self.assertEqual(result[-1].value, Decimal("3.28"))

    def test_quarterly_gdp_skips_yearly_and_missing(self):
        result = fetch.parse_bps(GDP, "Q", [2026])
        self.assertEqual([(p.period, p.value) for p in result],
                         [("2026-Q1", Decimal("5.61")), ("2026-Q2", Decimal("5.29"))])

    def test_sakernas_rounds_use_survey_month(self):
        result = fetch.parse_bps(TPT, "M", [2026])
        self.assertEqual([(p.period, p.value) for p in result],
                         [("2026-02", Decimal("4.68")), ("2026-05", Decimal("4.65"))])

    def test_year_without_data_is_empty(self):
        self.assertEqual(fetch.parse_bps(EMPTY, "M", [2027], "2263"), [])

    def test_unknown_variable_or_row_is_not_empty_data(self):
        for body, var in [(UNKNOWN_VAR, "2562"), (UNKNOWN_ROW, "2263"), (CPI, "2562")]:
            with self.subTest(var=var), self.assertRaises(FetchError) as caught:
                fetch.parse_bps(body, "M", [2025, 2026], var)
            self.assertEqual(caught.exception.code, "dimensi berubah")

    def test_contract_errors(self):
        cases = {
            "status bukan OK": bps_body([9999], 1, "0", [], [], {}, status="Error"),
            "dimensi berubah": bps_body([9999, 1100], 2263, "0", [(126, "2026")],
                                        [(9, "September")], {"9999226301269": 3.28}),
            "kode tidak dikenal": bps_body([9999], 2263, "0", [(126, "2026")],
                                           [(9, "September")], {"1100226301269": 1.0}),
            "periode tidak valid": bps_body([9999], 2263, "0", [(126, "2026")],
                                            [(9, "Semester I")], {}),
            "nilai tidak valid": bps_body([9999], 2263, "0", [(126, "2026")],
                                          [(9, "September")], {"9999226301269": "abc"}),
            # "12"+"31" dan "1"+"231" menghasilkan kode yang sama.
            "kode ganda": bps_body([9999], 1, "0", [(12, "2012"), (1, "2001")],
                                   [(31, "Triwulan I"), (231, "Triwulan II")], {}),
            "bukan JSON": CPI[:-20],
        }
        for code, body in cases.items():
            with self.subTest(code=code), self.assertRaises(FetchError) as caught:
                fetch.parse_bps(body, "Q" if code == "kode ganda" else "M")
            self.assertEqual(caught.exception.code, code)

    def test_year_outside_request_is_rejected(self):
        with self.assertRaises(FetchError) as caught:
            fetch.parse_bps(CPI, "M", [2026])
        self.assertEqual(caught.exception.code, "periode tidak valid")


def response(body):
    handle = mock.MagicMock()
    handle.__enter__.return_value.read.return_value = body.encode()
    handle.__enter__.return_value.length = 0
    handle.__enter__.return_value.headers = Message()
    return handle


class FetchTest(TestCase):
    item = {"id": "bps_unemp_round", "source": "bps", "frequency": "M",
            "query": "domain/0000/var/543/sejak/2025?vervar=9999 + "
                     "domain/0000/var/2562/sejak/2026?vervar=9999"}

    def test_key_only_in_request_url_and_later_variable_wins(self):
        older = bps_body([9999], 543, "0", [(125, "2025"), (126, "2026")],
                         [(189, "Februari"), (190, "Agustus"), (191, "Tahunan")],
                         {"99995430125189": 4.76, "99995430126189": 4.70})
        with mock.patch.dict(os.environ, {"BPS_API_KEY": FAKE_KEY}), \
                mock.patch.object(fetch.KEYED_OPENER, "open",
                                  side_effect=[response(older), response(TPT)]) as opened, \
                mock.patch("time.sleep") as sleep:
            result = fetch.fetch_bps(self.item, today=date(2026, 10, 30))
        urls = [call.args[0].full_url for call in opened.call_args_list]
        self.assertEqual(urls, [
            f"https://webapi.bps.go.id/v1/api/list/model/data/domain/0000/var/543/th/125:126"
            f"/key/{FAKE_KEY}/?vervar=9999",
            f"https://webapi.bps.go.id/v1/api/list/model/data/domain/0000/var/2562/th/126"
            f"/key/{FAKE_KEY}/?vervar=9999"])
        sleep.assert_called_once_with(fetch.BPS_PAUSE)
        self.assertEqual([(p.period, p.value) for p in result],
                         [("2025-02", Decimal("4.76")), ("2026-02", Decimal("4.68")),
                          ("2026-05", Decimal("4.65"))])

    def test_every_merged_variable_must_return_data(self):
        older = bps_body([9999], 543, "0", [(125, "2025"), (126, "2026")],
                         [(189, "Februari"), (190, "Agustus")],
                         {"99995430125189": 4.76, "99995430125190": 4.91})
        empty = bps_body([9999], 2562, "0", [], [(325, "Februari")], [])
        for second, code in [(UNKNOWN_VAR, "dimensi berubah"), (empty, "tanpa data")]:
            with self.subTest(code=code), mock.patch.dict(os.environ, {"BPS_API_KEY": FAKE_KEY}), \
                    mock.patch.object(fetch.KEYED_OPENER, "open",
                                      side_effect=[response(older), response(second)]), \
                    mock.patch("time.sleep"), self.assertRaises(FetchError) as caught:
                fetch.fetch_bps(self.item, today=date(2026, 10, 30))
            self.assertEqual(caught.exception.code, code)

    def test_missing_or_malformed_key_never_echoed(self):
        for value, code in [("", "BPS_API_KEY belum diisi"),
                            ("FAKE KEY123", "format BPS_API_KEY tidak valid")]:
            with mock.patch.dict(os.environ, {"BPS_API_KEY": value}), \
                    self.assertRaises(FetchError) as caught:
                fetch.fetch_bps(self.item)
            self.assertEqual(caught.exception.code, code)

    def test_http_error_hides_url_with_key(self):
        error = urllib.error.HTTPError(f"https://webapi.bps.go.id/key/{FAKE_KEY}/", 403, "x",
                                       Message(), BytesIO())
        with mock.patch.dict(os.environ, {"BPS_API_KEY": FAKE_KEY}), \
                mock.patch.object(fetch.KEYED_OPENER, "open", side_effect=error):
            with self.assertRaises(FetchError) as caught:
                fetch.fetch_bps(self.item, today=date(2026, 10, 30))
        self.assertEqual(caught.exception.code, "HTTP 403")
        self.assertIsNone(caught.exception.__cause__)
        self.assertTrue(caught.exception.__suppress_context__)

    def test_truncated_json_is_retried_then_rejected(self):
        with mock.patch.object(fetch.KEYED_OPENER, "open", return_value=response(CPI[:-1])), \
                mock.patch("time.sleep"):
            with self.assertRaises(FetchError) as caught:
                fetch.get("https://example.test", {}, fetch.KEYED_OPENER, fetch.json_complete)
        self.assertEqual(caught.exception.code, "IncompleteRead")

    def test_keyed_requests_do_not_follow_redirects(self):
        self.assertTrue(any(isinstance(h, NoRedirect) for h in fetch.KEYED_OPENER.handlers))


def table_cells(*cells):
    return "<tr>" + "".join(f"<td>{cell}</td>" for cell in cells) + "</tr>"


def table_body(years, header=None, status="OK"):
    """Tabel 908 versi kecil. years: {tahun: (y-to-d, [m-to-m sejak Januari])} untuk kolom Inti;
    kolom lain berisi nol. Bentuknya mengikuti jawaban asli: gaya, judul, baris tahun lalu bulannya
    dari yang terbaru, dan baris kosong di akhir."""
    first, *rest = header or fetch.BPS_TABLE_HEADER
    rows = ['<tr><td colspan="6">Inflasi Umum , Inti</td></tr><tr><td colspan="6"></td></tr>',
            f'<tr><td colspan="2">{first}</td>' + "".join(f"<td>{cell}</td>" for cell in rest) + "</tr>"]
    for year, (year_to_date, months) in years.items():
        rows.append(table_cells(year, "", "0,00", year_to_date, "0,00", "0,00"))
        rows += [table_cells("", name, "0,00", value, "0,00", "0,00")
                 for name, value in reversed(list(zip(fetch.BPS_MONTHS, months)))]
    rows.append(table_cells("", "", "", "", "", ""))
    html = "<style>table {color:#000}</style><table>" + "".join(rows) + "</table>"
    return json.dumps({"status": status, "data-availability": "available",
                       "data": {"table_id": 908, "title": "Inflasi", "table": html}})


YEAR_2025 = ("1,21", ["0,10"] * 12)
# Baris 2022 sengaja rusak (mirip Maret 2022 di tabel asli): di luar tahun yang diminta, jadi diabaikan.
TABLE = table_body({2026: ("0,06", ["-0,15", "~ 0", "0.21"]), 2025: YEAR_2025,
                    2022: ("9,99", ["0,08"])})


class TableTest(TestCase):
    def setUp(self):
        fetch.bps_table_body.cache_clear()
        self.addCleanup(fetch.bps_table_body.cache_clear)

    def test_reads_one_column_since_year_in_time_order(self):
        result = fetch.parse_bps_table(TABLE, "inti", 2025)
        self.assertEqual(len(result), 15)
        self.assertEqual(result[0].period, "2025-01")
        # Koma, tanda "~ 0" (mendekati nol), dan titik desimal yang tersesat di tabel asli.
        self.assertEqual([(p.period, p.value) for p in result[-3:]],
                         [("2026-01", Decimal("-0.15")), ("2026-02", Decimal("0")),
                          ("2026-03", Decimal("0.21"))])
        self.assertEqual({p.value for p in fetch.parse_bps_table(TABLE, "umum", 2025)},
                         {Decimal("0.00")})

    def test_wrong_cell_fails_the_year_to_date_check(self):
        body = table_body({2025: ("1,21", ["0,10"] * 2 + ["0,80"] + ["0,10"] * 9)})
        with self.assertRaises(FetchError) as caught:
            fetch.parse_bps_table(body, "inti", 2025)
        self.assertEqual(caught.exception.code, "y-to-d tidak cocok")

    def test_rounding_stays_inside_the_year_to_date_check(self):
        # Selisih sekecil pembulatan: 12 x 0,10 menghasilkan 1,2066, baris y-to-d menulis 1,25.
        result = fetch.parse_bps_table(table_body({2025: ("1,25", ["0,10"] * 12)}), "inti", 2025)
        self.assertEqual(len(result), 12)

    def test_contract_errors(self):
        months = ["0,10"] * 12
        cases = {
            "bukan JSON": TABLE[:-20],
            "status bukan OK": table_body({2025: YEAR_2025}, status="Error"),
            "kolom berubah": table_body({2025: YEAR_2025},
                                        header=["Tahun/Bulan", "Umum", "Inti", "Bergejolak"]),
            "bulan tidak lengkap": table_body({2026: ("0,10", ["0,10"]), 2025: ("1,11", months[:11])}),
            "nilai tidak valid": table_body({2025: ("1,21", ["abc"] + months[1:])}),
            "periode tidak valid": table_body({2025: YEAR_2025}).replace("<td>Mei</td>",
                                                                         "<td>Semester I</td>"),
            "periode ganda": table_body({2025: YEAR_2025}).replace("<td>Mei</td>", "<td>Juni</td>"),
        }
        for code, body in cases.items():
            with self.subTest(code=code), self.assertRaises(FetchError) as caught:
                fetch.parse_bps_table(body, "inti", 2025)
            self.assertEqual(caught.exception.code, code)

    def test_blank_month_inside_the_year_is_a_gap(self):
        body = table_body({2026: ("0,20", ["0,10", "", "0,10"])})
        with self.assertRaises(FetchError) as caught:
            fetch.parse_bps_table(body, "inti", 2026)
        self.assertEqual(caught.exception.code, "bulan tidak lengkap")

    def test_no_row_since_year_is_no_data(self):
        with self.assertRaises(FetchError) as caught:
            fetch.parse_bps_table(TABLE, "inti", 2030)
        self.assertEqual(caught.exception.code, "tanpa data")

    def test_one_request_for_all_columns_and_key_only_in_url(self):
        items = [{"source": "bps", "frequency": "M",
                  "query": f"domain/0000/tabel/908/kolom/{column}/sejak/2025"}
                 for column in ("inti", "umum")]
        with mock.patch.dict(os.environ, {"BPS_API_KEY": FAKE_KEY}), \
                mock.patch.object(fetch.KEYED_OPENER, "open", return_value=response(TABLE)) as opened:
            results = [fetch.fetch_series(item) for item in items]
        self.assertEqual([len(points) for points in results], [15, 15])
        opened.assert_called_once()
        self.assertEqual(opened.call_args.args[0].full_url,
                         "https://webapi.bps.go.id/v1/api/view/model/statictable/lang/ind/domain/0000"
                         f"/id/908/key/{FAKE_KEY}/")


class ConfigTest(TestCase):
    def test_registry_has_bps_series_without_key(self):
        cfg = config.load()
        bps = {s["id"]: s for s in cfg["series"] if s["source"] == "bps" and "derive" not in s}
        self.assertEqual(set(bps), {"bps_cpi_yoy_m", "bps_gdp_growth_q", "bps_unemp_round",
                                    "bps_work_employer_round", "bps_work_employee_round",
                                    "bps_work_total_round", "bps_cpi_mom_m", "bps_cpi_core_mom_m",
                                    "bps_cpi_admin_mom_m", "bps_cpi_volatile_mom_m"})
        self.assertEqual(bps["bps_unemp_round"]["concept"], "round_rate")
        for item in bps.values():
            self.assertNotIn("key", item["query"])
            self.assertTrue(fetch.BPS_TABLE_ITEM.fullmatch(item["query"])
                            or fetch.bps_items(item["query"]))
        source = next(row for row in cfg["sources"] if row["source_id"] == "bps")
        self.assertIn("Layanan ini menggunakan API Badan Pusat Statistik (BPS).",
                      source["attribution_text"])
        self.assertIn("bukan situs resmi BPS", source["attribution_text"])
        self.assertIn("bps", fetch.BASES)  # pilihan --source di cli

    def test_rejects_query_with_key_or_unknown_filter(self):
        item = {"id": "b", "source": "bps", "dataset": "WebAPI", "frequency": "M", "unit": "%",
                "concept": "yoy", "name": "B", "citation": "c"}
        config.check_series([{**item, "query": "domain/0000/var/2263/sejak/2024?vervar=9999"}],
                            {"bps"})
        config.check_series([{**item, "query": "domain/0000/tabel/908/kolom/inti/sejak/2024"}], {"bps"})
        for query in ["domain/0000/tabel/908/kolom/inti/sejak/2024/key/ABC123",
                      "domain/0000/tabel/909/kolom/inti/sejak/2024",
                      "domain/0000/tabel/908/kolom/lain/sejak/2024",
                      "domain/0000/var/2263/sejak/2024/key/ABC123",
                      "domain/0000/var/2263/sejak/2024?vervar=9999&key=ABC123",
                      "domain/0000/var/2263/th/124?vervar=9999",
                      "domain/0000/var/2263/sejak/2024?vervar=ABC"]:
            with self.subTest(query=query), self.assertRaises(config.ConfigError):
                config.check_series([{**item, "query": query}], {"bps"})
        with self.assertRaises(config.ConfigError):
            config.check_series([{**item, "query": "domain/0000/var/2263/sejak/2024",
                                  "frequency": "A"}], {"bps"})


if __name__ == "__main__":
    main()
