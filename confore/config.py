"""Muat dan periksa tabel manual di folder config/.

Registri seri ada di `config/series.toml`; sumber, target resmi, dan kalender rilis di CSV.
Isi config bersifat publik, jadi pesan ConfigError boleh dicetak apa adanya.
"""

import csv
import tomllib
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from confore.fetch import bps_items, period_of

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
FREQUENCIES = {"A", "Q", "M", "D"}
CONCEPTS = {"level", "index", "yoy", "avg_yoy", "eop_yoy", "rate", "round_rate"}
DERIVE_INPUTS = {"yoy": 1, "ratio": 2}
TARGET_KINDS = {"apbn", "pmk", "rpjmn"}
VERIFICATIONS = {"dokumen", "berita"}


class ConfigError(ValueError):
    pass


def read_csv(name):
    with open(CONFIG / name, encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def number(text, where):
    if not text:
        return None
    try:
        return Decimal(text)
    except InvalidOperation:
        raise ConfigError(f"{where}: angka tidak valid") from None


def iso_date(text, where):
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise ConfigError(f"{where}: tanggal harus YYYY-MM-DD") from None


def check_sources(rows):
    ids = set()
    for row in rows:
        if not all(row.get(key) for key in ("source_id", "name", "url", "terms_url", "license",
                                              "attribution_text")):
            raise ConfigError(f"sources.csv {row.get('source_id')}: ada kolom kosong")
        if not (row["url"].startswith("https://") and row["terms_url"].startswith("https://")):
            raise ConfigError(f"sources.csv {row['source_id']}: url dan terms_url harus https")
        if row["source_id"] in ids:
            raise ConfigError(f"sources.csv: source_id ganda {row['source_id']}")
        ids.add(row["source_id"])
    return ids


def check_series(items, source_ids):
    seen = {}
    for item in items:
        sid = item.get("id", "")
        for key in ("id", "source", "frequency", "unit", "concept", "name", "citation"):
            if not item.get(key):
                raise ConfigError(f"series.toml {sid}: kunci {key} kosong")
        if sid in seen:
            raise ConfigError(f"series.toml: id ganda {sid}")
        if item["source"] not in source_ids:
            raise ConfigError(f"series.toml {sid}: sumber {item['source']} tidak ada di sources.csv")
        if item["frequency"] not in FREQUENCIES or item["concept"] not in CONCEPTS:
            raise ConfigError(f"series.toml {sid}: frequency atau concept tidak dikenal")
        if "derive" in item:
            inputs = item.get("inputs", [])
            if len(inputs) != DERIVE_INPUTS.get(item["derive"], -1) or "query" in item:
                raise ConfigError(f"series.toml {sid}: derive atau inputs tidak valid")
            for name in inputs:
                if name not in seen or seen[name]["frequency"] != item["frequency"]:
                    raise ConfigError(f"series.toml {sid}: input {name} harus seri sebelumnya "
                                      "dengan frekuensi sama")
        elif not item.get("dataset") or not item.get("query"):
            raise ConfigError(f"series.toml {sid}: butuh dataset dan query, atau derive")
        elif item["source"] == "bps":
            # Format ketat (angka saja) juga mencegah key BPS tertulis di registri dan database.
            try:
                bps_items(item["query"])
            except ValueError:
                raise ConfigError(f"series.toml {sid}: query BPS tidak valid") from None
            if item["frequency"] not in {"M", "Q"}:
                raise ConfigError(f"series.toml {sid}: seri BPS harus bulanan atau kuartalan")
        seen[sid] = item
    return seen


def check_targets(rows, series):
    out, keys = [], set()
    for i, row in enumerate(rows, start=2):
        where = f"targets.csv baris {i}"
        key = (row["series_id"], row["year"], row["target_kind"])
        if key in keys:
            raise ConfigError(f"{where}: kombinasi series_id, year, target_kind ganda")
        keys.add(key)
        if row["series_id"] not in series or row["target_kind"] not in TARGET_KINDS:
            raise ConfigError(f"{where}: series_id atau target_kind tidak dikenal")
        if row["verification"] not in VERIFICATIONS or not row["document"]:
            raise ConfigError(f"{where}: verification atau document tidak valid")
        if not row["url"].startswith("https://") or not row["year"].isdigit():
            raise ConfigError(f"{where}: url harus https dan year berupa angka")
        value, lower, upper = (number(row[key], where) for key in ("value", "lower", "upper"))
        if value is None and (lower is None or upper is None):
            raise ConfigError(f"{where}: isi value, atau lower dan upper")
        if lower is not None and upper is not None and lower > upper:
            raise ConfigError(f"{where}: lower lebih besar dari upper")
        out.append((row["series_id"], int(row["year"]), row["target_kind"], value, lower, upper,
                    row["document"], row["url"], iso_date(row["last_verified"], where),
                    row["verification"]))
    return out


def check_calendar(rows, series):
    out, keys = [], set()
    for i, row in enumerate(rows, start=2):
        where = f"release_calendar.csv baris {i}"
        item = series.get(row["series_id"])
        if item is None or not row["calendar_source"]:
            raise ConfigError(f"{where}: series_id tidak dikenal atau calendar_source kosong")
        try:
            period, _ = period_of(row["ref_period"], item["frequency"])
        except ValueError:
            raise ConfigError(f"{where}: ref_period tidak cocok dengan frekuensi seri") from None
        if (row["series_id"], period, row["calendar_source"]) in keys:
            raise ConfigError(f"{where}: baris kalender ganda")
        keys.add((row["series_id"], period, row["calendar_source"]))
        out.append((row["series_id"], period, row["calendar_source"],
                    iso_date(row["release_date"], where)))
    return out


def load():
    """Kembalikan dict berisi series, sources, targets, dan calendar yang sudah diperiksa."""
    with open(CONFIG / "series.toml", "rb") as handle:
        items = tomllib.load(handle).get("series", [])
    sources = read_csv("sources.csv")
    series = check_series(items, check_sources(sources))
    return {
        "series": items,
        "sources": sources,
        "targets": check_targets(read_csv("targets.csv"), series),
        "calendar": check_calendar(read_csv("release_calendar.csv"), series),
    }
