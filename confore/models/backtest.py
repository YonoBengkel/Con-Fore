"""Backtest bergulir: setiap bulan sejak 2012, memakai data yang sudah terbit saat itu.

Hasilnya dinilai di empat jendela: masa normal (asal dan periode di luar masa COVID), sebelum COVID,
data uji (asal sejak 2022), dan semua periode. Bentuk model dipilih dari asal sampai 2019, jadi data uji
menjadi pemeriksanya. Data uji adalah bagian dari masa normal, dan sebelum COVID juga.
"""

import math

import numpy as np
import pandas as pd
from scipy import stats

from confore.models import gdp, inflation, unemployment
from confore.models.data import COVID_FIRST, CPI, GDP, UNEMP, in_covid

START = pd.Period("2012-01", "M")
TEST_FROM = pd.Period("2022-01", "M")
BASELINES = ("sama_terakhir", "ar1")
MODULES = {GDP: gdp, CPI: inflation, UNEMP: unemployment}
TITLES = {
    GDP: "Pertumbuhan PDB, kuartal dari angka resmi terakhir",
    CPI: "Inflasi y-on-y, bulan dari angka resmi terakhir",
    UNEMP: "TPT, bulan dari angka resmi terakhir (eksperimental)",
}
SHOWN_HORIZONS = {
    GDP: (1, 2, 3, 4, 5, 6, 7, 8, 9),
    CPI: (1, 2, 3, 4, 6, 9, 12, 15, 18, 24),
    UNEMP: (3, 6, 9, 12),
}
LABELS = {
    "sama_terakhir": "Sama dengan terakhir",
    "ar1": "AR(1)",
    "dfm": "DFM",
    "musiman": "Musiman dan Lebaran",
    "arimax": "ARIMAX",
    "regresi": "Regresi tanpa PDB",
    "regresi_pdb": "Regresi dengan PDB",
}
COLUMNS = ["series_id", "model", "origin", "ref", "horizon", "forecast", "actual"]
MIN_ERRORS = 20  # kurang dari ini, tidak ada rentang, dan model tidak bisa menjadi angka utama
WINDOW_LABELS = {
    "sebelum": "sebelum COVID, asal sejak 2012",
    "uji": "data uji, asal sejak 2022",
    "semua": "semua periode",
}


def actuals(inputs):
    return {GDP: inputs.gdp, CPI: inflation.yoy(inputs.cpi_index), UNEMP: inputs.unemp}


def period_text(period):
    """Format periode pipeline: 2026-Q3 untuk kuartal, 2026-10 untuk bulan."""
    return f"{period.year}-Q{period.quarter}" if period.freqstr.startswith("Q") else str(period)


def text_period(text):
    return pd.Period(text.replace("-Q", "Q"), "Q" if "Q" in text else "M")


def run(inputs, start=START, end=None):
    """Kembalikan tabel galat dan jumlah asal tanpa hasil per (seri, model).

    TPT hanya diramal pada asal pertama sesudah rilis baru, karena rondenya jarang.
    """
    end = end or inputs.cpi_index.index[-1] + 1
    truth = actuals(inputs)
    rows, missed, last_round = [], {}, None
    for origin in pd.period_range(start, end, freq="M"):
        available = inputs.at(origin)
        for series_id, module in MODULES.items():
            if series_id == UNEMP:
                if available.unemp.index[-1] == last_round:
                    continue
                last_round = available.unemp.index[-1]
            for model, path in module.forecasts(available).items():
                if path is None:
                    missed[series_id, model] = missed.get((series_id, model), 0) + 1
                    continue
                for ref, value in path.items():
                    if ref in truth[series_id].index:
                        rows.append((series_id, model, origin, ref, module.horizon(available, ref),
                                     value, float(truth[series_id][ref])))
    return pd.DataFrame(rows, columns=COLUMNS), missed


def comparable(frame, series_id):
    """Baris tempat semua model punya ramalan, supaya perbandingan adil. Satu kolom per model."""
    part = frame[frame["series_id"] == series_id]
    wide = part.pivot_table(index=["origin", "ref", "horizon", "actual"], columns="model",
                            values="forecast", observed=True)
    return wide.dropna().reset_index()


def window_masks(wide):
    """Empat jendela. Sebelum COVID dan data uji tidak bertumpuk, dan keduanya bagian dari masa normal."""
    origin_covid = wide["origin"].map(in_covid)
    ref_covid = wide["ref"].map(in_covid)
    normal = ~(origin_covid | ref_covid)
    return {
        "normal": normal,
        "sebelum": normal & (wide["origin"] < COVID_FIRST),
        "uji": wide["origin"] >= TEST_FROM,
        "semua": pd.Series(True, index=wide.index),
    }


