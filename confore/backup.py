"""Backup mingguan dan pemulihan tabel yang tidak bisa dibangun ulang (ARCHITECTURE 4.13).

Satu arsip tar.gz: satu CSV per tabel dari satu snapshot, manifest berisi jumlah baris dan hash, dan
kalimat atribusi tiap sumber, karena arsipnya terbit sebagai aset rilis di repo publik. Arsip tidak
pernah diekstrak ke disk. Pemulihan hanya menerima tabel kosong, jadi tidak bisa menimpa data.
"""

import hashlib
import io
import json
import tarfile
import time
import zlib

from confore.db import Stop

# Urutan mengikuti foreign key. Kalender dan log run tidak ikut: kalender dibangun ulang dari config/,
# dan log run hanya riwayat operasional. Sumber dan seri ikut, karena seri yang sudah dihapus dari
# registri tetap dirujuk observasi lamanya.
TABLES = ("sources", "series", "observations", "targets", "forecasts", "backtest")
MANIFEST = "manifest.json"
README = "BACA-SAYA.txt"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def readme(sources):
    lines = ["Cadangan data Con-Fore. Bukan data resmi lembaga mana pun.",
             "Angka di dalamnya tetap tunduk pada syarat tiap sumber. Bila disebarkan ulang, sertakan atribusinya:",
             ""]
    lines += [f"- {name}: {attribution} Syarat: {terms}" for name, attribution, terms in sources]
    return ("\n".join(lines) + "\n").encode("utf-8")


def export(conn, path, git_sha=None):
    """Tulis arsip dari satu snapshot, tanpa kunci, karena hanya membaca. Kembalikan baris per tabel."""
    files, tables = {}, {}
    with conn.transaction(), conn.cursor() as cur:
        cur.execute("set transaction isolation level repeatable read, read only")
        for table in TABLES:
            content = bytearray()
            with cur.copy(f"copy etl.{table} to stdout (format csv, header)") as copy:
                for chunk in copy:
                    content += chunk
            files[f"{table}.csv"] = bytes(content)
            rows = cur.execute(f"select count(*) from etl.{table}").fetchone()[0]
            tables[table] = {"rows": rows, "sha256": digest(content)}
        migrations = [row[0] for row in cur.execute("select version from etl.schema_migrations order by 1")]
        sources = cur.execute("""select name, attribution_text, terms_url
                                 from etl.sources order by source_id""").fetchall()
    if not tables["observations"]["rows"]:
        raise Stop("etl.observations kosong, jadi arsip tidak dibuat")
    files[README] = readme(sources)
    files[MANIFEST] = json.dumps({"created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                                  "git_sha": git_sha, "migrations": migrations, "tables": tables},
                                 indent=1).encode("utf-8")
    with tarfile.open(path, "w:gz") as tar:
        for name, content in files.items():
            info = tarfile.TarInfo(name)
            info.size, info.mtime = len(content), int(time.time())
            tar.addfile(info, io.BytesIO(content))
    return {table: tables[table]["rows"] for table in TABLES}


def read_archive(path):
    """Manifest dan isi CSV, sesudah hash setiap tabel cocok."""
    try:
        with tarfile.open(path, "r:gz") as tar:
            files = {m.name: tar.extractfile(m).read() for m in tar.getmembers() if m.isfile()}
        tables = json.loads(files[MANIFEST])["tables"]
        for table in TABLES:
            if digest(files[f"{table}.csv"]) != tables[table]["sha256"]:
                raise Stop(f"arsip rusak: hash {table} tidak cocok")
    except (tarfile.TarError, OSError, EOFError, KeyError, ValueError, TypeError, zlib.error) as error:
        raise Stop(f"arsip tidak bisa dibaca: {type(error).__name__}") from None
    return tables, files


def restore(conn, path):
    """Isi tabel kosong dari arsip dalam satu transaksi, jadi gagal berarti tidak ada yang berubah."""
    tables, files = read_archive(path)
    if conn.execute("select to_regclass('etl.observations')").fetchone()[0] is None:
        raise Stop("tabel etl belum ada; jalankan python -m confore migrate dulu")
    counts = {}
    with conn.transaction(), conn.cursor() as cur:
        for table in TABLES:
            if cur.execute(f"select exists (select 1 from etl.{table})").fetchone()[0]:
                raise Stop(f"etl.{table} sudah berisi; pemulihan hanya untuk database baru")
            # header match: kolom arsip harus sama dengan skema sekarang.
            with cur.copy(f"copy etl.{table} from stdin (format csv, header match)") as copy:
                copy.write(files[f"{table}.csv"])
            counts[table] = cur.execute(f"select count(*) from etl.{table}").fetchone()[0]
            if counts[table] != tables[table]["rows"]:
                raise Stop(f"arsip rusak: jumlah baris {table} tidak cocok")
    return counts
