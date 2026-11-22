"""Uji pemeriksaan bulanan dan pengingat tabel kurasi (confore/checkup.py), tanpa database dan jaringan."""

import json
import os
import re
import tempfile
import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest import mock

from confore import checkup, cli, db, fetch

TODAY = date(2026, 11, 22)
SOURCES = {"bps_cpi_yoy_m": "bps", "idn_cpi_yoy_m": "imf", "bps_gdp_growth_q": "bps", "idn_cli_m": "oecd"}


def target(series_id, year, kind="apbn", verification="dokumen"):
    return (series_id, year, kind, Decimal("5.4"), None, None, "UU APBN", "https://peraturan.bpk.go.id",
            date(2026, 11, 7), verification)


def holiday(day, verification="perkiraan", checked="2026-11-07"):
    return {"date": day, "kind": "lebaran", "document": "SKB 3 Menteri", "url": "https://setneg.go.id",
            "last_verified": checked, "verification": verification}


class TargetReminderTest(unittest.TestCase):
    def test_news_sourced_target_points_to_the_official_text(self):
        lines = checkup.target_reminders([target("idn_gdp_growth_a", 2027, verification="berita")], TODAY)
        self.assertEqual(len(lines), 1)
        self.assertTrue(lines[0].startswith("`idn_gdp_growth_a` 2027 (apbn) masih bersumber berita"))
        self.assertIn("https://peraturan.bpk.go.id", lines[0])

    def test_next_year_is_due_from_october(self):
        rows = [target("idn_cpi_eop_a", 2026, "pmk")]
        self.assertEqual(checkup.target_reminders(rows, date(2026, 9, 30)), [])
        self.assertEqual(checkup.target_reminders(rows, date(2026, 10, 9)),
                         ["Target pmk untuk `idn_cpi_eop_a` baru sampai 2026, padahal tahun 2027 sudah perlu diisi."])

    def test_five_year_plan_is_only_due_for_this_year(self):
        rows = [target("idn_gdp_growth_a", year, "rpjmn") for year in range(2025, 2030)]
        self.assertEqual(checkup.target_reminders(rows, date(2029, 10, 9)), [])
        self.assertEqual(len(checkup.target_reminders(rows, date(2030, 1, 9))), 1)


class CalendarReminderTest(unittest.TestCase):
    def test_estimate_is_flagged_two_months_ahead(self):
        calendar = [("bps_gdp_growth_q", "2026-Q4", "bps-perkiraan", date(2027, 2, 5)),
                    ("bps_gdp_growth_q", "2027-Q1", "bps-perkiraan", date(2027, 5, 5))]
        self.assertEqual(checkup.calendar_reminders(calendar, {}, SOURCES, TODAY), [])
        lines = checkup.calendar_reminders(calendar, {}, SOURCES, date(2026, 12, 9))
        self.assertEqual(len(lines), 1)
        self.assertTrue(lines[0].startswith(
            "Tanggal 2027-02-05 untuk `bps_gdp_growth_q` 2026-Q4 masih perkiraan (`bps-perkiraan`)."))

    def test_series_whose_calendar_runs_out_are_grouped(self):
        calendar = [("bps_cpi_yoy_m", "2026-11", "bps", date(2026, 12, 1)),
                    ("idn_cpi_yoy_m", "2026-11", "bps", date(2026, 12, 1)),
                    ("bps_gdp_growth_q", "2026-Q4", "bps-perkiraan", date(2027, 2, 5)),
                    ("idn_cli_m", "2026-11", "oecd", date(2026, 12, 7))]
        lines = checkup.calendar_reminders(calendar, {}, SOURCES, TODAY)
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[0].startswith("Kalender `bps` untuk `bps_cpi_yoy_m`, `idn_cpi_yoy_m` hanya sampai 2026-12-01."))
        self.assertIn("`bps-perkiraan`", lines[0])
        self.assertTrue(lines[1].startswith("Kalender `oecd` untuk `idn_cli_m` hanya sampai 2026-12-07."))

    def test_published_number_without_release_date(self):
        calendar = [("bps_cpi_yoy_m", "2026-11", "bps", date(2027, 1, 4)),
                    ("idn_cpi_yoy_m", "2026-11", "bps", date(2027, 1, 4)),
                    ("bps_gdp_growth_q", "2026-Q4", "bps-perkiraan", date(2027, 2, 5)),
                    ("idn_cli_m", "2026-11", "oecd", date(2027, 1, 4))]
        latest = {"bps_cpi_yoy_m": ("2026-10", None), "idn_cpi_yoy_m": ("2026-10", None),
                  "bps_gdp_growth_q": ("2026-Q3", None), "idn_cli_m": ("2026-10", date(2026, 11, 9))}
        lines = checkup.calendar_reminders(calendar, latest, SOURCES, TODAY)
        # Salinan IMF (idn_cpi_yoy_m) tidak memakai kalender BPS sebagai tanggal rilisnya, jadi tidak ikut.
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[0].startswith("Angka 2026-10 untuk `bps_cpi_yoy_m` tampil dengan tulisan"))
        self.assertTrue(lines[1].startswith("Angka 2026-Q3 untuk `bps_gdp_growth_q` tampil dengan tulisan"))


