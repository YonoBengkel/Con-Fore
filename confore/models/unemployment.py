"""Ramalan TPT per ronde Sakernas untuk dua rilis berikutnya. Eksperimental: sampelnya kecil.

Ronde Februari dan Agustus ada sejak 2011, dan ronde Mei dan November baru sejak November 2025.
"""

import numpy as np
import pandas as pd

from confore.models.baseline import ar1, last_value
from confore.models.gdp import COVID_QUARTERS

ROUNDS_AHEAD = 2
MIN_PAIRS = 8
OUTLIER = pd.Period("2020-08", "M")  # lonjakan COVID: tidak ikut diestimasi
QUARTERLY_SINCE = pd.Period("2025-08", "M")


def next_rounds(last):
    """Ronde berikutnya sesudah ronde last: triwulanan sejak Agustus 2025, sebelumnya semesteran."""
    step = 3 if last >= QUARTERLY_SINCE else 6
    return tuple(last + step * (i + 1) for i in range(ROUNDS_AHEAD))


def growth_around(inputs, month, path):
    """Rata-rata y-on-y PDB selama empat kuartal sampai kuartal ronde itu."""
    quarter = month.asfreq("Q")
    values = [inputs.gdp.get(quarter - k, path.get(quarter - k)) for k in range(4)]
    return float(np.mean([v if v is not None else inputs.gdp.iloc[-1] for v in values]))


def regression(inputs, refs, use_gdp):
    """TPT ronde = a + b * TPT ronde sebelumnya + c * ronde Agustus (+ d * rata-rata PDB).

    Ramalan PDB untuk kuartal yang belum terbit berasal dari AR(1), supaya model ini tidak bergantung
    pada DFM. Kembalikan None bila pasangannya belum cukup.
    """
    known = inputs.unemp
    quarters = pd.period_range(inputs.gdp.index[-1] + 1, periods=12, freq="Q")
    path = ar1(inputs.gdp, quarters, skip=COVID_QUARTERS)

    def row(previous, month):
        cells = [1.0, previous, float(month.month == 8)]
        return cells + [growth_around(inputs, month, path)] if use_gdp else cells

    rows, target = [], []
    for before, month in zip(known.index[:-1], known.index[1:]):
        if OUTLIER not in (before, month):
            rows.append(row(known[before], month))
            target.append(known[month])
    if len(rows) < MIN_PAIRS:
        return None
    beta = np.linalg.lstsq(np.array(rows), np.array(target), rcond=None)[0]
    out, current = {}, float(known.iloc[-1])
    for ref in refs:
        current = float(np.dot(row(current, ref), beta))
        out[ref] = current
    return out


def forecasts(inputs):
    """{nama model: {ronde: TPT}}; model yang belum cukup data bernilai None."""
    refs = inputs.upcoming_rounds or next_rounds(inputs.unemp.index[-1])
    return {
        "sama_terakhir": last_value(inputs.unemp, refs),
        "regresi_pdb": regression(inputs, refs, use_gdp=True),
        "regresi": regression(inputs, refs, use_gdp=False),
    }


def horizon(inputs, ref):
    """Jumlah bulan dari ronde terakhir. Rilis berikutnya kini berjarak 3 bulan, dulu 6 bulan, jadi
    galatnya tidak sepadan dan tidak boleh dicampur dalam satu horizon."""
    return (ref - inputs.unemp.index[-1]).n
