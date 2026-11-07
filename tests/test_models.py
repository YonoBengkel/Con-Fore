"""Tes model: aturan jeda rilis, tanpa kebocoran data masa depan, baseline, dan perbandingan backtest."""

import math
import unittest
from datetime import date
from decimal import Decimal
from unittest import mock

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from confore import cli, config, db, fetch
from confore.fetch import Point
from confore.models import backtest, baseline, forecast, gdp, inflation, unemployment
from confore.models import data as model_data
from confore.models.data import (CPI, GDP, UNEMP, Inputs, MissingInput, build, calendar, extend_index,
                                 gdp_published, in_covid)


def month(text):
    return pd.Period(text, "M")


def quarter(text):
    return pd.Period(text, "Q")


def synthetic(seed=7):
    """Data buatan berbentuk mirip data asli, tanpa memakai data sumber."""
    rng = np.random.default_rng(seed)
    months = pd.period_range("2000-01", "2026-10", freq="M")
    pattern = np.array([0.6, 0.1, 0.1, 0.1, 0.2, 0.5, 0.7, 0.4, 0.1, 0.1, 0.3, 0.6])
    change = pattern[months.month - 1] + rng.normal(0, 0.1, len(months))
    cpi_index = pd.Series(100 * np.exp(np.cumsum(change) / 100), index=months)
    quarters = pd.period_range("2009Q1", "2026Q3", freq="Q")
    growth = pd.Series(5 + 0.3 * np.sin(np.arange(len(quarters)) / 3) + rng.normal(0, 0.1, len(quarters)),
                       index=quarters)
    rounds = [month(f"{y}-{m:02d}") for y in range(2011, 2026) for m in (2, 8)
              if month(f"{y}-{m:02d}") <= month("2025-08")]
    rounds += [month(t) for t in ("2025-11", "2026-02", "2026-05", "2026-08")]
    unemp = pd.Series(7 - 0.01 * np.arange(len(rounds)) * 8 + rng.normal(0, 0.05, len(rounds)),
                      index=pd.PeriodIndex(rounds, freq="M"))
    market = pd.DataFrame(
        {name: 100 * np.exp(np.cumsum(rng.normal(0, 3, len(months))) / 100)
         for name in ("brent", "coal", "cpo", "nickel", "fx")}, index=months)
    market["rate"] = 5 + np.cumsum(rng.normal(0, 0.05, len(months)))
    calendar_months = pd.period_range("2000-01", "2030-12", freq="M")
    fasting, lebaran = calendar([date(y, 6, 15) for y in range(2005, 2031)], calendar_months)
    return Inputs(growth, cpi_index, unemp, market, fasting, lebaran)


class ReleaseRuleTest(unittest.TestCase):
    def test_gdp_is_published_in_the_second_month_after_the_quarter(self):
        cases = {"2026-01": "2025Q3", "2026-02": "2025Q4", "2026-03": "2025Q4", "2026-04": "2025Q4",
                 "2026-05": "2026Q1", "2026-10": "2026Q2", "2026-11": "2026Q3"}
        for origin, expected in cases.items():
            self.assertEqual(gdp_published(month(origin)), quarter(expected), origin)

    def test_at_cuts_every_input_by_its_release_lag(self):
        inputs = synthetic().at(month("2026-05"))
        self.assertEqual(inputs.gdp.index[-1], quarter("2026Q1"))
        self.assertEqual(inputs.cpi_index.index[-1], month("2026-04"))
        self.assertEqual(inputs.market.index[-1], month("2026-04"))
        self.assertEqual(inputs.unemp.index[-1], month("2026-02"))  # ronde Februari terbit 5 Mei
        # Jadwal ronde berikutnya sengaja diambil dari data akhir; nilainya tidak ikut terlihat.
        self.assertEqual(inputs.upcoming_rounds, (month("2026-05"), month("2026-08")))

    def test_round_is_not_known_before_its_release(self):
        inputs = synthetic().at(month("2026-04"))
        self.assertEqual(inputs.unemp.index[-1], month("2025-11"))

    def test_covid_window_covers_touching_quarters_only(self):
        self.assertTrue(in_covid(quarter("2020Q1")))
        self.assertTrue(in_covid(quarter("2021Q4")))
        self.assertFalse(in_covid(quarter("2019Q4")))
        self.assertFalse(in_covid(quarter("2022Q1")))
        self.assertFalse(in_covid(month("2020-01")))
        self.assertTrue(in_covid(month("2020-02")))


