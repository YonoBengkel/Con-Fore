"""Bahan model: seri pipeline menjadi pandas, dan aturan data apa yang sudah terbit pada satu asal.

Riwayat vintage baru tersimpan sejak Oktober 2026, jadi backtest memakai nilai terbaru yang dipotong
menurut jadwal rilis. Revisi data tidak tertiru (ARCHITECTURE 4.6).
"""

from dataclasses import dataclass, replace
from datetime import date

import pandas as pd

GDP = "bps_gdp_growth_q"
GDP_HISTORY = "idn_gdp_growth_q"
CPI = "bps_cpi_yoy_m"
CPI_INDEX = "idn_cpi_index_m"
CPI_CHANGE = "bps_cpi_mom_m"
UNEMP = "bps_unemp_round"
PRICES = {"brent": "wld_brent_m", "coal": "wld_coal_m", "cpo": "wld_cpo_m", "nickel": "wld_nickel_m"}
RATE = "idn_policy_rate_m"
FX = "usd_idr_d"
REQUIRED = (GDP, GDP_HISTORY, CPI_INDEX, CPI_CHANGE, UNEMP, RATE, FX, *PRICES.values())

# Masa COVID untuk data bulanan: Februari 2020 sampai Desember 2021.
COVID_FIRST = pd.Period("2020-02", "M")
COVID_LAST = pd.Period("2021-12", "M")
FASTING_DAYS = 30


class MissingInput(Exception):
    """Seri bahan model belum tersedia; pesannya hanya memuat id seri."""


@dataclass(frozen=True)
class Inputs:
    gdp: pd.Series  # y-on-y kuartalan
    cpi_index: pd.Series  # indeks harga konsumen bulanan
    unemp: pd.Series  # TPT per ronde Sakernas, ditandai bulan survei
    market: pd.DataFrame  # harga komoditas, kurs, dan BI-Rate bulanan, hanya bulan yang sudah lengkap
    fasting: pd.Series  # porsi bulan Ramadan (30 hari sebelum Lebaran) yang jatuh di setiap bulan
    lebaran: pd.Series  # 1 pada bulan Lebaran
    upcoming_rounds: tuple = ()  # hanya backtest: dua ronde berikutnya yang benar-benar ada

    def at(self, origin):
        """Data yang sudah terbit pada tanggal 15 bulan origin, untuk backtest."""
        last_round = self.unemp.index[self.unemp.index + 3 <= origin]
        known = self.unemp.loc[:last_round[-1]] if len(last_round) else self.unemp.iloc[:0]
        later = self.unemp.index[self.unemp.index > known.index[-1]] if len(known) else self.unemp.index
        return replace(
            self,
            gdp=self.gdp.loc[:gdp_published(origin)],
            cpi_index=self.cpi_index.loc[:origin - 1],
            unemp=known,
            market=self.market.loc[:origin - 1],
            upcoming_rounds=tuple(later[:2]),
        )


def gdp_published(origin):
    """Kuartal terakhir yang sudah terbit pada tanggal 15 bulan origin.

    BPS merilis PDB sekitar tanggal 5 bulan kedua sesudah kuartal berakhir, jadi pada bulan pertama
    sebuah kuartal, kuartal sebelumnya belum terbit.
    """
    quarter = origin.asfreq("Q")
    return quarter - 2 if origin.month % 3 == 1 else quarter - 1


def series(points, frequency):
    """Daftar Point menjadi Series berindeks periode, terurut menurut waktu."""
    values = pd.Series({p.period: float(p.value) for p in points}, dtype=float)
    values.index = pd.PeriodIndex(values.index, freq=frequency)
    return values.sort_index()


def extend_index(index, changes):
    """Sambung indeks IMF ke depan dengan perubahan bulanan BPS, yang terbit lebih dulu."""
    out = index.copy()
    for month, change in changes.items():
        if month == out.index[-1] + 1:
            out.loc[month] = out.iloc[-1] * (1 + change / 100)
    return out


def calendar(holidays, months):
    """Porsi bulan Ramadan per bulan dan penanda bulan Lebaran, dari daftar tanggal Lebaran."""
    fasting = pd.Series(0.0, index=months)
    lebaran = pd.Series(0.0, index=months)
    for day in holidays:
        for back in range(1, FASTING_DAYS + 1):
            month = pd.Period(pd.Timestamp(day) - pd.Timedelta(days=back), "M")
            if month in fasting.index:
                fasting[month] += 1 / FASTING_DAYS
        month = pd.Period(pd.Timestamp(day), "M")
        if month in lebaran.index:
            lebaran[month] = 1.0
    return fasting, lebaran


def build(data, holidays, today: date):
    """Susun Inputs dari {id seri: daftar Point}. Bulan berjalan tidak ikut di data pasar."""
    for name in REQUIRED:
        if not data.get(name):
            raise MissingInput(name)
    gdp = series(data[GDP], "Q").combine_first(series(data[GDP_HISTORY], "Q"))
    cpi_index = extend_index(series(data[CPI_INDEX], "M"), series(data[CPI_CHANGE], "M"))
    market = {name: series(data[sid], "M") for name, sid in PRICES.items()}
    market["rate"] = series(data[RATE], "M")
    daily = series(data[FX], "D")
    market["fx"] = daily.groupby(daily.index.asfreq("M")).mean()
    this_month = pd.Period(today, "M")
    frame = pd.DataFrame(market).loc[:this_month - 1]
    months = pd.period_range("2000-01", f"{today.year + 3}-12", freq="M")
    fasting, lebaran = calendar(holidays, months)
    return Inputs(gdp, cpi_index, series(data[UNEMP], "M"), frame, fasting, lebaran)


def in_covid(period):
    """Apakah periode (bulan atau kuartal) menyentuh masa COVID."""
    return (period.asfreq("M", how="end") >= COVID_FIRST
            and period.asfreq("M", how="start") <= COVID_LAST)