class HolidayReminderTest(unittest.TestCase):
    def test_passed_estimate_asks_for_the_isbat_date(self):
        rows = [holiday("2027-03-10"), holiday("2029-02-15")]
        lines = checkup.holiday_reminders(rows, date(2027, 3, 11))
        self.assertEqual(len(lines), 1)
        self.assertTrue(lines[0].startswith("Lebaran 2027 (2027-03-10) sudah lewat"))

    def test_next_year_is_matched_with_the_decree_from_september(self):
        rows = [holiday("2027-03-10", checked="2026-08-20"), holiday("2029-02-15")]
        self.assertEqual(checkup.holiday_reminders(rows, date(2026, 8, 31)), [])
        lines = checkup.holiday_reminders(rows, date(2026, 9, 9))
        self.assertEqual(len(lines), 1)
        self.assertIn("SKB 3 Menteri", lines[0])
        rows[0]["last_verified"] = "2026-09-15"
        self.assertEqual(checkup.holiday_reminders(rows, date(2026, 10, 9)), [])

    def test_table_must_reach_two_years_ahead(self):
        rows = [holiday("2027-03-10"), holiday("2028-02-27")]
        self.assertEqual(checkup.holiday_reminders(rows, TODAY), [])
        self.assertEqual(checkup.holiday_reminders(rows, date(2027, 1, 9)),
                         ["Tabel hanya sampai Lebaran 2028. Tambahkan perkiraan tahun-tahun berikutnya."])