def scores(wide, models):
    """MAE, RMSE, dan jumlah baris per horizon dan model."""
    out = {}
    for horizon, part in wide.groupby("horizon"):
        out[horizon] = {"n": len(part)}
        for model in models:
            errors = part[model] - part["actual"]
            out[horizon][model] = (float(errors.abs().mean()), math.sqrt(float((errors ** 2).mean())))
    return out


def diebold_mariano(challenger, baseline, lag):
    """Nilai p dua sisi untuk selisih galat absolut: Newey-West dengan koreksi sampel kecil
    Harvey, Leybourne, dan Newbold. None bila sampelnya terlalu kecil."""
    diff = np.abs(challenger) - np.abs(baseline)
    count = len(diff)
    steps = lag + 1
    adjustment = (count + 1 - 2 * steps + steps * (steps - 1) / count) / count if count else 0
    if count < 8 or adjustment <= 0:
        return None
    centered = diff - diff.mean()
    variance = float(centered @ centered) / count
    for k in range(1, min(lag, count - 1) + 1):
        variance += 2 * (1 - k / (lag + 1)) * float(centered[k:] @ centered[:-k]) / count
    if variance <= 0:
        return None
    statistic = float(diff.mean()) / math.sqrt(variance / count) * math.sqrt(adjustment)
    return float(2 * stats.t.sf(abs(statistic), count - 1))


def choose(normal, test, models):
    """Angka utama satu horizon: model yang mengalahkan semua baseline di masa normal dan di data uji,
    dengan cukup baris di keduanya. Tanpa itu, baseline dengan MAE terkecil di masa normal."""
    baselines = [m for m in models if m in BASELINES]
    best_base = min(baselines, key=lambda m: normal[m][0])
    if not test or min(normal["n"], test["n"]) < MIN_ERRORS:
        return best_base
    test_base = min(test[m][0] for m in baselines)
    winners = [m for m in models if m not in BASELINES
               and normal[m][0] < normal[best_base][0] and test[m][0] < test_base]
    return min(winners, key=lambda m: normal[m][0]) if winners else best_base


def model_columns(wide):
    return [c for c in wide.columns if c not in ("origin", "ref", "horizon", "actual")]


def main_models(frame):
    """{(seri, horizon): model} untuk seluruh horizon, dipakai laporan dan tab Prediksi (fase 4)."""
    out = {}
    for series_id in MODULES:
        wide = comparable(frame, series_id)
        if wide.empty:
            continue
        models = model_columns(wide)
        masks = window_masks(wide)
        normal = scores(wide[masks["normal"]], models)
        test = scores(wide[masks["uji"]], models)
        for horizon, row in normal.items():
            out[series_id, horizon] = choose(row, test.get(horizon), models)
    return out


def number(value, digits=3):
    return f"{value:.{digits}f}".replace(".", ",")


def model_order(models):
    return [m for m in BASELINES if m in models] + sorted(m for m in models if m not in BASELINES)


def tables(frame, missed):
    """Daftar (judul, kepala, baris) untuk laporan."""
    out = []
    chosen = main_models(frame)
    for series_id in MODULES:
        wide = comparable(frame, series_id)
        if wide.empty:
            continue
        models = model_order(model_columns(wide))
        masks = window_masks(wide)
        names = [LABELS.get(m, m) for m in models]
        out.append(_main_table(series_id, wide[masks["normal"]], models, names, chosen))
        for key, label in WINDOW_LABELS.items():
            part = scores(wide[masks[key]], models)
            rows = [(h, part[h]["n"], *(number(part[h][m][0]) for m in models))
                    for h in SHOWN_HORIZONS[series_id] if h in part]
            out.append((f"{TITLES[series_id]}: MAE, {label}", ["Horizon", "n", *names], rows))
        part = scores(wide[masks["normal"]], models)
        rows = [(h, part[h]["n"], *(number(part[h][m][1]) for m in models))
                for h in SHOWN_HORIZONS[series_id] if h in part]
        out.append((f"{TITLES[series_id]}: RMSE, masa normal", ["Horizon", "n", *names], rows))
    out.append(("Cakupan rentang 80% angka utama: dibuat dari asal sampai 2019, diuji pada asal sejak 2022",
                ["Seri", "Horizon", "Model", "Baris uji", "Cakupan"], _coverage_rows(frame, chosen)))
    if missed:
        out.append(("Asal tanpa hasil model", ["Seri", "Model", "Jumlah asal"],
                    [(s, LABELS.get(m, m), count) for (s, m), count in sorted(missed.items())]))
    return out


