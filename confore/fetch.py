"""Ambil satu seri dari API sumber dan ubah menjadi observasi ternormalisasi.

IMF, BIS, OECD, dan ECB menjawab dalam CSV SDMX dengan kolom TIME_PERIOD dan OBS_VALUE; BPS
menjawab dalam JSON WebAPI (lihat parse_bps) atau tabel HTML di dalam JSON (lihat parse_bps_table).
Error dilaporkan sebagai FetchError dengan kode tetap (misalnya "HTTP 503"), tidak pernah URL atau
isi jawaban, karena URL BPS memuat key.
"""

import csv
import functools
import hashlib
import http.client
import io
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import NamedTuple

from confore.smoke import KEY_FORMAT, NoRedirect

USER_AGENT = "Con-Fore (github.com/YonoBengkel/Con-Fore)"
BASES = {
    "imf": ("https://api.imf.org/external/sdmx/2.1/data/",
            {"Accept": "application/vnd.sdmx.data+csv;version=1.0.0"}),
    "bis": ("https://stats.bis.org/api/v2/data/dataflow/BIS/", {}),
    "oecd": ("https://sdmx.oecd.org/public/rest/data/", {}),
    "ecb": ("https://data-api.ecb.europa.eu/service/data/", {}),
    # Key BPS disisipkan di path saat permintaan dibuat (bps_url), tidak pernah ada di registri.
    "bps": ("https://webapi.bps.go.id/v1/api/list/model/data/", {}),
}
ATTEMPTS = 3
RETRY_CODES = {429, 500, 502, 503, 504}
MAX_BYTES = 20_000_000
RATE_FLOOR = 5  # sisa kuota (header RateLimit-Remaining) yang membuat pipeline menunggu dulu
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
# Permintaan ber-key tidak mengikuti pengalihan, supaya key tidak terkirim ke alamat lain.
KEYED_OPENER = urllib.request.build_opener(NoRedirect)


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


def rate_wait(headers):
    """Jeda sesudah jawaban sukses menurut header RateLimit-*; 0 selama sisa kuota cukup.

    BPS mengirim RateLimit-Limit, -Remaining, dan -Policy (60 per menit) tanpa -Reset, jadi bila
    -Reset tidak ada, tunggu satu jendela penuh (60 detik).
    """
    remaining = headers.get("RateLimit-Remaining") or ""
    if not remaining.isdigit() or int(remaining) > RATE_FLOOR:
        return 0
    reset = headers.get("RateLimit-Reset") or ""
    return min(int(reset), 60) if reset.isdigit() else 60


def csv_complete(body):
    """Semua jawaban CSV SDMX yang utuh diakhiri baris baru."""
    return body.endswith(b"\n")


def json_complete(body):
    """Jawaban JSON WebAPI BPS yang utuh berupa satu objek, jadi diakhiri kurung kurawal."""
    return body.rstrip().endswith(b"}")


def get(url, headers, opener=OPENER, complete=csv_complete, data=None):
    # data yang terisi membuat urllib mengirim POST (dipakai revalidate.py).
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **headers})
    for attempt in range(ATTEMPTS):
        try:
            with opener.open(request, timeout=60) as response:
                body = response.read(MAX_BYTES + 1)
                if len(body) > MAX_BYTES:
                    raise FetchError("jawaban terlalu besar", 200)
                # Terpotong: Content-Length belum terpenuhi, atau (jawaban tanpa panjang) tidak
                # berakhir seperti jawaban utuh sumber itu.
                if response.length or not complete(body):
                    raise http.client.IncompleteRead(body)
                pause = rate_wait(response.headers)
            if pause:
                time.sleep(pause)  # kuota sumber hampir habis; beri jeda sebelum permintaan berikutnya
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


# --- BPS WebAPI ------------------------------------------------------------------------------

# Satu variabel BPS di query registri: "domain/<4 digit>/var/<id>/sejak/<tahun>", lalu filter
# opsional vervar dan turvar (angka saja). Beberapa variabel dipisah " + "; untuk periode yang
# sama, variabel yang ditulis belakangan menang. Pola ini sekaligus menolak key di registri.
BPS_ITEM = re.compile(r"domain/(\d{4})/var/(\d+)/sejak/(\d{4})"
                      r"(?:\?((?:vervar|turvar)=\d+(?:&(?:vervar|turvar)=\d+)*))?")
BPS_YEARS_PER_REQUEST = 3  # batas WebAPI untuk parameter th
BPS_PAUSE = 1.0  # jeda antarpermintaan ke BPS, supaya sopan
BPS_MONTHS = {name: i for i, name in enumerate(
    ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September",
     "Oktober", "November", "Desember"], start=1)}