class MonthlyCheckTest(unittest.TestCase):
    def test_database_size(self):
        self.assertTrue(checkup.size_check(120 * 2**20).ok)
        large = checkup.size_check(350 * 2**20)
        self.assertEqual(large, checkup.Check("Ukuran database", False, "350 MB dari batas peringatan 300 MB"))

    def test_backtest_must_follow_the_last_ninth(self):
        stamp = datetime(2026, 11, 8, 20, tzinfo=timezone.utc)  # 9 November 03.00 WIB
        self.assertTrue(checkup.backtest_check(stamp, date(2026, 11, 9)).ok)
        self.assertTrue(checkup.backtest_check(stamp, date(2026, 12, 8)).ok)
        late = checkup.backtest_check(stamp, date(2026, 12, 9))
        self.assertFalse(late.ok)
        self.assertIn("jadwalnya 2026-12-09", late.detail)
        self.assertFalse(checkup.backtest_check(None, TODAY).ok)
        self.assertEqual(checkup.backtest_due(date(2027, 1, 5)), date(2026, 12, 9))

    def test_latest_backup_must_be_at_most_eight_days_old(self):
        releases = [{"tag": "backup-2026-11-16", "created_at": "2026-11-16T00:12:03Z"},
                    {"tag": "backup-2026-11-09", "created_at": "2026-11-09T02:58:41Z"},
                    {"tag": "v1", "created_at": "2026-11-20T00:00:00Z"}]
        self.assertEqual(checkup.backup_check(releases, TODAY),
                         checkup.Check("Backup mingguan", True, "rilis terakhir `backup-2026-11-16`"))
        self.assertFalse(checkup.backup_check(releases, date(2026, 11, 25)).ok)
        self.assertFalse(checkup.backup_check([], TODAY).ok)

    def test_open_alarms_and_dependabot_pulls_are_listed_by_number(self):
        self.assertTrue(checkup.alarm_check([]).ok)
        alarm = checkup.alarm_check([{"number": 1, "title": "Pipeline atau backup gagal"}])
        self.assertFalse(alarm.ok)
        self.assertIn("1 masih terbuka (#1)", alarm.detail)
        self.assertIn("2 terbuka (#12, #15)", checkup.dependabot_check([{"number": 12}, {"number": 15}]).detail)

    def test_npm_audit_report(self):
        clean = {"auditReportVersion": 2, "vulnerabilities": {}, "metadata": {"vulnerabilities": {"total": 0}}}
        self.assertTrue(checkup.npm_check(clean).ok)
        found = {"auditReportVersion": 2, "metadata": {},
                 "vulnerabilities": {"next": {"name": "next", "severity": "moderate", "isDirect": True}}}
        self.assertIn("`next` (moderate)", checkup.npm_check(found).detail)
        self.assertIn("gagal berjalan", checkup.npm_check({"error": {"code": "ENOTFOUND"}}).detail)
        self.assertFalse(checkup.npm_check([]).ok)

    def test_lockfile_pins_every_package(self):
        text = checkup.REQUIREMENTS.read_text(encoding="utf-8")
        packages = checkup.pinned_packages(text)
        starts = [line for line in text.splitlines() if line and not line[0].isspace() and line[0] != "#"]
        self.assertEqual(len(packages), len(starts))
        self.assertTrue(all(re.fullmatch(r"\d[\w.+!]*", version) for _, version in packages))
        marker = "psycopg-binary==3.3.6 ; implementation_name != 'pypy' \\\n    --hash=sha256:ab\n"
        self.assertEqual(checkup.pinned_packages(marker), [("psycopg-binary", "3.3.6")])

    def test_osv_answer_is_matched_to_each_package(self):
        answer = json.dumps({"results": [{"vulns": [{"id": "PYSEC-2", "modified": "x"},
                                                    {"id": "GHSA-1", "modified": "y"}]}, {}]})
        with mock.patch.object(fetch, "get", return_value=answer) as get:
            found = checkup.osv_vulnerabilities([("jinja2", "2.4.1"), ("psycopg", "3.2.13")])
        self.assertEqual(found, {"jinja2==2.4.1": ["GHSA-1", "PYSEC-2"]})
        sent = json.loads(get.call_args.kwargs["data"])
        self.assertEqual(sent["queries"][1], {"package": {"name": "psycopg", "ecosystem": "PyPI"}, "version": "3.2.13"})
        self.assertIn("`jinja2==2.4.1` (GHSA-1, PYSEC-2)", checkup.python_check(found).detail)
        self.assertTrue(checkup.python_check({}).ok)

    def test_token_expiry_is_read_from_the_runbook(self):
        runbook = checkup.RUNBOOK.read_text(encoding="utf-8")
        self.assertIsNotNone(checkup.TOKEN_DATE.search(runbook), "baris tanggal token di RUNBOOK.md berubah bentuk")
        line = "Tanggal kedaluwarsa token GitHub untuk cron-job.org: `2027-11-07`."
        self.assertTrue(checkup.token_check(line, date(2027, 9, 7)).ok)
        soon = checkup.token_check(line, date(2027, 9, 9))
        self.assertFalse(soon.ok)
        self.assertIn("59 hari lagi", soon.detail)
        self.assertIn("sudah lewat", checkup.token_check(line, date(2027, 11, 9)).detail)
        self.assertFalse(checkup.token_check("tanpa tanggal", TODAY).ok)