def _main_table(series_id, normal_part, models, names, chosen):
    normal = scores(normal_part, models)
    baselines = [m for m in models if m in BASELINES]
    challengers = [m for m in models if m not in BASELINES]
    rows = []
    for horizon in SHOWN_HORIZONS[series_id]:
        if horizon not in normal:
            continue
        row = normal[horizon]
        best_base = min(baselines, key=lambda m: row[m][0])
        change, p_value = "-", None
        if challengers:
            best_model = min(challengers, key=lambda m: row[m][0])
            part = normal_part[normal_part["horizon"] == horizon].sort_values("origin")
            lag = {GDP: 3 * horizon, CPI: horizon, UNEMP: 1}[series_id]
            p_value = diebold_mariano((part[best_model] - part["actual"]).to_numpy(),
                                      (part[best_base] - part["actual"]).to_numpy(), lag)
            change = f"{number((row[best_model][0] / row[best_base][0] - 1) * 100, 0)}%"
        rows.append((horizon, row["n"], *(number(row[m][0]) for m in models),
                     LABELS.get(chosen[series_id, horizon], chosen[series_id, horizon]),
                     change, number(p_value, 2) if p_value is not None else "-"))
    return (f"{TITLES[series_id]}: MAE, masa normal",
            ["Horizon", "n", *names, "Angka utama", "Galat model terbaik dibanding baseline terbaik", "Nilai p"], rows)


def with_errors(frame):
    """Tambah kolom galat dan penanda masa normal. Butuh kolom origin dan ref berupa Period."""
    return frame.assign(error=frame["actual"] - frame["forecast"],
                        normal=~(frame["origin"].map(in_covid) | frame["ref"].map(in_covid)))


def _coverage_rows(frame, chosen):
    errors = with_errors(frame)
    rows = []
    for series_id in MODULES:
        for horizon in SHOWN_HORIZONS[series_id]:
            model = chosen.get((series_id, horizon))
            part = errors[(errors["series_id"] == series_id) & (errors["model"] == model)
                          & (errors["horizon"] == horizon)]
            earlier = part[part["normal"] & (part["origin"] < COVID_FIRST)]["error"]
            later = part[part["origin"] >= TEST_FROM]["error"]
            if len(earlier) < MIN_ERRORS or later.empty:
                continue
            low, high = earlier.quantile(0.10), earlier.quantile(0.90)
            share = float(later.between(low, high).mean())
            rows.append((series_id, horizon, LABELS.get(model, model), len(later), f"{share:.0%}"))
    return rows


def error_offsets(frame):
    """Rentang dari galat backtest: {(seri, model, horizon): {stat: selisih dari titik ramalan}}.

    Rentang 80% dari masa normal, jadi lebarnya menggambarkan masa biasa. Rentang 95% dari semua periode
    termasuk masa COVID, jadi guncangan besar ikut tergambar.
    """
    out = {}
    for key, part in with_errors(frame).groupby(["series_id", "model", "horizon"]):
        bands = {}
        calm = part.loc[part["normal"], "error"]
        if len(calm) >= MIN_ERRORS:
            bands["lo80"], bands["hi80"] = float(calm.quantile(0.10)), float(calm.quantile(0.90))
        if len(part) >= MIN_ERRORS:
            bands["lo95"] = min(float(part["error"].quantile(0.025)), bands.get("lo80", math.inf))
            bands["hi95"] = max(float(part["error"].quantile(0.975)), bands.get("hi80", -math.inf))
        if bands:
            out[key] = bands
    return out


def db_rows(frame):
    """Baris untuk etl.backtest."""
    return [(row.series_id, row.model, row.origin.to_timestamp().date().replace(day=15),
             period_text(row.ref), int(row.horizon), row.forecast, row.actual)
            for row in frame.itertuples(index=False)]


def frame_from_db(rows):
    """Kebalikan db_rows, untuk menghitung rentang dari isi etl.backtest."""
    frame = pd.DataFrame(rows, columns=["series_id", "model", "origin", "ref", "horizon", "forecast", "actual"])
    frame["origin"] = [pd.Period(day, "M") for day in frame["origin"]]
    frame["ref"] = [text_period(text) for text in frame["ref"]]
    return frame