class NoLookAheadTest(unittest.TestCase):
    """Mengubah data sesudah asal tidak boleh mengubah ramalan apa pun pada asal itu."""

    def test_future_values_do_not_change_any_forecast(self):
        origin = month("2022-05")
        base = synthetic()
        market = base.market.copy()
        market.loc[market.index >= origin] = 999.0
        changed = Inputs(
            base.gdp.where(base.gdp.index <= quarter("2022Q1"), 99.0),
            base.cpi_index.where(base.cpi_index.index < origin, 999.0),
            base.unemp.where(base.unemp.index <= month("2022-02"), 50.0),
            market, base.fasting, base.lebaran)
        for module in (gdp, inflation, unemployment):
            first = module.forecasts(base.at(origin))
            second = module.forecasts(changed.at(origin))
            self.assertEqual(first.keys(), second.keys())
            for model, path in first.items():
                self.assertIsNotNone(path, model)
                self.assertEqual(path.keys(), second[model].keys())
                for ref, value in path.items():
                    self.assertAlmostEqual(value, second[model][ref], places=6, msg=f"{model} {ref}")

    def test_run_forecasts_from_what_was_published_at_each_origin(self):
        frame, _ = backtest.run(synthetic(), start=month("2025-01"), end=month("2025-08"))
        cpi = frame[(frame["series_id"] == CPI) & (frame["model"] == "sama_terakhir")]
        for row in cpi.itertuples():
            self.assertEqual((row.ref - row.origin).n, row.horizon - 1)  # h=1 adalah bulan berjalan
        growth = frame[(frame["series_id"] == GDP) & (frame["model"] == "sama_terakhir")]
        for row in growth.itertuples():
            self.assertEqual(row.ref, gdp_published(row.origin) + row.horizon)
        rounds = frame[(frame["series_id"] == UNEMP) & (frame["model"] == "sama_terakhir")]
        for row in rounds.itertuples():
            self.assertGreater(row.ref + 3, row.origin)  # ronde itu belum terbit saat asal


class BaselineTest(unittest.TestCase):
    def setUp(self):
        self.refs = pd.period_range("2026Q4", periods=3, freq="Q")

    def test_last_value_repeats_the_latest_number(self):
        values = pd.Series([1.0, 2.0], index=pd.period_range("2026Q2", periods=2, freq="Q"))
        self.assertEqual(set(baseline.last_value(values, self.refs).values()), {2.0})

    def test_ar1_iterates_the_estimated_line(self):
        rng = np.random.default_rng(2)
        values = pd.Series(5 + rng.normal(0, 1, 40), index=pd.period_range(end="2026Q3", periods=40, freq="Q"))
        slope, level = np.polyfit(values.iloc[:-1], values.iloc[1:], 1)
        path = baseline.ar1(values, self.refs)
        first = level + slope * values.iloc[-1]
        self.assertAlmostEqual(path[self.refs[0]], first, places=6)
        self.assertAlmostEqual(path[self.refs[1]], level + slope * first, places=6)
        self.assertGreater(abs(path[self.refs[0]] - values.iloc[-1]), 0.01)

    def test_ar1_skips_pairs_touching_excluded_periods(self):
        rng = np.random.default_rng(1)
        values = pd.Series(5 + rng.normal(0, 0.1, 40), index=pd.period_range(end="2026Q3", periods=40, freq="Q"))
        skip = pd.period_range("2020Q2", "2021Q3", freq="Q")
        wild = values.copy()
        wild[wild.index.isin(skip)] = -50.0
        clean, dirty = baseline.ar1(values, self.refs, skip=skip), baseline.ar1(wild, self.refs, skip=skip)
        self.assertAlmostEqual(clean[self.refs[0]], dirty[self.refs[0]], places=6)
        self.assertNotAlmostEqual(clean[self.refs[0]], baseline.ar1(wild, self.refs)[self.refs[0]], places=2)

    def test_ar1_without_enough_pairs_equals_last_value(self):
        values = pd.Series([1.0, 2.0, 3.0], index=pd.period_range(end="2026Q3", periods=3, freq="Q"))
        self.assertEqual(set(baseline.ar1(values, self.refs).values()), {3.0})


class CalendarTest(unittest.TestCase):
    def test_fasting_month_is_split_across_calendar_months(self):
        months = pd.period_range("2026-01", "2026-12", freq="M")
        fasting, lebaran = calendar([date(2026, 3, 21)], months)
        self.assertAlmostEqual(fasting[month("2026-02")], 10 / 30)
        self.assertAlmostEqual(fasting[month("2026-03")], 20 / 30)
        self.assertEqual(lebaran[month("2026-03")], 1.0)
        self.assertEqual(lebaran.sum(), 1.0)

    def test_holiday_table_is_valid_and_covers_the_model_window(self):
        days = config.load_holidays()
        self.assertLessEqual(days[0].year, 2007)
        self.assertGreaterEqual(days[-1].year, 2028)
        self.assertIn(date(2025, 3, 31), days)

    def test_holiday_table_rejects_bad_rows(self):
        good = {"date": "2026-03-21", "kind": "lebaran", "document": "x", "url": "https://x",
                "last_verified": "2026-11-07", "verification": "berita"}
        self.assertEqual(config.check_holidays([good]), [date(2026, 3, 21)])
        for bad in ({"kind": "natal"}, {"verification": "katanya"}, {"url": "http://x"}, {"document": ""},
                    {"date": "21-03-2026"}):
            with self.assertRaises(config.ConfigError):
                config.check_holidays([{**good, **bad}])
        with self.assertRaises(config.ConfigError):
            config.check_holidays([good, good])

    def test_bad_holiday_table_does_not_stop_the_data_pipeline(self):
        with mock.patch.object(config, "check_holidays", side_effect=config.ConfigError("x")):
            self.assertTrue(config.load()["series"])
            with self.assertRaises(config.ConfigError):
                config.load_holidays()


