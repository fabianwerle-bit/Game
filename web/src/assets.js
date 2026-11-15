import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const A = 'assets/';
const TEX = ['leafy_grass', 'forest_ground_04', 'coast_sand_01', 'mossy_rock', 'asphalt_02', 'concrete_floor_worn_001',
  'white_plaster_rough_01', 'corrugated_iron_02', 'weathered_planks', 'wood_planks_grey', 'rusty_metal_shutter',
  'grey_roof_tiles', 'rusty_painted_metal', 'red_brick', 'brown_mud_leaves_01'];
const MODELS = ['russian_food_cans_01', 'long_life_food', 'metal_jerrycan_green', 'Barrel_01', 'old_tyre', 'rock_07', 'rock_09',
  'stone_fire_pit', 'street_lamp_02', 'food_apple_01', 'covered_car', 'metal_trash_can', 'propane_tank',
  'steel_frame_shelves_01', 'plastic_crate_03', 'cardboard_box_01', 'lifebuoy', 'vintage_oil_lamp', 'utility_box_01', 'tree_stump_01',
  'service_pistol', 'ammo_box', 'vintage_day_bed', 'GothicBed_01', 'Sofa_01', 'WoodenTable_01', 'painted_wooden_chair_01',
  'painted_wooden_cabinet', 'wooden_bookshelf_worn', 'electric_stove', 'vintage_radio_transceiver', 'hanging_picture_frame_01',
  'ornate_mirror_01', 'ocean_buoy', 'wooden_crate_01', 'old_military_crate', 'painted_wooden_bench', 'ArmChair_01', 'barrel_stove',
  'wooden_axe', 'throw_pillows_01', 'vintage_electric_kettle', 'wheelchair_01', 'street_lamp_01', 'wooden_picnic_table', 'dining_table',
  'SchoolDesk_01', 'SchoolChair_01', 'dutch_ship_medium', 'portable_cassette_player', 'boombox', 'korean_public_payphone_01', 'modular_urban_apartments_facade'];

export async function loadAssets(renderer, onProgress) {
  const mgr = new THREE.LoadingManager();
  mgr.onProgress = (_u, n, t) => onProgress(n / t);
  const tl = new THREE.TextureLoader(mgr), gl = new GLTFLoader(mgr), hl = new RGBELoader(mgr);
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const tex = (url, srgb) => {
    const t = tl.load(A + url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const T = {};
  for (const n of TEX) T[n] = { d: tex(`tex/${n}_diff.jpg`, true), n: tex(`tex/${n}_nor.jpg`, false) };
  T.tiles = { d: tex('tex/floor_tiles_06_diff.jpg', true) };
  T.bark = { d: tex('trees/bark_diff.jpg', true), n: tex('trees/bark_nor.jpg', false) };
  T.grass = tex('trees/grass.png', true); T.whorl = tex('trees/whorl.png', true); T.firSide = tex('trees/fir_side.png', true); T.fern = tex('trees/fern.png', true);
  const M = {};
  const jobs = MODELS.map(n => new Promise((res, rej) => gl.load(`${A}models/${n}/${n}.gltf`, g => { M[n] = g.scene; res(); }, undefined, rej)));
  let sky;
  jobs.push(new Promise((res, rej) => hl.load(A + 'sky/kloofendal_overcast_puresky.hdr', t => { sky = t; res(); }, undefined, rej)));
  await Promise.all(jobs);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromEquirectangular(sky).texture; pm.dispose();
  // Pistolen-Scan enthält Einzelteile und eine zweite Variante – nur die zusammengebaute Waffe behalten
  { const rm = []; M.service_pistol.traverse(o => { if (o.isMesh && !/_a$/.test(o.name)) rm.push(o); }); rm.forEach(o => o.parent.remove(o)); }
  for (const k in M) M[k].traverse(o => { if (o.isMesh && o.material.map) o.material.map.anisotropy = aniso; });
  return { T, M, sky, env };
}
