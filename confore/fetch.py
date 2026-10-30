"""Ambil satu seri dari API sumber dan ubah menjadi observasi ternormalisasi.

Semua sumber di sini menjawab dalam CSV SDMX dengan kolom TIME_PERIOD dan OBS_VALUE.
Error dilaporkan sebagai FetchError dengan kode tetap (misalnya "HTTP 503"), tidak pernah URL
atau isi jawaban.
"""

import csv
import hashlib
import http.client
import io
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import NamedTuple

USER_AGENT = "Con-Fore (github.com/YonoBengkel/Con-Fore)"
BASES = {
    "imf": ("https://api.imf.org/external/sdmx/2.1/data/",
            {"Accept": "application/vnd.sdmx.data+csv;version=1.0.0"}),
    "bis": ("https://stats.bis.org/api/v2/data/dataflow/BIS/", {}),
    "oecd": ("https://sdmx.oecd.org/public/rest/data/", {}),
    "ecb": ("https://data-api.ecb.europa.eu/service/data/", {}),
}
ATTEMPTS = 3
RETRY_CODES = {429, 500, 502, 503, 504}
MAX_BYTES = 20_000_000
PERIOD_FORMATS = {
    "A": re.compile(r"(\d{4})"),
    "Q": re.compile(r"(\d{4})-Q([1-4])"),
    "M": re.compile(r"(\d{4})-M?(\d{2})"),
    "D": re.compile(r"\d{4}-\d{2}-\d{2}"),
}


class HttpsOnlyRedirect(urllib.request.HTTPRedirectHandler):
    """Ikuti pengalihan hanya ke https; pengalihan lain menjadi HTTPError dengan kode 3xx."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urllib.parse.urlsplit(newurl).scheme != "https":
            return None
        return super().redirect_request(req, fp, code, msg, headers, newurl)


OPENER = urllib.request.build_opener(HttpsOnlyRedirect)


class Point(NamedTuple):
    period: str
    start: date
    value: Decimal
    status: str | None = None
    seen: date | None = None
    release: date | None = None


class FetchError(Exception):
    def __init__(self, code, http_status=None):
        super().__init__(code)
        self.code = code
        self.http_status = http_status


def period_of(raw, frequency):
    """Ubah periode sumber ke format baku dan tanggal awalnya; ValueError bila tidak cocok."""
    match = PERIOD_FORMATS[frequency].fullmatch(raw)
    if not match:
        raise ValueError("periode tidak dikenal")
    if frequency == "A":
        return raw, date(int(raw), 1, 1)
    if frequency == "Q":
        year, quarter = int(match[1]), int(match[2])
        return f"{year}-Q{quarter}", date(year, 3 * quarter - 2, 1)
    if frequency == "M":
        year, month = int(match[1]), int(match[2])
        return f"{year}-{month:02d}", date(year, month, 1)
    return raw, date.fromisoformat(raw)


def retry_wait(retry_after, attempt):
    if retry_after and retry_after.isdigit():
        return min(int(retry_after), 60)
    return 5 * 2 ** attempt


def get(url, headers):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **headers})
    for attempt in range(ATTEMPTS):
        try:
            with OPENER.open(request, timeout=60) as response:
                body = response.read(MAX_BYTES + 1)
                if len(body) > MAX_BYTES:
                    raise FetchError("jawaban terlalu besar", 200)
                # Terpotong: Content-Length belum terpenuhi, atau (jawaban tanpa panjang) tidak
                # diakhiri baris baru seperti semua jawaban CSV SDMX yang utuh.
                if response.length or not body.endswith(b"\n"):
                    raise http.client.IncompleteRead(body)
            return body.decode("utf-8-sig")
        except urllib.error.HTTPError as error:
            error.close()
            if error.code not in RETRY_CODES or attempt == ATTEMPTS - 1:
                raise FetchError(f"HTTP {error.code}", error.code) from None
            wait = retry_wait(error.headers.get("Retry-After"), attempt)
        except UnicodeDecodeError:
            raise FetchError("bukan UTF-8", 200) from None
        except (OSError, http.client.HTTPException) as error:
            if attempt == ATTEMPTS - 1:
                raise FetchError(type(error).__name__) from None
            wait = retry_wait(None, attempt)
        time.sleep(wait)


def parse(body, frequency, actual_only=False):
    """CSV SDMX menjadi daftar Point terurut; baris tanpa nilai (kosong atau NaN) dilewati."""
    reader = csv.DictReader(io.StringIO(body))
    if not {"TIME_PERIOD", "OBS_VALUE"} <= set(reader.fieldnames or []):
        raise FetchError("kolom berubah", 200)
    points = {}
    for row in reader:
        raw = (row["OBS_VALUE"] or "").strip()
        if not raw or raw.lower() == "nan":
            continue
        try:
            period, start = period_of((row["TIME_PERIOD"] or "").strip(), frequency)
        except ValueError:
            raise FetchError("periode tidak valid", 200) from None
        if actual_only:
            last = (row.get("LATEST_ACTUAL_ANNUAL_DATA") or "").strip()
            if not last.isdigit():
                raise FetchError("tanpa tahun aktual", 200)
            if start.year > int(last):
                continue
        try:
            value = Decimal(raw)
        except InvalidOperation:
            raise FetchError("nilai tidak valid", 200) from None
        if not value.is_finite():
            raise FetchError("nilai tidak valid", 200)
        if period in points:
            raise FetchError("periode ganda", 200)
        points[period] = Point(period, start, value, (row.get("OBS_STATUS") or "").strip() or None)
    if not points:
        raise FetchError("tanpa data", 200)
    return sorted(points.values(), key=lambda point: point.start)


def fetch_series(item):
    base, headers = BASES[item["source"]]
    return parse(get(base + item["query"], headers), item["frequency"],
                 item.get("actual_only", False))


def data_hash(points):
    """Hash data ternormalisasi (periode dan nilai), bukan hash berkas mentah."""
    text = "".join(f"{p.period}={format(p.value.normalize(), 'f')}\n" for p in points)
    return hashlib.sha256(text.encode()).hexdigest()