class InflationTest(unittest.TestCase):
    def test_clip_pulls_a_one_off_jump_back_toward_its_calendar_month(self):
        months = pd.period_range("2021-01", periods=60, freq="M")
        rng = np.random.default_rng(3)
        change = pd.Series(0.2 + 0.2 * (months.month == 7) + rng.normal(0, 0.05, 60), index=months)
        change[month("2023-07")] = 3.29
        clipped = inflation.clip_outliers(change)
        self.assertLess(clipped[month("2023-07")], 1.0)
        self.assertAlmostEqual(clipped[month("2023-08")], change[month("2023-08")], places=6)

    def test_chain_yoy_uses_last_years_base(self):
        months = pd.period_range("2025-01", periods=12, freq="M")
        index = pd.Series(100.0, index=months)
        index[month("2025-12")] = 110.0
        path = pd.Series([0.0], index=pd.PeriodIndex([month("2026-01")], freq="M"))
        result = inflation.chain_yoy(index, path)
        self.assertAlmostEqual(result[month("2026-01")], 10.0, places=6)

    def test_seasonal_recovers_a_steady_pattern(self):
        months = pd.period_range("2015-01", "2026-10", freq="M")
        change = 0.2 + 0.3 * (months.month == 7)
        index = pd.Series(100 * np.exp(np.cumsum(change) / 100), index=months)
        base = synthetic()
        inputs = Inputs(base.gdp, index, base.unemp, base.market, base.fasting * 0, base.lebaran * 0)
        refs = pd.period_range("2026-11", periods=12, freq="M")
        path = inflation.seasonal(inputs, refs)
        expected = (math.exp((11 * 0.2 + 0.5) / 100) - 1) * 100
        for value in path.values():
            self.assertAlmostEqual(value, expected, places=3)

    def test_seasonal_moves_the_bump_with_lebaran(self):
        # Lebaran 2025 jatuh di Maret, sedangkan 2024 di April. Pola bulan kalender saja tidak bisa tahu.
        calendar_months = pd.period_range("2000-01", "2030-12", freq="M")
        fasting, lebaran = calendar(config.load_holidays(), calendar_months)
        months = pd.period_range("2015-01", "2024-12", freq="M")
        change = 0.2 + 0.6 * lebaran.reindex(months).to_numpy()
        index = pd.Series(100 * np.exp(np.cumsum(change) / 100), index=months)
        base = synthetic()
        inputs = Inputs(base.gdp, index, base.unemp, base.market, fasting, lebaran)
        path = inflation.seasonal(inputs, pd.period_range("2025-01", periods=4, freq="M"))
        self.assertAlmostEqual(path[month("2025-03")] - path[month("2025-02")], 0.6, delta=0.03)
        self.assertAlmostEqual(path[month("2025-04")] - path[month("2025-03")], -0.6, delta=0.03)

    def test_arimax_and_seasonal_cover_the_same_periods(self):
        result = inflation.forecasts(synthetic().at(month("2024-03")))
        self.assertEqual(set(result), {"sama_terakhir", "ar1", "musiman", "arimax"})
        self.assertEqual(len(result["musiman"]), inflation.HORIZON)
        self.assertEqual(result["arimax"].keys(), result["musiman"].keys())


class GdpTest(unittest.TestCase):
    def test_dfm_returns_every_quarter_near_the_data(self):
        inputs = synthetic().at(month("2024-03"))
        result = gdp.forecasts(inputs)
        self.assertEqual(len(result["dfm"]), gdp.HORIZON)
        self.assertEqual(gdp.horizon(inputs, quarter("2024Q1")), 1)
        for value in result["dfm"].values():
            self.assertTrue(0 < value < 10, value)

    def test_exploding_or_failed_fit_gives_no_forecast(self):
        inputs = synthetic().at(month("2024-03"))
        refs = pd.period_range(inputs.gdp.index[-1] + 1, periods=2, freq="Q")
        with mock.patch.object(gdp, "DynamicFactorMQ", side_effect=ValueError):
            self.assertIsNone(gdp.dfm(inputs, refs))
        fitted = mock.Mock()
        months = len(gdp.panel(inputs))
        fitted.get_prediction.return_value.predicted_mean = {"gdp": pd.Series(np.full(months + 12, 1e8))}
        with mock.patch.object(gdp, "DynamicFactorMQ") as model:
            model.return_value.fit.return_value = fitted
            self.assertIsNone(gdp.dfm(inputs, refs))


