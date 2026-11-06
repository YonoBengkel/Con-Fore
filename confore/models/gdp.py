"""Ramalan pertumbuhan PDB y-on-y: baseline dan dynamic factor model campuran frekuensi."""

import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.dynamic_factor_mq import DynamicFactorMQ

from confore.models.baseline import ar1, last_value

HORIZON = 9  # cukup sampai akhir tahun depan dari bulan Januari
COVID_QUARTERS = pd.period_range("2020Q2", "2021Q3", freq="Q")
PANEL_START = "2009-01"  # sesuai awal riwayat PDB y-on-y
EXPLODED = 25.0  # EM tidak menjamin stasioner: ramalan sebesar ini dibuang, bukan dipakai


def panel(inputs):
    """Indikator bulanan dalam bentuk mirip y-on-y, sejajar dengan target."""
    frame = (np.log(inputs.market.drop(columns="rate")).diff(12) * 100)
    frame["rate"] = inputs.market["rate"].diff(12)
    frame["cpi"] = np.log(inputs.cpi_index).diff(12) * 100
    return frame.loc[PANEL_START:inputs.cpi_index.index[-1]]


def dfm(inputs, refs):
    """DynamicFactorMQ dengan satu faktor. Kembalikan {kuartal: nilai}, atau None bila gagal.

    Kuartal COVID dianggap kosong saat estimasi supaya tidak menguasai muatan faktor, kecuali dua
    kuartal terakhir, karena ramalan harus berangkat dari angka resmi terakhir.
    """
    monthly = panel(inputs)
    last = inputs.gdp.index[-1]
    quarterly = inputs.gdp.loc[monthly.index[0].asfreq("Q"):].copy()
    quarterly[quarterly.index.isin(COVID_QUARTERS) & (quarterly.index < last - 1)] = np.nan
    target = refs[-1].asfreq("M", how="end")
    steps = (target - monthly.index[-1]).n
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = DynamicFactorMQ(monthly, endog_quarterly=quarterly.to_frame("gdp"), factors=1,
                                    factor_orders=2, idiosyncratic_ar1=True, standardize=True)
            fitted = model.fit(maxiter=100, tolerance=1e-4, disp=False)
            # "filtered" memakai bulan panel terakhir juga untuk kuartal yang berakhir di bulan itu.
            path = fitted.get_prediction(start=0, end=len(monthly) - 1 + steps,
                                         information_set="filtered").predicted_mean["gdp"]
    except (ValueError, np.linalg.LinAlgError):
        return None
    path.index = pd.period_range(monthly.index[0], periods=len(path), freq="M")
    out = {ref: float(path.loc[ref.asfreq("M", how="end")]) for ref in refs}
    return out if all(abs(v) < EXPLODED for v in out.values()) else None


def forecasts(inputs):
    """{nama model: {kuartal: y-on-y}}; model yang gagal bernilai None."""
    refs = pd.period_range(inputs.gdp.index[-1] + 1, periods=HORIZON, freq="Q")
    return {
        "sama_terakhir": last_value(inputs.gdp, refs),
        "ar1": ar1(inputs.gdp, refs, skip=COVID_QUARTERS),
        "dfm": dfm(inputs, refs),
    }


def horizon(inputs, ref):
    """Jumlah kuartal dari angka resmi terakhir."""
    return (ref - inputs.gdp.index[-1]).n