BPS_QUARTERS = {"Triwulan I": 1, "Triwulan II": 2, "Triwulan III": 3, "Triwulan IV": 4}
BPS_YEARLY = "Tahunan"  # angka setahun penuh di samping bulan atau triwulan; tidak dipakai


def bps_items(query):
    """Pecah query BPS menjadi daftar (domain, var, tahun awal, filter); ValueError bila salah."""
    items = []
    for part in query.split(" + "):
        match = BPS_ITEM.fullmatch(part)
        if not match:
            raise ValueError("query BPS tidak valid")
        items.append((match[1], match[2], int(match[3]), match[4] or ""))
    return items


def bps_key():
    key = os.environ.get("BPS_API_KEY", "").strip()
    if not key:
        raise FetchError("BPS_API_KEY belum diisi")
    if not KEY_FORMAT.fullmatch(key):
        raise FetchError("format BPS_API_KEY tidak valid")
    return key


def bps_year_chunks(since, until):
    """Tahun since..until dalam potongan paling banyak 3 tahun, mulai dari yang terbaru."""
    years = list(range(since, until + 1))
    return [years[max(0, end - BPS_YEARS_PER_REQUEST):end]
            for end in range(len(years), 0, -BPS_YEARS_PER_REQUEST)]


def bps_th(years):
    """Id periode (th) WebAPI adalah tahun dikurangi 1900, misalnya 126 untuk 2026."""
    first, last = years[0] - 1900, years[-1] - 1900
    return str(first) if first == last else f"{first}:{last}"


def bps_url(domain, var, years, filters, key):
    url = f"{BASES['bps'][0]}domain/{domain}/var/{var}/th/{bps_th(years)}/key/{key}/"
    return url + ("?" + filters if filters else "")


def bps_period(year_label, sub_label, frequency):
    """Label tahun dan turunan tahun BPS menjadi (periode, tanggal awal); None untuk Tahunan.

    Seri bulanan menerima nama bulan (juga ronde Sakernas Februari, Mei, Agustus, November);
    seri kuartalan menerima Triwulan I sampai IV.
    """
    if sub_label == BPS_YEARLY:
        return None
    if not (year_label.isdigit() and len(year_label) == 4):
        raise ValueError("tahun tidak dikenal")
    if frequency == "M" and sub_label in BPS_MONTHS:
        return period_of(f"{year_label}-{BPS_MONTHS[sub_label]:02d}", "M")
    if frequency == "Q" and sub_label in BPS_QUARTERS:
        return period_of(f"{year_label}-Q{BPS_QUARTERS[sub_label]}", "Q")
    raise ValueError("turunan tahun tidak dikenal")