class UnemploymentTest(unittest.TestCase):
    def test_next_rounds_are_semiannual_then_quarterly(self):
        self.assertEqual(unemployment.next_rounds(month("2019-08")), (month("2020-02"), month("2020-08")))
        self.assertEqual(unemployment.next_rounds(month("2026-08")), (month("2026-11"), month("2027-02")))

    def test_regression_needs_enough_pairs(self):
        inputs = synthetic().at(month("2013-05"))
        result = unemployment.forecasts(inputs)
        self.assertIsNone(result["regresi"])
        self.assertIsNotNone(result["sama_terakhir"])

    def test_regression_learns_a_steady_decline(self):
        base = synthetic()
        rounds = pd.PeriodIndex([month(f"{y}-{m:02d}") for y in range(2011, 2020) for m in (2, 8)], freq="M")
        steady = pd.Series(7 - 0.1 * np.arange(len(rounds)), index=rounds)
        inputs = Inputs(base.gdp, base.cpi_index, steady, base.market, base.fasting, base.lebaran)
        refs = unemployment.next_rounds(rounds[-1])
        path = unemployment.regression(inputs, refs, use_gdp=False)
        self.assertAlmostEqual(path[refs[0]], steady.iloc[-1] - 0.1, places=6)

    def test_horizon_is_months_from_the_last_round(self):
        inputs = synthetic()
        self.assertEqual(unemployment.horizon(inputs, month("2026-11")), 3)
        self.assertEqual(unemployment.horizon(inputs, month("2027-02")), 6)

    def test_covid_jump_is_left_out_of_the_estimate(self):
        base = synthetic()
        known = base.unemp.loc[:"2021-02"]
        wild = known.copy()
        wild[unemployment.OUTLIER] = 40.0
        refs = unemployment.next_rounds(known.index[-1])
        calm = Inputs(base.gdp, base.cpi_index, known, base.market, base.fasting, base.lebaran)
        spiked = Inputs(base.gdp, base.cpi_index, wild, base.market, base.fasting, base.lebaran)
        first = unemployment.regression(calm, refs, use_gdp=False)
        second = unemployment.regression(spiked, refs, use_gdp=False)
        for ref in refs:
            self.assertAlmostEqual(first[ref], second[ref], places=6)


