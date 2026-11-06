#!/usr/bin/env python3
"""
Convert the DoR "SNH links 2025/26" shapefiles into the project's per-highway
GeoJSON files (public/data/highway/NHxx_*.geojson) and the highway index.

Inputs (UTM 44N, EPSG:32644), from the Department of Roads shapefile bundle:
  snh_links_2025_26_44N_V2.shp      one line per link            -> the geometry
  snh_pavement_2025_26_V2_44N.shp   links split by pavement type -> pave_type / pave_mix
  provisional_nh_44N.shp            provisional links            -> provisional-nh.geojson (not routed)

Usage:
  pip install pyshp pyproj
  python3 scripts/snh-extraction/shp_to_geojson.py <shapefile-dir>

Then rebuild the derived files:
  npx tsx scripts/generate-derived-data.ts   # highway/index.json from all-highways-79.json
  node scripts/build-road-graph.cjs          # public/data/road-graph.json
"""
import collections
import json
import os
import re
import sys

import shapefile
from pyproj import Transformer

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'public', 'data', 'highway')
ALL79 = os.path.join(ROOT, 'public', 'data', 'all-highways-79.json')
PROVISIONAL_OUT = os.path.join(ROOT, 'public', 'data', 'provisional-nh.geojson')

TO_WGS84 = Transformer.from_crs(32644, 4326, always_xy=True)
# DoR spells these differently from the rest of the app's catalogue.
DISTRICT_ALIASES = {'Dhanusa': 'Dhanusha'}
KEEP = [
    'id', 'road_class', 'road_refno', 'road_name', 'link_code', 'link_name', 'link_ori',
    'link_des', 'link_from', 'link_to', 'link_len', 'div_name', 'dist_name', 'dyear',
    'old_link', 'shp_len',
]


def read(path):
    r = shapefile.Reader(path)
    names = [f[0] for f in r.fields[1:]]
    return [(dict(zip(names, sr.record)), sr.shape) for sr in r.shapeRecords()]


