"""Seri turunan, dihitung di memori dari observasi terbaru dan tidak disimpan di etl."""

from decimal import Decimal

from confore.fetch import Point, compound

STEP = Decimal("0.0001")


def latest_seen(*points):
    dates = [p.seen for p in points if p.seen]
    return max(dates) if dates else None


def yoy(points):
    """Perubahan persen dibanding periode yang sama tahun sebelumnya."""
    by_start = {p.start: p for p in points}
    out = []
    for p in points:
        try:
            before = by_start.get(p.start.replace(year=p.start.year - 1))
        except ValueError:  # 29 Februari
            before = None
        if before is None or not before.value:
            continue
        value = ((p.value / before.value - 1) * 100).quantize(STEP)
        out.append(Point(p.period, p.start, value, seen=latest_seen(p, before)))
    return out


def ratio(top, bottom):
    """Pembagian dua seri pada periode yang sama, misalnya kurs silang."""
    below = {p.period: p for p in bottom}
    out = []
    for p in top:
        other = below.get(p.period)
        if other is None or not other.value:
            continue
        out.append(Point(p.period, p.start, (p.value / other.value).quantize(STEP),
                         seen=latest_seen(p, other)))
    return out


def share(first, second, total):
    """Porsi dua seri terhadap total pada periode yang sama, dalam persen."""
    others, totals = {p.period: p for p in second}, {p.period: p for p in total}
    out = []
    for p in first:
        other, whole = others.get(p.period), totals.get(p.period)
        if other is None or whole is None or not whole.value:
            continue
        value = ((p.value + other.value) / whole.value * 100).quantize(STEP)
        out.append(Point(p.period, p.start, value, seen=latest_seen(p, other, whole)))
    return out


def chain(points):
    """Perubahan 12 bulan (persen) yang dirangkai dari perubahan bulanan (persen).

    Hanya untuk 12 bulan yang berurutan. Karena perubahan bulanan sudah dibulatkan, hasilnya bisa
    sedikit berbeda dari y-on-y yang dirilis sumber.
    """
    out = []
    for i in range(11, len(points)):
        window = points[i - 11:i + 1]
        first, last = window[0].start, window[-1].start
        if (last.year - first.year) * 12 + last.month - first.month != 11:
            continue
        value = compound(p.value for p in window).quantize(STEP)
        out.append(Point(window[-1].period, last, value, seen=latest_seen(*window)))
    return out


FUNCTIONS = {"yoy": yoy, "ratio": ratio, "share": share, "chain": chain}


def derive_all(items, data):
    """Tambahkan seri turunan ke data (id seri -> daftar Point), mengikuti urutan registri."""
    for item in items:
        if "derive" in item:
            data[item["id"]] = FUNCTIONS[item["derive"]](*(data.get(name, []) for name in item["inputs"]))
    return data