class CompareTest(unittest.TestCase):
    def frame(self):
        rows = []
        for i, origin in enumerate(pd.period_range("2012-01", "2025-12", freq="M")):
            ref = origin + 1
            actual = 3.0
            rows.append((CPI, "sama_terakhir", origin, ref, 1, actual + 0.5 * (-1) ** i, actual))
            rows.append((CPI, "ar1", origin, ref, 1, actual + 0.4 * (-1) ** i, actual))
            rows.append((CPI, "musiman", origin, ref, 1, actual + 0.1 * (-1) ** i, actual))
        return pd.DataFrame(rows, columns=backtest.COLUMNS)

    def test_comparable_keeps_rows_where_every_model_has_a_forecast(self):
        frame = self.frame()
        missing = frame[~((frame["model"] == "musiman") & (frame["origin"] == month("2015-01")))]
        wide = backtest.comparable(missing, CPI)
        self.assertEqual(len(wide), len(frame) // 3 - 1)

    def test_scores_compute_mae_and_rmse(self):
        wide = backtest.comparable(self.frame(), CPI)
        result = backtest.scores(wide, ["ar1", "musiman"])
        self.assertAlmostEqual(result[1]["ar1"][0], 0.4)
        self.assertAlmostEqual(result[1]["musiman"][1], 0.1)
        self.assertEqual(result[1]["n"], len(wide))

    def test_windows_separate_covid_earlier_and_test_data(self):
        wide = backtest.comparable(self.frame(), CPI)
        masks = backtest.window_masks(wide)
        self.assertFalse(wide[masks["normal"]]["origin"].map(in_covid).any())
        self.assertFalse(wide[masks["normal"]]["ref"].map(in_covid).any())
        self.assertTrue((wide[masks["uji"]]["origin"] >= backtest.TEST_FROM).all())
        self.assertTrue((wide[masks["sebelum"]]["origin"] < month("2020-02")).all())
        self.assertFalse((masks["sebelum"] & masks["uji"]).any())
        self.assertTrue((masks["uji"] <= masks["normal"]).all())
        self.assertEqual(masks["semua"].sum(), len(wide))

    def test_model_must_win_in_both_windows_with_enough_rows(self):
        models = ["sama_terakhir", "ar1", "dfm"]
        normal = {"n": 100, "sama_terakhir": (0.2, 0), "ar1": (0.3, 0), "dfm": (0.1, 0)}
        test = {"n": 50, "sama_terakhir": (0.2, 0), "ar1": (0.3, 0), "dfm": (0.1, 0)}
        self.assertEqual(backtest.choose(normal, test, models), "dfm")
        self.assertEqual(backtest.choose(normal, {**test, "n": backtest.MIN_ERRORS - 1}, models), "sama_terakhir")
        self.assertEqual(backtest.choose(normal, {**test, "dfm": (0.25, 0)}, models), "sama_terakhir")
        self.assertEqual(backtest.choose({**normal, "dfm": (0.25, 0)}, test, models), "sama_terakhir")
        self.assertEqual(backtest.choose(normal, None, models), "sama_terakhir")

    def test_main_models_picks_the_clear_winner(self):
        self.assertEqual(backtest.main_models(self.frame()), {(CPI, 1): "musiman"})

    def test_diebold_mariano_separates_clear_and_tied_cases(self):
        rng = np.random.default_rng(5)
        base = rng.normal(0, 1, 200)
        self.assertLess(backtest.diebold_mariano(base * 0.5, base, 1), 0.01)
        other = rng.normal(0, 1, 200)
        self.assertGreater(backtest.diebold_mariano(other, base, 1), 0.05)
        self.assertIsNone(backtest.diebold_mariano(base[:5], base[:5], 1))
        self.assertIsNone(backtest.diebold_mariano(base, base, 1))

    def test_diebold_mariano_widens_for_overlapping_errors(self):
        rng = np.random.default_rng(6)
        shocks = rng.normal(0, 1, 200)
        persistent = np.convolve(shocks, np.ones(12) / 12, mode="same") + 0.05
        challenger = np.ones(200) + persistent
        baseline_errors = np.ones(200)
        self.assertGreater(backtest.diebold_mariano(challenger, baseline_errors, 12),
                           backtest.diebold_mariano(challenger, baseline_errors, 0))

    def test_diebold_mariano_matches_the_formula(self):
        rng = np.random.default_rng(8)
        shocks = np.convolve(rng.normal(0, 1, 120), np.ones(4) / 4, mode="same")
        challenger, base = 1 + shocks, np.ones(120)
        lag, count = 3, 120
        diff = np.abs(challenger) - np.abs(base)
        centered = diff - diff.mean()
        gamma = [float(centered[k:] @ centered[:count - k]) / count for k in range(lag + 1)]
        variance = gamma[0] + 2 * sum((1 - k / (lag + 1)) * gamma[k] for k in range(1, lag + 1))
        steps = lag + 1
        adjustment = (count + 1 - 2 * steps + steps * (steps - 1) / count) / count
        statistic = diff.mean() / math.sqrt(variance / count) * math.sqrt(adjustment)
        expected = 2 * scipy_stats.t.sf(abs(statistic), count - 1)
        self.assertAlmostEqual(backtest.diebold_mariano(challenger, base, lag), expected, places=10)

    def test_diebold_mariano_gives_up_when_the_lag_is_too_long_for_the_sample(self):
        values = np.arange(10.0)
        self.assertIsNone(backtest.diebold_mariano(values, values[::-1], 9))

    def test_error_offsets_follow_the_sign_of_the_error(self):
        frame = self.frame()
        frame["forecast"] = frame["actual"] - 1.0  # selalu terlalu rendah: aktual di atas titik ramalan
        bands = backtest.error_offsets(frame)[CPI, "musiman", 1]
        self.assertAlmostEqual(bands["lo80"], 1.0)
        self.assertAlmostEqual(bands["hi80"], 1.0)

    def test_narrow_band_ignores_covid_but_wide_band_keeps_it(self):
        frame = self.frame()
        covid = frame["origin"].map(in_covid)
        frame.loc[covid, "forecast"] = frame.loc[covid, "actual"] - 10.0
        bands = backtest.error_offsets(frame)[CPI, "musiman", 1]
        self.assertLess(bands["hi80"], 1.0)
        self.assertGreater(bands["hi95"], 5.0)
        self.assertLessEqual(bands["lo95"], bands["lo80"])

    def test_error_offsets_need_enough_errors(self):
        small = self.frame().groupby(["series_id", "model", "horizon"]).head(backtest.MIN_ERRORS - 1)
        self.assertEqual(backtest.error_offsets(small), {})

    def test_period_text_matches_pipeline_format(self):
        self.assertEqual(backtest.period_text(quarter("2026Q3")), "2026-Q3")
        self.assertEqual(backtest.period_text(month("2026-10")), "2026-10")
        for text, frequency in (("2026-Q3", "Q"), ("2026-10", "M")):
            self.assertEqual(fetch.period_of(text, frequency)[0], text)
            self.assertEqual(backtest.period_text(backtest.text_period(text)), text)

    def test_offsets_survive_a_round_trip_through_the_database_format(self):
        frame = self.frame()
        stored = backtest.frame_from_db(backtest.db_rows(frame))
        self.assertEqual(backtest.error_offsets(stored), backtest.error_offsets(frame))

    def test_tables_do_not_break_when_a_model_never_succeeds(self):
        frame = self.frame()
        only_baselines = frame[frame["model"] != "musiman"]
        titles = [title for title, _, _ in backtest.tables(only_baselines, {(CPI, "musiman"): 168})]
        self.assertTrue(any("Asal tanpa hasil" in title for title in titles))


class EndToEndTest(unittest.TestCase):
    def test_short_backtest_reports_all_targets(self):
        inputs = synthetic()
        frame, missed = backtest.run(inputs, start=month("2025-01"))
        self.assertEqual(set(frame["series_id"]), {GDP, CPI, UNEMP})
        self.assertTrue((frame["horizon"] >= 1).all())
        tpt = frame[(frame["series_id"] == UNEMP) & (frame["model"] == "sama_terakhir")]
        self.assertEqual(tpt.groupby("origin")["ref"].nunique().max(), 2)
        titles = [t[0] for t in backtest.tables(frame, {(GDP, "dfm"): 1})]
        self.assertTrue(any("Asal tanpa hasil" in t for t in titles))
        rows = backtest.db_rows(frame)
        self.assertEqual(rows[0][2].day, 15)
        self.assertRegex(rows[0][3], r"^\d{4}(-Q[1-4]|-\d{2})$")

    def test_live_rows_stop_at_the_end_of_next_year_and_carry_bands(self):
        inputs = synthetic()
        offsets = {(CPI, "musiman", 1): {"lo80": -0.5, "hi80": 0.5, "lo95": -1.0, "hi95": 1.0}}
        rows = forecast.rows_for(inputs, offsets, date(2026, 11, 7))
        refs = {r[1] for r in rows if r[0] == CPI}
        self.assertIn("2027-12", refs)
        self.assertNotIn("2028-01", refs)
        self.assertIn("2027-Q4", {r[1] for r in rows if r[0] == GDP})
        self.assertNotIn("2028-Q1", {r[1] for r in rows if r[0] == GDP})
        self.assertEqual({r[1] for r in rows if r[0] == UNEMP}, {"2026-11", "2027-02"})
        point = next(r[4] for r in rows if r[:4] == (CPI, "2026-11", "musiman", "point"))
        low = next(r[4] for r in rows if r[:4] == (CPI, "2026-11", "musiman", "lo80"))
        self.assertAlmostEqual(point - low, 0.5)
        self.assertFalse([r for r in rows if r[:3] == (CPI, "2026-12", "musiman") and r[3] != "point"])


def points(frequency, pairs):
    return [Point(*fetch.period_of(p, frequency), Decimal(str(v))) for p, v in pairs]


def source_data():
    months = [f"{y}-{m:02d}" for y in range(2018, 2027) for m in range(1, 13)
              if (y, m) <= (2026, 9)]
    quarters = [f"{y}-Q{q}" for y in range(2018, 2027) for q in range(1, 5) if (y, q) <= (2026, 3)]
    monthly = [(m, 100 + i) for i, m in enumerate(months)]
    data = {name: points("M", monthly) for name in (model_data.CPI_INDEX, model_data.RATE,
                                                    *model_data.PRICES.values())}
    data[model_data.CPI_CHANGE] = points("M", [("2026-09", 0.1), ("2026-10", 0.22)])
    data[model_data.GDP] = points("Q", [(q, 5.0) for q in quarters])
    data[model_data.GDP_HISTORY] = points("Q", [("2017-Q4", 4.0)])
    data[model_data.UNEMP] = points("M", [("2026-02", 4.68), ("2026-08", 4.75)])
    data[model_data.FX] = points("D", [("2026-10-30", 17000), ("2026-10-31", 17200), ("2026-11-05", 18000)])
    return data


class BuildTest(unittest.TestCase):
    def test_build_splices_sources_and_drops_the_running_month(self):
        inputs = build(source_data(), [date(2026, 3, 21)], date(2026, 11, 7))
        self.assertEqual(inputs.gdp.index[0], quarter("2017Q4"))  # riwayat IMF sebelum BPS
        self.assertEqual(inputs.cpi_index.index[-1], month("2026-10"))  # disambung m-to-m BPS
        self.assertAlmostEqual(inputs.cpi_index[month("2026-10")], inputs.cpi_index[month("2026-09")] * 1.0022)
        self.assertEqual(inputs.market.index[-1], month("2026-10"))  # November belum lengkap
        self.assertEqual(inputs.market.loc[month("2026-10"), "fx"], 17100.0)

    def test_extend_index_only_continues_without_gaps(self):
        index = pd.Series([100.0], index=pd.PeriodIndex([month("2026-09")], freq="M"))
        changes = pd.Series([1.0, 1.0], index=pd.PeriodIndex([month("2026-11"), month("2026-12")], freq="M"))
        self.assertEqual(len(extend_index(index, changes)), 1)

    def test_missing_series_is_reported_by_id(self):
        data = source_data()
        del data[model_data.CPI_INDEX]
        with self.assertRaises(MissingInput) as caught:
            build(data, [], date(2026, 11, 7))
        self.assertEqual(str(caught.exception), model_data.CPI_INDEX)

    def test_hash_ignores_the_running_month_but_not_what_changes_a_forecast(self):
        today = date(2026, 11, 7)
        data = source_data()
        first = forecast.input_hash(build(data, [], today))
        data[model_data.FX] = data[model_data.FX] + points("D", [("2026-11-06", 19000)])
        self.assertEqual(forecast.input_hash(build(data, [], today)), first)
        self.assertNotEqual(forecast.input_hash(build(data, [date(2026, 3, 21)], today)), first)
        self.assertNotEqual(forecast.input_hash(build(data, [], today), backtest_stamp="baru"), first)
        self.assertNotEqual(forecast.input_hash(build(data, [], today), git_sha="abc"), first)
        data[model_data.UNEMP] = data[model_data.UNEMP] + points("M", [("2026-11", 4.7)])
        self.assertNotEqual(forecast.input_hash(build(data, [], today)), first)


class StepTest(unittest.TestCase):
    """Langkah harian: sidik yang sama tidak menulis apa pun, sidik baru menulis dengan rentang."""

    def run_step(self, last_hash, stored=(), published=True):
        inputs = synthetic()
        with mock.patch.object(forecast, "latest_inputs", return_value=inputs), \
                mock.patch.object(db, "backtest_stamp", return_value="waktu"), \
                mock.patch.object(db, "last_forecast_hash", return_value=last_hash), \
                mock.patch.object(db, "forecasts_published", return_value=published), \
                mock.patch.object(db, "backtest_errors", return_value=list(stored)), \
                mock.patch.object(forecast, "publish_tables") as self.publish_tables, \
                mock.patch.object(db, "write_forecasts") as write:
            counts = forecast.step(None, {}, date(2026, 11, 7), "abc")
        return inputs, counts, write

    def test_same_hash_writes_and_publishes_nothing(self):
        current = forecast.input_hash(synthetic(), "waktu", "abc")
        _, counts, write = self.run_step(current)
        self.assertIsNone(counts)
        write.assert_not_called()
        self.publish_tables.assert_not_called()

    def test_same_hash_republishes_when_the_public_tables_are_empty(self):
        # Database yang baru dipulihkan dari backup: ramalannya ada, tabel publiknya kosong.
        current = forecast.input_hash(synthetic(), "waktu", "abc")
        _, counts, write = self.run_step(current, published=False)
        self.assertEqual(counts, {})
        write.assert_not_called()
        self.publish_tables.assert_called_once()

    def test_new_hash_writes_plain_rows_with_the_digest_and_publishes(self):
        inputs, counts, write = self.run_step("lama")
        self.assertEqual(counts["musiman"], 14)
        self.publish_tables.assert_called_once()
        rows, origin, cutoffs, digest = write.call_args.args[1:5]
        self.assertEqual(origin, date(2026, 11, 7))
        self.assertEqual(digest, forecast.input_hash(inputs, "waktu", "abc"))
        self.assertEqual(cutoffs[GDP], date(2026, 7, 1))
        self.assertEqual({len(row) for row in rows}, {5})
        self.assertEqual({row[3] for row in rows}, {"point"})

    def test_stored_backtest_adds_bands(self):
        stored = [(CPI, "musiman", date(2023, m, 15), f"2023-{m:02d}", 1, 3.0, 3.1)
                  for m in range(1, 13)] * 2
        stored = [(s, m, d.replace(year=2023 + i // 12), r[:3] + str(int(r[3]) + i // 12) + r[4:], h, f, a)
                  for i, (s, m, d, r, h, f, a) in enumerate(stored)]
        _, _, write = self.run_step("lama", stored)
        rows = write.call_args.args[1]
        self.assertTrue({"lo80", "hi80", "lo95", "hi95"} <= {r[3] for r in rows if r[:3] == (CPI, "2026-11", "musiman")})


class PublishRowsTest(unittest.TestCase):
    ORIGIN, CUTOFF = date(2026, 11, 7), date(2026, 10, 1)

    def stored(self, *rows):
        return [(CPI, ref, model, stat, value, self.ORIGIN, self.CUTOFF) for ref, model, stat, value in rows]

    def test_horizon_counts_periods_from_the_last_official_number(self):
        self.assertEqual(forecast.horizon_of("2026-Q4", date(2026, 7, 1)), 1)
        self.assertEqual(forecast.horizon_of("2027-Q4", date(2026, 7, 1)), 5)
        self.assertEqual(forecast.horizon_of("2026-11", self.CUTOFF), 1)
        self.assertEqual(forecast.horizon_of("2027-02", date(2026, 8, 1)), 6)

    def test_rows_mark_the_main_model_and_carry_bands(self):
        rows = forecast.forecast_rows(self.stored(
            ("2026-11", "musiman", "point", 3.3), ("2026-11", "musiman", "lo80", 2.9),
            ("2026-11", "musiman", "hi80", 3.7), ("2026-11", "sama_terakhir", "point", 3.2),
        ), {(CPI, 1): "musiman"})
        by_model = {row[2]: row for row in rows}
        self.assertEqual(by_model["musiman"], (CPI, "2026-11", "musiman", True, 1, 3.3, 2.9, 3.7, self.ORIGIN))
        self.assertEqual(by_model["sama_terakhir"], (CPI, "2026-11", "sama_terakhir", False, 1, 3.2, None, None,
                                                     self.ORIGIN))

    def test_absent_main_model_falls_back_to_a_baseline(self):
        rows = forecast.forecast_rows(self.stored(
            ("2026-11", "ar1", "point", 3.1), ("2026-11", "sama_terakhir", "point", 3.2),
        ), {(CPI, 1): "dfm"})
        self.assertEqual([row[2] for row in rows if row[3]], ["sama_terakhir"])

    def test_every_period_has_exactly_one_main_number(self):
        inputs = synthetic()
        offsets = {}
        rows = forecast.rows_for(inputs, offsets, date(2026, 11, 7))
        stored = [(s, r, m, stat, v, self.ORIGIN, forecast.data_cutoffs(inputs)[s]) for s, r, m, stat, v, _ in rows]
        published = forecast.forecast_rows(stored, {})
        mains = {}
        for row in published:
            mains[row[0], row[1]] = mains.get((row[0], row[1]), 0) + row[3]
        self.assertEqual(set(mains.values()), {1})
        self.assertEqual({row[4] for row in published if row[0] == UNEMP}, {3, 6})

    def test_record_rows_measure_against_the_first_release(self):
        finished = [(CPI, "2026-11", "musiman", self.ORIGIN, self.CUTOFF, 3.3, 3.1, 3.15),
                    (CPI, "2026-11", "sama_terakhir", self.ORIGIN, self.CUTOFF, 3.2, 3.1, 3.15)]
        rows = forecast.record_rows(finished, {(CPI, 1): "musiman"})
        by_model = {row[2]: row for row in rows}
        self.assertTrue(by_model["musiman"][4])
        self.assertFalse(by_model["sama_terakhir"][4])
        self.assertAlmostEqual(by_model["musiman"][8], 0.2)

    def test_score_rows_cover_every_window_and_model(self):
        rows = backtest.score_rows(CompareTest().frame(), {(CPI, 1): "musiman"})
        self.assertEqual({row[3] for row in rows}, {"normal", "sebelum", "uji", "semua"})
        self.assertEqual({row[1] for row in rows}, {"sama_terakhir", "ar1", "musiman"})
        row = next(r for r in rows if r[1] == "musiman" and r[3] == "semua")
        self.assertIs(row[4], True)
        self.assertAlmostEqual(row[5], 0.1)
        self.assertEqual(row[7], 168)
        self.assertFalse(any(r[4] for r in rows if r[1] != "musiman"))


class CliModelStepTest(unittest.TestCase):
    def test_new_forecast_refreshes_the_site_so_the_tab_is_current(self):
        with mock.patch.object(cli, "report"), mock.patch.object(cli, "refresh_site", return_value=1) as refresh:
            self.assertEqual(self.call(return_value={"musiman": 14}), 1)
        refresh.assert_called_once()

    def call(self, **step):
        today = date(2026, 11, 7)
        with mock.patch.object(db, "connect", mock.MagicMock()), mock.patch.object(db, "lock"), \
                mock.patch.object(forecast, "step", **step):
            return cli.run_models({}, today)

    def test_missing_input_is_skipped_without_failing_the_job(self):
        self.assertEqual(self.call(side_effect=MissingInput("idn_cpi_index_m")), 0)

    def test_model_error_turns_the_job_red_without_printing_its_message(self):
        with mock.patch("sys.stderr") as stderr:
            self.assertEqual(self.call(side_effect=RuntimeError("rahasia")), 1)
        written = "".join(str(call.args[0]) for call in stderr.write.call_args_list)
        self.assertIn("RuntimeError", written)
        self.assertNotIn("rahasia", written)

    def test_bad_holiday_table_turns_the_job_red_with_its_public_message(self):
        with mock.patch("sys.stderr") as stderr:
            self.assertEqual(self.call(side_effect=config.ConfigError("holidays.csv baris 3")), 1)
        self.assertIn("holidays.csv baris 3", "".join(str(c.args[0]) for c in stderr.write.call_args_list))

    def test_unchanged_inputs_write_nothing(self):
        with mock.patch.object(cli, "report") as report:
            self.assertEqual(self.call(return_value=None), 0)
        report.assert_not_called()

    def test_held_lock_does_not_crash(self):
        with mock.patch.object(db, "connect", mock.MagicMock()), \
                mock.patch.object(db, "lock", side_effect=db.Stop("run lain")), \
                mock.patch("sys.stderr"):
            self.assertEqual(cli.run_models({}, date(2026, 11, 7)), 1)


if __name__ == "__main__":
    unittest.main()
