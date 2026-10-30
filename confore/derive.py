"""Seri turunan, dihitung di memori dari observasi terbaru dan tidak disimpan di etl."""

from decimal import Decimal

from confore.fetch import Point

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


FUNCTIONS = {"yoy": yoy, "ratio": ratio}


def derive_all(items, data):
    """Tambahkan seri turunan ke data (id seri -> daftar Point), mengikuti urutan registri."""
    for item in items:
        if "derive" in item:
            data[item["id"]] = FUNCTIONS[item["derive"]](*(data.get(name, []) for name in item["inputs"]))
    return data