def bps_value(raw):
    """Nilai di datacontent menjadi Decimal; None bila kosong."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, bool) or not isinstance(raw, (Decimal, int, str)):
        raise FetchError("nilai tidak valid", 200)
    try:
        value = Decimal(raw)
    except InvalidOperation:
        raise FetchError("nilai tidak valid", 200) from None
    if not value.is_finite():
        raise FetchError("nilai tidak valid", 200)
    return value


def bps_single(data, name):
    """Id satu-satunya baris dimensi name; query harus menyaringnya sampai tersisa satu."""
    rows = data.get(name)
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict) \
            or "val" not in rows[0]:
        raise FetchError("dimensi berubah", 200)
    return str(rows[0]["val"])


def parse_bps(body, frequency, years=None, var=None):
    """JSON data WebAPI BPS menjadi daftar Point terurut; kosong bila tahun itu belum ada data.

    Kunci datacontent adalah gabungan id vervar, var, turvar, tahun, dan turtahun tanpa pemisah,
    misalnya "9999" "2263" "0" "126" "9" untuk September 2026. Kunci tidak dipecah, tetapi
    disusun dari setiap kombinasi label lalu dicocokkan, dan kunci yang tidak dikenal ditolak.
    years (bila diisi) adalah tahun yang diminta; tahun lain di jawaban dianggap error. var (bila
    diisi) adalah id variabel yang diminta; jawaban untuk variabel lain dianggap error.
    """
    try:
        data = json.loads(body, parse_float=Decimal)
    except ValueError:
        raise FetchError("bukan JSON", 200) from None
    if not isinstance(data, dict) or data.get("status") != "OK":
        raise FetchError("status bukan OK", 200)
    # Dimensi diperiksa sebelum jawaban kosong diterima: variabel atau baris vervar yang tidak
    # dikenal juga dijawab OK dengan datacontent kosong, tetapi dimensinya kosong. Tahun yang
    # belum ada datanya tetap punya tepat satu baris var, vervar, dan turvar.
    vervar, var_id, turvar = (bps_single(data, name) for name in ("vervar", "var", "turvar"))
    if var is not None and var_id != str(var):
        raise FetchError("dimensi berubah", 200)
    content, tahun = data.get("datacontent"), data.get("tahun")
    if content == []:  # tanpa data untuk tahun yang diminta; jawaban BPS memakai daftar kosong
        return []
    if not isinstance(content, dict) or not isinstance(tahun, list):
        raise FetchError("kolom berubah", 200)
    prefix = vervar + var_id + turvar
    codes = {}
    for year in tahun:
        for sub in data.get("turtahun") or []:
            try:
                code = prefix + str(year["val"]) + str(sub["val"])
                found = bps_period(str(year["label"]).strip(), str(sub["label"]).strip(), frequency)
            except (KeyError, TypeError):
                raise FetchError("kolom berubah", 200) from None
            except ValueError:
                raise FetchError("periode tidak valid", 200) from None
            if code in codes:
                raise FetchError("kode ganda", 200)
            if found and years and found[1].year not in years:
                raise FetchError("periode tidak valid", 200)
            codes[code] = found
    if not set(content) <= set(codes):
        raise FetchError("kode tidak dikenal", 200)
    points = {}
    for code, found in codes.items():
        value = bps_value(content.get(code))
        if found is None or value is None:
            continue
        if found[0] in points:
            raise FetchError("periode ganda", 200)
        points[found[0]] = Point(found[0], found[1], value)
    return sorted(points.values(), key=lambda point: point.start)


def fetch_bps(item, today=None):
    """Ambil setiap variabel per potongan tahun, lalu gabungkan per periode.

    Setiap variabel wajib menghasilkan data, supaya variabel yang kosong tidak diam-diam
    menghapus periodenya dari seri gabungan.
    """
    key = bps_key()
    until = (today or date.today()).year
    merged, first = {}, True
    for domain, var, since, filters in bps_items(item["query"]):
        found = 0
        for years in bps_year_chunks(since, until):
            if not first:
                time.sleep(BPS_PAUSE)
            first = False
            body = get(bps_url(domain, var, years, filters, key), {}, KEYED_OPENER, json_complete)
            points = parse_bps(body, item["frequency"], years, var)
            found += len(points)
            merged.update((p.period, p) for p in points)
        if not found:
            raise FetchError("tanpa data", 200)
    return sorted(merged.values(), key=lambda point: point.start)


# --- BPS tabel statis ------------------------------------------------------------------------

# Komponen inflasi tidak ada sebagai variabel WebAPI, hanya sebagai tabel statis 908: tabel HTML di
# dalam JSON, berisi baris per tahun (perubahan sejak Januari, y-to-d) dan per bulan (perubahan dari
# bulan sebelumnya, m-to-m). Query registri memilih satu kolom dan tahun awalnya: pola ini sekaligus
# menolak key di registri.
BPS_TABLE_ITEM = re.compile(r"domain/0000/tabel/908/kolom/(umum|inti|diatur|bergejolak)"
                            r"/sejak/(\d{4})")
BPS_TABLE_URL = "https://webapi.bps.go.id/v1/api/view/model/statictable/lang/ind/domain/0000/id/908"
BPS_TABLE_HEADER = ["Tahun/Bulan", "Umum", "Inti", "Harga-Diatur Pemerintah", "Bergejolak"]
BPS_TABLE_WIDTH = 6  # sel per baris data; kepala tabel menggabungkan kolom tahun dan bulan
BPS_TABLE_COLUMNS = {"umum": 2, "inti": 3, "diatur": 4, "bergejolak": 5}
# Selisih wajar antara rangkaian m-to-m setahun dan baris y-to-d-nya: 12 angka yang dibulatkan ke 2
# desimal bisa menyimpang sampai sekitar 0,07. Baris Maret 2022 di tabel ini keliru (umum tertulis
# 0,08, rilis BPS 0,66), dan membuat rangkaian 2022 menyimpang 0,59.
BPS_YTD_TOLERANCE = Decimal("0.1")


class TableCells(HTMLParser):
    """Kumpulkan teks setiap sel td per baris tr; gaya dan atribut tabel diabaikan."""

    def __init__(self):
        super().__init__()
        self.rows, self.cell = [], None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.rows.append([])
        elif tag == "td" and self.rows:
            self.cell = []
            self.rows[-1].append(self.cell)

    def handle_endtag(self, tag):
        if tag == "td":
            self.cell = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def table(self):
        return [[" ".join("".join(cell).split()) for cell in row] for row in self.rows]


def compound(changes):
    """Perubahan total (persen) dari perubahan berurutan (persen), lewat perkalian berantai."""
    factor = Decimal(1)
    for change in changes:
        factor *= 1 + change / 100
    return (factor - 1) * 100


def bps_table_value(text):
    """Sel angka tabel 908: koma atau titik desimal, "~ 0" berarti mendekati nol, kosong None."""
    if not text:
        return None
    if text.replace(" ", "") == "~0":
        return Decimal(0)
    if not re.fullmatch(r"-?\d+[,.]\d+", text):
        raise FetchError("nilai tidak valid", 200)
    return Decimal(text.replace(",", "."))


def parse_bps_table(body, column, since):
    """JSON tabel statis 908 menjadi daftar Point bulanan satu kolom, sejak tahun since.

    Baris sebelum since hanya diperiksa bentuknya. Setiap tahun yang dipakai diperiksa: bulannya
    harus berurutan sejak Januari (lengkap 12 kecuali tahun terakhir), dan rangkaiannya harus cocok
    dengan baris y-to-d, supaya salah ketik di satu sel tidak merusak y-on-y setahun penuh.
    """
    try:
        data = json.loads(body)
    except ValueError:
        raise FetchError("bukan JSON", 200) from None
    if not isinstance(data, dict) or data.get("status") != "OK":
        raise FetchError("status bukan OK", 200)
    table = data.get("data")
    if not isinstance(table, dict) or not isinstance(table.get("table"), str):
        raise FetchError("kolom berubah", 200)
    parser = TableCells()
    parser.feed(table["table"])
    rows = parser.table()
    if BPS_TABLE_HEADER not in rows:
        raise FetchError("kolom berubah", 200)
    index = BPS_TABLE_COLUMNS[column]
    months, year_to_date, year = {}, {}, None
    for row in rows[rows.index(BPS_TABLE_HEADER) + 1:]:
        if not any(row):
            continue
        if len(row) != BPS_TABLE_WIDTH:
            raise FetchError("kolom berubah", 200)
        if re.fullmatch(r"\d{4}", row[0]) and not row[1]:
            year = int(row[0])
            if year in months:
                raise FetchError("periode ganda", 200)
            if year >= since:
                months[year], year_to_date[year] = {}, bps_table_value(row[index])
        elif row[0] or row[1] not in BPS_MONTHS or year is None:
            raise FetchError("periode tidak valid", 200)
        elif year >= since:
            month, value = BPS_MONTHS[row[1]], bps_table_value(row[index])
            if month in months[year]:
                raise FetchError("periode ganda", 200)
            if value is not None:
                months[year][month] = value
    if not any(months.values()):
        raise FetchError("tanpa data", 200)
    points = []
    for year, values in months.items():
        expected = len(values) if year == max(months) else 12
        if sorted(values) != list(range(1, expected + 1)):
            raise FetchError("bulan tidak lengkap", 200)
        ordered = [values[month] for month in sorted(values)]
        target = year_to_date[year]
        if ordered and target is not None and abs(compound(ordered) - target) > BPS_YTD_TOLERANCE:
            raise FetchError("y-to-d tidak cocok", 200)
        points += [Point(*period_of(f"{year}-{month:02d}", "M"), values[month])
                   for month in sorted(values)]
    return sorted(points, key=lambda point: point.start)


@functools.lru_cache(maxsize=1)
def bps_table_body():
    """Satu tabel melayani beberapa seri, jadi jawabannya disimpan selama proses."""
    return get(f"{BPS_TABLE_URL}/key/{bps_key()}/", {}, KEYED_OPENER, json_complete)


def fetch_series(item):
    if item["source"] == "bps":
        table = BPS_TABLE_ITEM.fullmatch(item["query"])
        if table:
            return parse_bps_table(bps_table_body(), table[1], int(table[2]))
        return fetch_bps(item)
    base, headers = BASES[item["source"]]
    return parse(get(base + item["query"], headers), item["frequency"],
                 item.get("actual_only", False))


def data_hash(points):
    """Hash data ternormalisasi (periode dan nilai), bukan hash berkas mentah."""
    text = "".join(f"{p.period}={format(p.value.normalize(), 'f')}\n" for p in points)
    return hashlib.sha256(text.encode()).hexdigest()
