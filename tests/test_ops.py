"""Uji aturan uji tujuh hari dan pemeriksaan arsip backup, tanpa database."""

import io
import json
import os
import tarfile
import tempfile
import unittest
import zlib
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest import mock

from confore import availability, backup, cli, db
from confore.availability import WIB


def run(trigger, status, day, hour, minutes=1):
    started = datetime(2026, 11, day, hour, tzinfo=WIB)
    return (trigger, status, started, started + timedelta(minutes=minutes))


def moment(day, hour):
    return datetime(2026, 11, day, hour, tzinfo=WIB)


class AvailabilityTest(unittest.TestCase):
    def week(self):
        return [run("schedule", "ok", day, 10) for day in range(8, 15)]

    def test_seven_scheduled_days_pass(self):
        result = availability.evaluate(self.week(), date(2026, 11, 8), 7, moment(14, 12))
        self.assertEqual(result.verdict, "lulus")
        self.assertEqual([d.passed for d in result.days], [True] * 7)
        self.assertEqual(result.days[0].daily, "10.00 ok")
        self.assertLess(result.largest_gap, 25)

    def test_push_and_manual_runs_do_not_count(self):
        runs = self.week()
        runs[2] = run("push", "ok", 10, 10)
        runs.append(run("dispatch", "ok", 10, 11))
        result = availability.evaluate(runs, date(2026, 11, 8), 7, moment(14, 12))
        self.assertEqual(result.verdict, "gagal")
        self.assertIs(result.days[2].passed, False)
        self.assertEqual(result.days[2].other, 2)

    def test_release_run_does_not_replace_the_daily_run_but_shortens_the_gap(self):
        runs = self.week()
        runs[2] = run("release", "ok", 10, 20)
        result = availability.evaluate(runs, date(2026, 11, 8), 7, moment(14, 12))
        self.assertEqual(result.verdict, "gagal")
        self.assertEqual(result.days[2].release, "20.00 ok")
        self.assertIs(result.days[2].passed, False)
        self.assertLess(result.largest_gap, availability.MAX_GAP_HOURS)

    def test_partial_passes_and_failed_does_not(self):
        runs = self.week()
        runs[3] = run("schedule", "partial", 11, 10)
        self.assertEqual(availability.evaluate(runs, date(2026, 11, 8), 7, moment(14, 12)).verdict, "lulus")
        runs[3] = run("schedule", "failed", 11, 10)
        self.assertEqual(availability.evaluate(runs, date(2026, 11, 8), 7, moment(14, 12)).verdict, "gagal")

    def test_today_without_a_run_yet_is_still_running(self):
        result = availability.evaluate(self.week()[:2], date(2026, 11, 8), 7, moment(10, 8))
        self.assertEqual(result.verdict, "berjalan")
        self.assertEqual([d.passed for d in result.days], [True, True, None])

    def test_today_with_a_failed_run_fails(self):
        runs = [*self.week()[:2], run("schedule", "failed", 10, 7)]
        self.assertEqual(availability.evaluate(runs, date(2026, 11, 8), 7, moment(10, 8)).verdict, "gagal")

    def test_window_that_has_not_started_is_running(self):
        result = availability.evaluate([], date(2026, 11, 8), 7, moment(7, 12))
        self.assertEqual((result.verdict, result.days, result.largest_gap), ("berjalan", [], None))

    def test_gap_over_the_limit_fails_even_when_every_day_passes(self):
        runs = [run("schedule", "ok", 8, 1), run("schedule", "ok", 9, 23)]
        result = availability.evaluate(runs, date(2026, 11, 8), 2, moment(10, 0))
        self.assertTrue(all(d.passed for d in result.days))
        self.assertEqual(result.verdict, "gagal")
        self.assertGreater(result.largest_gap, availability.MAX_GAP_HOURS)

    def test_gap_counts_from_the_last_success_before_the_window(self):
        runs = [run("schedule", "ok", 5, 10), run("schedule", "ok", 8, 10)]
        result = availability.evaluate(runs, date(2026, 11, 8), 1, moment(8, 12))
        self.assertGreater(result.largest_gap, 70)
        self.assertEqual(result.verdict, "gagal")

    def test_schedule_that_died_now_fails_before_the_next_day_ends(self):
        result = availability.evaluate([run("schedule", "ok", 8, 1)], date(2026, 11, 8), 7, moment(9, 20))
        self.assertIs(result.days[1].passed, None)
        self.assertEqual(result.verdict, "gagal")

    def test_unfinished_or_failed_run_does_not_reset_the_gap(self):
        unfinished = ("schedule", "running", moment(9, 5), None)
        failed = run("release", "failed", 9, 8)  # bila dihitung sukses, selangnya hanya 31 jam
        result = availability.evaluate([run("schedule", "ok", 8, 1), unfinished, failed],
                                       date(2026, 11, 8), 7, moment(9, 23))
        self.assertGreater(result.largest_gap, availability.MAX_GAP_HOURS)

    def test_push_does_not_reset_the_gap(self):
        runs = [run("schedule", "ok", 8, 1), run("push", "ok", 9, 8)]
        result = availability.evaluate(runs, date(2026, 11, 8), 7, moment(9, 23))
        self.assertGreater(result.largest_gap, availability.MAX_GAP_HOURS)

    def test_day_follows_wib_not_utc(self):
        started = datetime(2026, 11, 7, 23, 30, tzinfo=availability.timezone.utc)  # 8 November 06.30 WIB
        runs = [("schedule", "ok", started, started + timedelta(minutes=1))]
        result = availability.evaluate(runs, date(2026, 11, 8), 1, moment(8, 12))
        self.assertTrue(result.days[0].passed)
        self.assertEqual(result.days[0].daily, "06.30 ok")


