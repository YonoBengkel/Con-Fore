"""Ramalan harian: dijalankan ulang hanya bila data masukan, backtest, atau kode berubah."""

import hashlib
import importlib.metadata

import pandas as pd

from confore import config, db, publish
from confore.derive import derive_all
from confore.models.backtest import (BASELINES, CPI, GDP, MODULES, error_offsets, frame_from_db, main_models,
                                     period_text, score_rows, text_period)
from confore.models.data import UNEMP, build

PACKAGES = ("numpy", "pandas", "scipy", "statsmodels")


def input_hash(inputs, backtest_stamp=None, git_sha=None):
    """Sidik semua yang memengaruhi ramalan: data, kalender, backtest terakhir, dan versi kode.

    Kurs harian masuk sebagai rata-rata bulan lengkap, jadi tidak berubah harian.
    """
    digest = hashlib.sha256(f"{backtest_stamp}|{git_sha}".encode())
    for values in (inputs.gdp, inputs.cpi_index, inputs.unemp, inputs.market, inputs.fasting, inputs.lebaran):
        digest.update(values.to_csv(float_format="%.6f").encode())
    return digest.hexdigest()


def package_versions():
    return {name: importlib.metadata.version(name) for name in PACKAGES}


def rows_for(inputs, offsets, today):
    """Baris (series_id, ref_period, model, stat, value, horizon) sampai akhir tahun depan.

    TPT hanya dua rilis berikutnya, jadi tidak dibatasi tanggal. Rentang ditambahkan bila backtest
    punya cukup galat untuk seri, model, dan horizon itu.
    """
    last_year = today.year + 1
    rows = []
    for series_id, module in MODULES.items():
        for model, path in module.forecasts(inputs).items():
            if path is None:
                continue
            for ref, value in path.items():
                if series_id != UNEMP and ref.year > last_year:
                    continue
                text, horizon = period_text(ref), module.horizon(inputs, ref)
                rows.append((series_id, text, model, "point", value, horizon))
                bands = offsets.get((series_id, model, horizon), {})
                rows.extend((series_id, text, model, stat, value + gap, horizon)
                            for stat, gap in bands.items())
    return rows


def data_cutoffs(inputs):
    """Periode terakhir setiap target saat ramalan dibuat, sebagai tanggal awal periodenya."""
    return {
        GDP: inputs.gdp.index[-1].to_timestamp().date(),
        CPI: inputs.cpi_index.index[-1].to_timestamp().date(),
        UNEMP: inputs.unemp.index[-1].to_timestamp().date(),
    }


def latest_inputs(conn, cfg, today):
    fetched = [s["id"] for s in cfg["series"] if "derive" not in s]
    data = db.latest_points(conn, fetched)
    derive_all(cfg["series"], data)
    return build(data, config.load_holidays(), today)


def horizon_of(ref_text, cutoff):
    """Horizon dari periode ramalan dan awal periode angka resmi terakhir saat ramalan dibuat."""
    ref = text_period(ref_text)
    return (ref - pd.Period(cutoff, ref.freqstr[0])).n


def is_main(chosen, series_id, horizon, model, available):
    """Angka utama hasil backtest. Bila model itu tidak punya ramalan kali ini, baseline yang pertama ada."""
    main = chosen.get((series_id, horizon))
    if main not in available:
        main = next(m for m in (*BASELINES, *sorted(available)) if m in available)
    return model == main


def forecast_rows(stored, chosen):
    """Baris untuk public.forecast_latest: satu baris per seri, periode, dan model."""
    grouped = {}
    for series_id, ref, model, stat, value, origin, cutoff in stored:
        row = grouped.setdefault((series_id, ref, model), {"origin": origin, "cutoff": cutoff})
        row[stat] = value
    rows = []
    for (series_id, ref, model), row in sorted(grouped.items()):
        horizon = horizon_of(ref, row["cutoff"])
        available = {m for s, r, m in grouped if s == series_id and r == ref}
        rows.append((series_id, ref, model, is_main(chosen, series_id, horizon, model, available), horizon,
                     row["point"], row.get("lo80"), row.get("hi80"), row["origin"]))
    return rows


def record_rows(finished, chosen):
    """Baris untuk public.track_record, dengan galat terhadap rilis pertama."""
    available = {}
    for series_id, ref, model, *_ in finished:
        available.setdefault((series_id, ref), set()).add(model)
    return [(series_id, ref, model, origin,
             is_main(chosen, series_id, horizon_of(ref, cutoff), model, available[series_id, ref]),
             value, first, latest, abs(value - first))
            for series_id, ref, model, origin, cutoff, value, first, latest in finished]


def publish_tables(conn):
    """Isi ulang tabel publik tab Prediksi dari isi etl.forecasts dan etl.backtest."""
    stored = db.backtest_errors(conn)
    frame = frame_from_db(stored) if stored else None
    chosen = main_models(frame) if stored else {}
    publish.publish_models(conn, forecast_rows(db.latest_forecasts(conn), chosen),
                           score_rows(frame, chosen) if stored else [],
                           record_rows(db.finished_forecasts(conn), chosen))


def step(conn, cfg, today, git_sha):
    """Tulis dan terbitkan ramalan baru bila sidiknya berubah. Kembalikan jumlah baris per model, None bila tetap."""
    inputs = latest_inputs(conn, cfg, today)
    digest = input_hash(inputs, db.backtest_stamp(conn), git_sha)
    if db.last_forecast_hash(conn) == digest:
        return None
    stored = db.backtest_errors(conn)
    rows = rows_for(inputs, error_offsets(frame_from_db(stored)) if stored else {}, today)
    db.write_forecasts(conn, [row[:5] for row in rows], today, data_cutoffs(inputs), digest, git_sha,
                       package_versions())
    publish_tables(conn)
    counts = {}
    for row in rows:
        counts[row[2]] = counts.get(row[2], 0) + 1
    return counts
