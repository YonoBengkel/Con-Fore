"""Segarkan situs sesudah publikasi (ARCHITECTURE 4.10).

POST /api/revalidate menandai semua halaman yang membaca Supabase sebagai basi. Satu GET per alamat
lalu memicu render baru di latar, supaya pengunjung pertama sudah mendapat angka baru, bukan halaman
lama. Error hanya berupa kode tetap; rahasia tidak pernah dicetak dan tidak ikut pengalihan alamat.
"""

import os
import time
from typing import NamedTuple

from confore import fetch

PAUSE = 1.0  # jeda antaralamat, supaya render di latar tidak menumpuk


class Result(NamedTuple):
    warmed: int
    missing: int  # 404: seri baru yang belum punya halaman sampai build web berikutnya
    stopped: str | None  # kode error yang menghentikan pemanasan


def paths(series_ids):
    return ["/", "/prediksi", "/sumber",
            *(f"/indikator/{series_id}" for series_id in series_ids),
            *(f"/api/csv/{series_id}" for series_id in series_ids)]


def refresh(series_ids):
    """None bila SITE_URL atau REVALIDATE_SECRET kosong; FetchError bila POST gagal.

    Pemanasan yang gagal tidak melempar error: halaman sudah ditandai basi, jadi pengunjung
    berikutnya tetap memicu render baru.
    """
    base = os.environ.get("SITE_URL", "").strip().rstrip("/")
    secret = os.environ.get("REVALIDATE_SECRET", "").strip()
    if not base or not secret:
        return None
    if not base.startswith("https://"):
        raise fetch.FetchError("SITE_URL harus diawali https://")
    fetch.get(f"{base}/api/revalidate", {"x-revalidate-secret": secret},
              opener=fetch.KEYED_OPENER, complete=fetch.json_complete, data=b"")
    warmed = missing = 0
    for path in paths(series_ids):
        time.sleep(PAUSE)
        try:
            fetch.get(base + path, {}, complete=lambda body: True)
        except fetch.FetchError as error:
            if error.http_status != 404:
                return Result(warmed, missing, error.code)
            missing += 1
        else:
            warmed += 1
    return Result(warmed, missing, None)