class TriggerTest(unittest.TestCase):
    def trigger(self, explicit, **env):
        with mock.patch.dict(os.environ, env):
            os.environ.setdefault("GITHUB_RUN_ATTEMPT", "1")
            return cli.run_trigger(explicit)

    def test_first_attempt_keeps_the_real_trigger(self):
        self.assertEqual(self.trigger(None, GITHUB_EVENT_NAME="schedule"), "schedule")
        self.assertEqual(self.trigger("release", GITHUB_EVENT_NAME="schedule"), "release")

    def test_rerun_from_the_actions_tab_counts_as_manual(self):
        self.assertEqual(self.trigger(None, GITHUB_EVENT_NAME="schedule", GITHUB_RUN_ATTEMPT="2"), "dispatch")
        self.assertEqual(self.trigger("release", GITHUB_EVENT_NAME="schedule", GITHUB_RUN_ATTEMPT="2"), "dispatch")


class StatusCommandTest(unittest.TestCase):
    def status(self, runs, *args):
        connection = mock.MagicMock()
        site = (moment(14, 10), "ok", [])
        with mock.patch.object(db, "connect", return_value=connection), \
                mock.patch.object(db, "all_runs", return_value=runs), \
                mock.patch.object(db, "site_status", return_value=site), \
                mock.patch("builtins.print"):
            return cli.main(["status", *args])

    def test_exit_code_marks_only_a_failed_window(self):
        # Jendela yang sudah lewat, supaya hasilnya tidak bergantung pada tanggal tes dijalankan.
        runs = [run("schedule", "ok", day, 10) for day in range(1, 6)]
        self.assertEqual(self.status(runs, "--since", "2026-11-01", "--days", "5"), 0)
        self.assertEqual(self.status(runs[:3], "--since", "2026-11-01", "--days", "5"), 1)

    def test_days_must_be_positive(self):
        with mock.patch("sys.stderr"):
            self.assertEqual(self.status([], "--days", "0"), 1)

    def test_since_must_be_a_date(self):
        with self.assertRaises(SystemExit), mock.patch("sys.stderr"):
            self.status([], "--since", "kemarin")


class ArchiveTest(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / "arsip.tar.gz"

    def write(self, tables, files):
        manifest = json.dumps({"tables": tables}).encode()
        with tarfile.open(self.path, "w:gz") as tar:
            for name, content in {backup.MANIFEST: manifest, **files}.items():
                info = tarfile.TarInfo(name)
                info.size = len(content)
                tar.addfile(info, io.BytesIO(content))

    def valid(self):
        files = {f"{t}.csv": b"a\n1\n" for t in backup.TABLES}
        tables = {t: {"rows": 1, "sha256": backup.digest(b"a\n1\n")} for t in backup.TABLES}
        return tables, files

    def test_good_archive_is_read(self):
        self.write(*self.valid())
        tables, files = backup.read_archive(self.path)
        self.assertEqual(tables["observations"]["rows"], 1)
        self.assertEqual(files["series.csv"], b"a\n1\n")

    def test_changed_content_is_refused(self):
        tables, files = self.valid()
        files["observations.csv"] = b"a\n2\n"
        self.write(tables, files)
        with self.assertRaisesRegex(db.Stop, "hash observations"):
            backup.read_archive(self.path)

    def test_missing_table_is_refused(self):
        tables, files = self.valid()
        del files["forecasts.csv"]
        self.write(tables, files)
        with self.assertRaisesRegex(db.Stop, "tidak bisa dibaca: KeyError"):
            backup.read_archive(self.path)

    def test_missing_manifest_or_broken_file_is_refused(self):
        with tarfile.open(self.path, "w:gz"):
            pass
        with self.assertRaisesRegex(db.Stop, "tidak bisa dibaca"):
            backup.read_archive(self.path)
        self.path.write_bytes(b"bukan arsip")
        with self.assertRaisesRegex(db.Stop, "tidak bisa dibaca"):
            backup.read_archive(self.path)
        with self.assertRaisesRegex(db.Stop, "tidak bisa dibaca"):
            backup.read_archive(self.path.with_name("tidak-ada.tar.gz"))
        # Kerusakan di tengah aliran melempar zlib.error, bukan OSError.
        with mock.patch("tarfile.open", side_effect=zlib.error("rusak")), \
                self.assertRaisesRegex(db.Stop, "tidak bisa dibaca: error"):
            backup.read_archive(self.path)

    def test_any_damaged_byte_gives_a_clean_refusal_or_a_clean_read(self):
        self.write(*self.valid())
        good = self.path.read_bytes()
        for position in range(0, len(good), 2):
            broken = bytearray(good)
            broken[position] ^= 0xFF
            self.path.write_bytes(bytes(broken))
            try:
                backup.read_archive(self.path)
            except db.Stop:
                pass  # jenis error lain akan menggagalkan tes ini

    def test_attribution_lists_every_source(self):
        text = backup.readme([("BPS", "Layanan ini memakai API BPS.", "https://contoh.test/s")]).decode()
        self.assertIn("BPS: Layanan ini memakai API BPS. Syarat: https://contoh.test/s", text)


if __name__ == "__main__":
    unittest.main()
