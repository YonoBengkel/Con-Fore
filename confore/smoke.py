"""Uji akses setiap sumber data: satu permintaan kecil per sumber.

Jalankan dari folder repo dengan `python -m confore.smoke`. Keluar dengan kode 1 bila ada
sumber yang gagal. Sumber yang butuh key dilewati selama key-nya belum diisi.
Catatan hasil hanya memuat kode HTTP atau nama jenis error, tidak pernah URL, key, atau isi error.
"""

import csv
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

USER_AGENT = "Con-Fore smoke test (github.com/YonoBengkel/Con-Fore)"
IMF = "https://api.imf.org/external/sdmx/2.1/data/"
IMF_CSV = {"Accept": "application/vnd.sdmx.data+csv;version=1.0.0"}
KEY_FORMAT = re.compile(r"[A-Za-z0-9]+")


def has_obs(body):
    """CSV SDMX berisi minimal satu baris dengan nilai observasi."""
    return any(row.get("OBS_VALUE") for row in csv.DictReader(io.StringIO(body)))


def oecd_ok(body):
    return "IDN" in body and has_obs(body)


def frankfurter_ok(body):
    return isinstance(json.loads(body)["rates"]["IDR"], (int, float))


def worldbank_ok(body):
    return any(row.get("value") is not None for row in json.loads(body)[1])


def bps_ok(body):
    data = json.loads(body)
    return isinstance(data, dict) and data.get("status") == "OK"


def fred_ok(body):
    return bool(json.loads(body)["observations"])


# (nama, url, header tambahan, cek isi jawaban, nama variabel key atau None)
CHECKS = [
    ("IMF WEO", IMF + "IMF.RES,WEO/IDN.NGDP_RPCH.A?startPeriod=2024", IMF_CSV, has_obs, None),
    ("IMF QNEA", IMF + "IMF.STA,QNEA/IDN.B1GQ.Q.NSA.XDC.Q?startPeriod=2025-Q1", IMF_CSV, has_obs, None),
    ("IMF CPI", IMF + "IMF.STA,CPI/IDN.CPI._T.YOY_PCH_PA_PT.M?startPeriod=2026-01", IMF_CSV, has_obs, None),
    ("IMF PCPS", IMF + "IMF.RES,PCPS/G001.PCOALAU.USD.M?startPeriod=2026-01", IMF_CSV, has_obs, None),
    ("BIS", "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.ID"
            "?lastNObservations=1&format=csv", {}, has_obs, None),
    ("OECD", "https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_CLI,/.M.LI...AA...H"
             "?lastNObservations=1&format=csvfilewithlabels", {}, oecd_ok, None),
    ("ECB", "https://data-api.ecb.europa.eu/service/data/EXR/D.IDR.EUR.SP00.A"
            "?lastNObservations=1&format=csvdata", {}, has_obs, None),
    ("Frankfurter", "https://api.frankfurter.dev/v1/latest?base=USD&symbols=IDR", {}, frankfurter_ok, None),
    ("World Bank", "https://api.worldbank.org/v2/country/IDN/indicator/NY.GDP.MKTP.KD.ZG"
                   "?format=json&mrv=1", {}, worldbank_ok, None),
    ("BPS", "https://webapi.bps.go.id/v1/api/list/model/subject/domain/0000/key/{key}", {}, bps_ok,
     "BPS_API_KEY"),
    ("FRED", "https://api.stlouisfed.org/fred/series/observations?series_id=DCOILBRENTEU"
             "&file_type=json&sort_order=desc&limit=1&api_key={key}", {}, fred_ok, "FRED_API_KEY"),
]


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Tolak pengalihan, supaya key tidak ikut terkirim ke alamat lain."""

    def redirect_request(self, *args, **kwargs):
        return None


def load_dotenv(path=Path(".env")):
    """Isi environment dari .env bila ada, tanpa menimpa variabel yang sudah ada."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip().removeprefix("export ").strip(), value.strip().strip("'\""))


def check(name, url, headers, ok, key_env):
    """Kembalikan (nama, hasil, catatan, detik)."""
    key = os.environ.get(key_env, "").strip() if key_env else ""
    if key_env and not key:
        return name, "dilewati", f"{key_env} belum diisi", 0.0
    if key_env and not KEY_FORMAT.fullmatch(key):
        return name, "gagal", f"format {key_env} tidak valid", 0.0
    opener = urllib.request.build_opener(_NoRedirect) if key_env else urllib.request.build_opener()
    request = urllib.request.Request(url.format(key=key), headers={"User-Agent": USER_AGENT, **headers})
    start = time.monotonic()
    try:
        with opener.open(request, timeout=30) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        return name, "gagal", f"HTTP {error.code}", time.monotonic() - start
    except urllib.error.URLError as error:
        return name, "gagal", f"URLError: {type(error.reason).__name__}", time.monotonic() - start
    except Exception as error:  # timeout, TLS, URL tidak valid
        return name, "gagal", type(error).__name__, time.monotonic() - start
    seconds = time.monotonic() - start
    try:
        passed = ok(body)
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        passed = False
    if not passed:
        return name, "gagal", "jawaban tanpa data", seconds
    return name, "ok", f"{len(body)} byte", seconds


def main():
    load_dotenv()
    rows = [check(*item) for item in CHECKS]
    lines = ["| Sumber | Hasil | Catatan | Detik |", "|---|---|---|---|"]
    lines += [f"| {name} | {result} | {note} | {seconds:.1f} |" for name, result, note, seconds in rows]
    print("\n".join(lines))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("## Uji akses sumber\n\n" + "\n".join(lines) + "\n")
    return 1 if any(result == "gagal" for _, result, _, _ in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