class IssueTest(unittest.TestCase):
    def test_monthly_issue_ticks_only_passed_checks(self):
        checks = [checkup.Check("Ukuran database", True, "120 MB"), checkup.Check("Backup mingguan", False, "lama"),
                  checkup.Check("Pull request Dependabot", None, "hanya diperiksa di workflow")]
        issue = checkup.monthly_issue(checks, date(2026, 12, 9))
        self.assertEqual((issue["title"], issue["close"]), ("Pemeriksaan bulanan", False))
        self.assertIn("- [x] Ukuran database: 120 MB", issue["body"])
        self.assertIn("- [ ] Backup mingguan: lama", issue["body"])
        self.assertIn("- Pull request Dependabot: dilewati, hanya diperiksa di workflow", issue["body"])
        self.assertIn("- [ ] Job cron-job.org", issue["body"])

    def test_test_issues_cover_every_reminder_and_close_again(self):
        issues = checkup.test_issues(TODAY)
        titles = [issue["title"] for issue in issues]
        self.assertEqual(titles, [checkup.TEST_PREFIX + t for t in
                                  (checkup.MONTHLY, checkup.TARGETS, checkup.CALENDAR, checkup.HOLIDAYS)])
        self.assertTrue(all(issue["close"] for issue in issues))


class CollectTest(unittest.TestCase):
    def collect(self, connect, osv, state_dir=None):
        with mock.patch.object(db, "connect", **connect), mock.patch.object(checkup, "osv_vulnerabilities", **osv):
            return checkup.collect(TODAY, state_dir)

    def test_database_failure_becomes_a_finding(self):
        checks, issues = self.collect({"side_effect": db.Stop("SUPABASE_DB_URL belum diisi")}, {"return_value": {}})
        found = {check.name: check for check in checks}
        self.assertEqual(found["Database"], checkup.Check("Database", False, "tidak terbaca (SUPABASE_DB_URL belum diisi)"))
        self.assertIsNone(found["Backup mingguan"].ok)
        self.assertTrue(found["Kerentanan paket Python"].ok)
        self.assertEqual(issues[0]["title"], checkup.MONTHLY)
        self.assertFalse(any(issue["close"] for issue in issues))

    def test_error_messages_stay_out_of_the_public_issue(self):
        checks, issues = self.collect({"side_effect": RuntimeError("postgresql://user:rahasia@host/db")},
                                      {"side_effect": fetch.FetchError("HTTP 503", 503)})
        body = issues[0]["body"]
        self.assertNotIn("rahasia", body)
        self.assertIn("Database: tidak terbaca (RuntimeError)", body)
        self.assertIn("Kerentanan paket Python: gagal diperiksa (FetchError HTTP 503)", body)

    def test_repo_state_files_are_judged(self):
        with tempfile.TemporaryDirectory() as folder:
            state = {"backups.json": [{"tag": "backup-2026-11-16", "created_at": "2026-11-16T00:12:03Z"}],
                     "alarms.json": [], "dependabot.json": [{"number": 7}]}
            for name, data in state.items():
                Path(folder, name).write_text(json.dumps(data), encoding="utf-8")
            Path(folder, "npm-audit.json").write_text("", encoding="utf-8")  # npm audit tidak menulis apa pun
            checks, _ = self.collect({"side_effect": db.Stop("x")}, {"return_value": {}}, folder)
        found = {check.name: check.ok for check in checks}
        self.assertEqual([found[name] for name in ("Backup mingguan", "Issue alarm kegagalan",
                                                   "Pull request Dependabot", "Kerentanan paket situs")],
                         [True, True, False, False])


class CheckupCommandTest(unittest.TestCase):
    def checkup(self, *args):
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / "issues.json"
            with mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": ""}), mock.patch("builtins.print"):
                code = cli.main(["checkup", *args, "--out", str(out)])
            return code, json.loads(out.read_text(encoding="utf-8"))

    def test_test_mode_skips_the_database(self):
        with mock.patch.object(db, "connect") as connect:
            code, issues = self.checkup("--test")
        connect.assert_not_called()
        self.assertEqual(code, 0)
        self.assertEqual(len(issues), 4)
        self.assertTrue(all(issue["close"] for issue in issues))

    def test_findings_do_not_fail_the_command(self):
        with mock.patch.object(db, "connect", side_effect=db.Stop("SUPABASE_DB_URL belum diisi")), \
                mock.patch.object(checkup, "osv_vulnerabilities", return_value={}):
            code, issues = self.checkup()
        self.assertEqual(code, 0)
        self.assertEqual(issues[0]["title"], checkup.MONTHLY)


if __name__ == "__main__":
    unittest.main()
