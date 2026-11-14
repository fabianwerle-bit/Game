#!/usr/bin/env python3
"""Lädt die CC0-Assets (Poly Haven) nach web/public/assets. Aufruf: python3 tools/fetch_assets.py"""
import json, os, sys, urllib.request, concurrent.futures as cf
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'web', 'public', 'assets')
API = 'https://api.polyhaven.com/files/'
UA = {'User-Agent': 'asset-fetch/1.0'}
TEXTURES = {  # name: maps
    'leafy_grass': ['Diffuse', 'nor_gl'], 'forest_ground_04': ['Diffuse', 'nor_gl'],
    'coast_sand_01': ['Diffuse', 'nor_gl'], 'mossy_rock': ['Diffuse', 'nor_gl'],
    'asphalt_02': ['Diffuse', 'nor_gl'], 'concrete_floor_worn_001': ['Diffuse', 'nor_gl'],
    'white_plaster_rough_01': ['Diffuse', 'nor_gl'], 'corrugated_iron_02': ['Diffuse', 'nor_gl'],
    'weathered_planks': ['Diffuse', 'nor_gl'], 'wood_planks_grey': ['Diffuse', 'nor_gl'],
    'rusty_metal_shutter': ['Diffuse', 'nor_gl'], 'grey_roof_tiles': ['Diffuse', 'nor_gl'],
    'rusty_painted_metal': ['Diffuse', 'nor_gl'], 'red_brick': ['Diffuse', 'nor_gl'],
    'brown_mud_leaves_01': ['Diffuse', 'nor_gl'], 'floor_tiles_06': ['Diffuse'],
}
MODELS = ['russian_food_cans_01', 'long_life_food', 'metal_jerrycan_green', 'Barrel_01', 'old_tyre',
          'rock_07', 'rock_09', 'stone_fire_pit', 'street_lamp_02', 'food_apple_01', 'covered_car',
          'metal_trash_can', 'propane_tank', 'steel_frame_shelves_01', 'plastic_crate_03',
          'cardboard_box_01', 'lifebuoy', 'vintage_oil_lamp', 'utility_box_01', 'tree_stump_01']
HDRIS = {'kloofendal_overcast_puresky': '2k'}
EXTRA = {  # Rinde für die Bäume
    'trees/bark_diff.jpg': 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/fir_tree_01/fir_tree_01_bark_diff_1k.jpg',
    'trees/bark_nor.jpg': 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/fir_tree_01/fir_tree_01_bark_nor_gl_1k.jpg',
}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
def save(rel, url):
    p = os.path.join(ROOT, rel)
    if os.path.exists(p) and os.path.getsize(p) > 0: return
    os.makedirs(os.path.dirname(p), exist_ok=True)
    for i in range(4):
        try:
            d = get(url); open(p, 'wb').write(d); print('ok', rel, len(d) // 1024, 'KB'); return
        except Exception as e: err = e
    print('FAIL', rel, err); 
jobs = []
for name, maps in TEXTURES.items():
    f = json.loads(get(API + name))
    for m in maps:
        key = m if m in f else {'Diffuse': 'diff'}.get(m, m)
        jobs.append((f'tex/{name}_{"diff" if m == "Diffuse" else "nor"}.jpg', f[key]['1k']['jpg']['url']))
for name in MODELS:
    f = json.loads(get(API + name))['gltf']['1k']['gltf']
    jobs.append((f'models/{name}/{name}.gltf', f['url']))
    for rel, inc in f['include'].items(): jobs.append((f'models/{name}/{rel}', inc['url']))
for name, res in HDRIS.items():
    f = json.loads(get(API + name))
    jobs.append((f'sky/{name}.hdr', f['hdri'][res]['hdr']['url']))
jobs += list(EXTRA.items())
with cf.ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: save(*j), jobs))
