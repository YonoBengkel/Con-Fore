"""Ramalan inflasi y-on-y dari perubahan bulanan, supaya efek basis tahun lalu ikut terhitung.

Perubahan bulanan diramal, lalu dirangkai di atas indeks yang sudah terbit. Jadi lonjakan satu kali
tahun lalu, misalnya diskon listrik Januari 2025, otomatis memengaruhi y-on-y setahun kemudian.
"""

import math
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

from confore.models.baseline import ar1, last_value

HORIZON = 24  # cukup sampai Desember tahun depan dari bulan Januari
WINDOW = 60  # lima tahun terakhir, karena tingkat inflasi Indonesia turun bertahap
CLIP = 3.0  # batas pencilan, dalam kelipatan simpangan median
BASELINE_WINDOW = 120


def monthly_change(index):
    return (np.log(index).diff() * 100).dropna()


def yoy(index):
    return (index.pct_change(12) * 100).dropna()


def clip_outliers(change):
    """Pangkas bulan yang jauh dari pola bulan kalendernya, misalnya kenaikan BBM.

    Tanpa daftar manual, jadi guncangan baru otomatis tidak dianggap pola musiman.
    """
    typical = change.groupby(change.index.month).transform("median")
    residual = change - typical
    center = residual.median()
    spread = (residual - center).abs().median() * 1.4826
    if spread < 1e-6:  # data tanpa simpangan: tidak ada yang bisa disebut pencilan
        return change
    return typical + residual.clip(center - CLIP * spread, center + CLIP * spread)


def calendar_design(months, inputs):
    """Konstanta, bulan kalender, Ramadan, dan Lebaran."""
    columns = [np.ones(len(months))]
    columns += [(months.month == month).astype(float) for month in range(2, 13)]
    columns.append(inputs.fasting.reindex(months).to_numpy())
    columns.append(inputs.lebaran.reindex(months).to_numpy())
    return np.column_stack(columns)


def chain_yoy(index, change):
    """Rangkai ramalan perubahan bulanan (log persen) menjadi y-on-y."""
    log_index = np.log(index).to_dict()
    out = {}
    for month, value in change.items():
        log_index[month] = log_index[month - 1] + value / 100
        out[month] = (math.exp(log_index[month] - log_index[month - 12]) - 1) * 100
    return out


def seasonal(inputs, refs):
    """Regresi perubahan bulanan pada pola kalender selama WINDOW bulan terakhir."""
    change = clip_outliers(monthly_change(inputs.cpi_index).iloc[-WINDOW:])
    design = calendar_design(change.index, inputs)
    beta = np.linalg.lstsq(design, change.to_numpy(), rcond=None)[0]
    path = pd.Series(calendar_design(refs, inputs) @ beta, index=refs)
    return chain_yoy(inputs.cpi_index, path)


def lagged_market(inputs, months):
    """Perubahan kurs, minyak, dan BI-Rate bulan lalu. Sesudah data habis: tidak berubah (nol)."""
    frame = pd.DataFrame({
        "fx": np.log(inputs.market["fx"]).diff() * 100,
        "brent": np.log(inputs.market["brent"]).diff() * 100,
        "rate": inputs.market["rate"].diff(),
    })
    full = frame.reindex(pd.period_range(frame.index[0], months[-1], freq="M")).shift(1)
    return full.reindex(months).fillna(0.0).to_numpy()


def arimax(inputs, refs):
    """Model rencana awal: AR(1) dengan pola kalender dan variabel pasar. None bila gagal."""
    change = clip_outliers(monthly_change(inputs.cpi_index).iloc[-WINDOW:])
    exog = np.column_stack([calendar_design(change.index, inputs)[:, 1:],
                            lagged_market(inputs, change.index)])
    future = np.column_stack([calendar_design(refs, inputs)[:, 1:], lagged_market(inputs, refs)])
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fitted = SARIMAX(change.to_numpy(), exog=exog, order=(1, 0, 0), trend="c").fit(
                disp=False, maxiter=50)
            path = fitted.forecast(steps=len(refs), exog=future)
    except (ValueError, np.linalg.LinAlgError):
        return None
    return chain_yoy(inputs.cpi_index, pd.Series(path, index=refs))


def forecasts(inputs):
    """{nama model: {bulan: y-on-y}}; model yang gagal bernilai None."""
    refs = pd.period_range(inputs.cpi_index.index[-1] + 1, periods=HORIZON, freq="M")
    history = yoy(inputs.cpi_index)
    return {
        "sama_terakhir": last_value(history, refs),
        "ar1": ar1(history, refs, window=BASELINE_WINDOW),
        "musiman": seasonal(inputs, refs),
        "arimax": arimax(inputs, refs),
    }


def horizon(inputs, ref):
    """Jumlah bulan dari angka resmi terakhir."""
    return (ref - inputs.cpi_index.index[-1]).n
