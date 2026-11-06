"""Pembanding wajib: sama dengan angka terakhir, dan AR(1) pada angka y-on-y."""

import numpy as np

MIN_PAIRS = 8


def last_value(values, refs):
    """Setiap periode ke depan sama dengan angka terakhir yang sudah terbit."""
    last = float(values.iloc[-1])
    return {ref: last for ref in refs}


def ar1(values, refs, window=None, skip=()):
    """AR(1) iteratif. Pasangan yang menyentuh periode skip tidak ikut diestimasi.

    Tanpa cukup pasangan, hasilnya sama dengan angka terakhir.
    """
    sample = values.iloc[-window:] if window else values
    pairs = [(sample.iloc[i - 1], sample.iloc[i]) for i in range(1, len(sample))
             if sample.index[i] not in skip and sample.index[i - 1] not in skip]
    if len(pairs) < MIN_PAIRS:
        return last_value(values, refs)
    before, after = np.array(pairs).T
    slope = float(np.clip(np.polyfit(before, after, 1)[0], -0.99, 0.99))
    level = float(after.mean() - slope * before.mean())
    out, current = {}, float(values.iloc[-1])
    for ref in refs:
        current = level + slope * current
        out[ref] = current
    return out
