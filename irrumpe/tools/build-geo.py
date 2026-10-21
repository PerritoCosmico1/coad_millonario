#!/usr/bin/env python3
"""Genera js/concepcion-geo.js a partir de datos de OpenStreetMap.

Descarga los paquetes npm @geo-maps/earth-lands-10m y @geo-maps/earth-waterbodies-10m
(GeoJSON mundial derivado de OSM, licencia ODbL), recorta ambos a un rectángulo
alrededor del Gran Concepción y escribe el resultado como un script plano que
define window.IRRUMPE_GEO. Solo hace falta correrlo si se quiere cambiar el
encuadre o regenerar los datos:

    python3 irrumpe/tools/build-geo.py

Usa solo la librería estándar de Python.
"""
import io, json, os, sys, tarfile, urllib.request

# Oeste, Sur, Este, Norte. Bastante más grande que la zona visible para que,
# en pantallas anchas, el borde del mapa nunca se vea como "mar".
BBOX = (-73.40, -37.10, -72.70, -36.55)
PACKAGES = {
    'land': 'earth-lands-10m',
    'water': 'earth-waterbodies-10m',
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'concepcion-geo.js')


def fetch_geojson(pkg):
    url = 'https://registry.npmjs.org/@geo-maps/%s/-/%s-0.6.0.tgz' % (pkg, pkg)
    print('descargando', url, file=sys.stderr)
    with urllib.request.urlopen(url) as res:
        blob = res.read()
    with tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz') as tar:
        return json.load(tar.extractfile('package/map.geo.json'))


def clip_ring(ring):
    """Sutherland–Hodgman contra el BBOX (sirve para polígonos cóncavos)."""
    W, S, E, N = BBOX

    def clip(pts, inside, inter):
        out = []
        if not pts:
            return out
        prev = pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out

    def at_x(x):
        return lambda a, b: [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])]

    def at_y(y):
        return lambda a, b: [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y]

    pts = ring[:-1] if ring[0] == ring[-1] else ring
    pts = clip(pts, lambda p: p[0] >= W, at_x(W))
    pts = clip(pts, lambda p: p[0] <= E, at_x(E))
    pts = clip(pts, lambda p: p[1] >= S, at_y(S))
    pts = clip(pts, lambda p: p[1] <= N, at_y(N))
    return pts


def polygons(geom):
    if geom['type'] == 'Polygon':
        yield geom['coordinates']
    elif geom['type'] == 'MultiPolygon':
        yield from geom['coordinates']
    elif geom['type'] == 'GeometryCollection':
        for g in geom['geometries']:
            yield from polygons(g)


def rings_in_bbox(fc):
    W, S, E, N = BBOX
    feats = fc['features'] if fc.get('type') == 'FeatureCollection' else [fc]
    rings = []
    for f in feats:
        for poly in polygons(f.get('geometry', f)):
            xs = [p[0] for p in poly[0]]
            ys = [p[1] for p in poly[0]]
            if max(xs) < W or min(xs) > E or max(ys) < S or min(ys) > N:
                continue
            for ring in poly:
                pts = clip_ring(ring)
                if len(pts) >= 3:
                    # Plano y con 4 decimales (~10 m): [lng, lat, lng, lat, ...]
                    rings.append([round(v, 4) for p in pts for v in p])
    return rings


def main():
    data = {'bbox': list(BBOX)}
    for key, pkg in PACKAGES.items():
        data[key] = rings_in_bbox(fetch_geojson(pkg))
        print(key, len(data[key]), 'anillos', file=sys.stderr)
    with open(OUT, 'w') as fh:
        fh.write('/* Generado por tools/build-geo.py — no editar a mano.\n'
                 ' * Costa y cuerpos de agua del Gran Concepción.\n'
                 ' * Datos © colaboradores de OpenStreetMap (ODbL), vía @geo-maps. */\n')
        fh.write('window.IRRUMPE_GEO = ')
        json.dump(data, fh, separators=(',', ':'))
        fh.write(';\n')
    print('escrito', os.path.normpath(OUT), file=sys.stderr)


if __name__ == '__main__':
    main()