def clean(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    if isinstance(v, float):
        return round(v, 3)
    return v


def to_multiline(shape):
    pts = shape.points
    parts = list(shape.parts) + [len(pts)]
    lines = []
    for a, b in zip(parts[:-1], parts[1:]):
        seg = [[round(x, 6), round(y, 6)] for x, y in (TO_WGS84.transform(px, py) for px, py in pts[a:b])]
        dedup = [p for i, p in enumerate(seg) if i == 0 or p != seg[i - 1]]
        if len(dedup) >= 2:
            lines.append(dedup)
    return {'type': 'MultiLineString', 'coordinates': lines}


def link_sort_key(code):
    m = re.match(r'NH(\d+)-(\d+)', code or '')
    return (int(m.group(1)), int(m.group(2))) if m else (9999, 0)


def update_catalogue(all79, summary, pave):
    """Refresh the survey-derived fields of all-highways-79.json (the source for highway/index.json).

    Hand-curated fields (names, descriptions, segments, tolls, ...) are left alone.
    segmentLinks gets one entry per pavement segment so the directory's BT/GR/ER/UC/PL
    badges add up to the real surveyed length.
    """
    segs = collections.defaultdict(list)
    for a, _ in pave:
        segs[a['road_refno']].append(a)
    for h in all79:
        sm = summary[h['code']]
        (s0, w0), (s1, w1) = sm['bounds']
        h['districts'] = sm['districts']
        h['featureCount'] = sm['featureCount']
        h['totalLengthKm'] = round(sm['lengthKm'])
        h['bounds'] = sm['bounds']
        h['center'] = [round((s0 + s1) / 2, 6), round((w0 + w1) / 2, 6)]
        rows = sorted(segs[h['code']], key=lambda a: (link_sort_key(a['link_code']), a['link_from'] or 0))
        h['segmentLinks'] = [{
            'fid': i,
            'linkCode': a['link_code'],
            'linkName': clean(a['link_name']),
            'roadRefNo': a['road_refno'],
            'roadName': clean(a['road_name']),
            'linkFrom': clean(a['link_from']),
            'linkTo': clean(a['link_to']),
            'linkLenKm': round(a['shp_len'] or 0, 3),
            'divName': clean(a['div_name']),
            'distName': DISTRICT_ALIASES.get(a['dist_name'], clean(a['dist_name'])),
            'paveType': a['pave_type'],
            'dyear': a['dyear'],
        } for i, a in enumerate(rows, 1)]
    with open(ALL79, 'w', encoding='utf-8') as f:
        json.dump(all79, f, ensure_ascii=False, separators=(',', ':'))


def main(src):
    links = read(os.path.join(src, 'snh_links_2025_26_44N_V2'))
    pave = read(os.path.join(src, 'snh_pavement_2025_26_V2_44N'))
    prov = read(os.path.join(src, 'provisional_nh_44N'))

    mix = collections.defaultdict(lambda: collections.defaultdict(float))
    for a, _ in pave:
        mix[a['link_code']][a['pave_type'] or 'NA'] += a['shp_len'] or 0

    all79 = json.load(open(ALL79, encoding='utf-8'))
    file_by_code = {h['code']: h['file'] for h in all79}

    by_code = collections.defaultdict(list)
    for a, shp in links:
        by_code[a['road_refno']].append((a, shp))

    missing = sorted(set(file_by_code) - set(by_code))
    extra = sorted(set(by_code) - set(file_by_code))
    if missing or extra:
        raise SystemExit(f'highway set mismatch: missing={missing} extra={extra}')

    summary = {}
    for code, items in sorted(by_code.items()):
        items.sort(key=lambda it: link_sort_key(it[0]['link_code']))
        feats = []
        for i, (a, shp) in enumerate(items, 1):
            props = {'fid': i}
            props.update({k: clean(a.get(k)) for k in KEEP})
            m = mix.get(a['link_code'])
            if m:
                total = sum(m.values()) or 1
                props['pave_type'] = max(m, key=m.get)
                props['pave_mix'] = {k: round(v, 3) for k, v in sorted(m.items(), key=lambda kv: -kv[1])}
            else:
                props['pave_type'] = None
            feats.append({'type': 'Feature', 'properties': props, 'geometry': to_multiline(shp)})
        with open(os.path.join(OUT_DIR, file_by_code[code]), 'w', encoding='utf-8') as f:
            json.dump({'type': 'FeatureCollection', 'features': feats}, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
        districts = []
        for a, _ in items:
            d = DISTRICT_ALIASES.get(a['dist_name'], a['dist_name'])
            if d and d not in districts:
                districts.append(d)
        lons = [c[0] for ft in feats for ln in ft['geometry']['coordinates'] for c in ln]
        lats = [c[1] for ft in feats for ln in ft['geometry']['coordinates'] for c in ln]
        summary[code] = {
            'featureCount': len(feats),
            'lengthKm': round(sum(a['shp_len'] or 0 for a, _ in items), 1),
            'districts': districts,
            'bounds': [[round(min(lats), 5), round(min(lons), 5)], [round(max(lats), 5), round(max(lons), 5)]],
        }

    # Provisional links: kept out of the routed network, exported on their own.
    pfeats = []
    for i, (a, shp) in enumerate(prov, 1):
        props = {'fid': i, 'status': 'provisional'}
        props.update({k: clean(a.get(k)) for k in KEEP})
        props['link_len'] = props['link_len'] or props['shp_len']
        pfeats.append({'type': 'Feature', 'properties': props, 'geometry': to_multiline(shp)})
    with open(PROVISIONAL_OUT, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': pfeats}, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')

    update_catalogue(all79, summary, pave)
    print(f'{len(summary)} highways, {sum(s["featureCount"] for s in summary.values())} links, '
          f'{round(sum(s["lengthKm"] for s in summary.values()))} km, {len(pfeats)} provisional links')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'shapefiles'))
