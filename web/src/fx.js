import * as THREE from 'three';
import { SIZE, N } from './world.js';

// ---------- Horrorfilter: Szene -> Rendertarget -> ein Vollbild-Pass ----------
export function createPost(renderer) {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true });
  const u = { tD: { value: rt.texture }, uTime: { value: 0 }, uHorror: { value: 0.4 }, uPulse: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uDark: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tD; uniform float uTime, uHorror, uPulse, uDark; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main(){
        vec2 c = vUv - 0.5; float r2 = dot(c, c);
        vec2 uv = vUv + c * r2 * (0.035 + uPulse * 0.1);                       // leichte Tonnenverzerrung
        float ca = (0.0012 + 0.004 * uHorror + uPulse * 0.02) * (0.2 + r2 * 3.0);  // Farbsäume am Rand
        vec3 col = vec3(texture2D(tD, uv + c * ca).r, texture2D(tD, uv).g, texture2D(tD, uv - c * ca).b);
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(l), 0.08 + 0.45 * uHorror);                          // entsättigen
        col *= mix(vec3(1.0), vec3(0.86, 1.0, 0.95), 0.55 * uHorror);            // kalter, grünlicher Stich
        col = mix(col, col * vec3(1.25, 0.72, 0.7), uPulse);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        float g = hash(vUv * uRes + fract(uTime) * 91.7) - 0.5;
        gl_FragColor.rgb += g * (0.035 + 0.08 * uHorror) * (1.0 - 0.5 * dot(gl_FragColor.rgb, vec3(0.33)));   // Filmkorn
        gl_FragColor.rgb *= 1.0 - smoothstep(0.12, 0.62, r2) * (0.4 + 0.45 * uHorror);                       // Vignette
        gl_FragColor.rgb *= 1.0 - 0.03 * sin(vUv.y * uRes.y * 1.6) * uHorror;                                // feine Zeilen
        gl_FragColor.rgb *= 1.0 - uDark;
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    u,
    setSize(w, h, pr) { rt.setSize(Math.max(2, Math.floor(w * pr)), Math.max(2, Math.floor(h * pr))); u.uRes.value.set(w * pr, h * pr); },
    render(scene, camera) { renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(qs, qc); },
  };
}

// ---------- Gras: folgt der Kamera, Höhe aus Textur im Vertex-Shader ----------
export function createGrass(assets, world, scene, count = 9000) {
  const L = 64, P = [], U = [], B = [], I = [];
  for (let i = 0; i < count; i++) {
    const bx = Math.random() * L, bz = Math.random() * L, seed = Math.random(), a = seed * 6.283, w = 0.75;
    for (let q = 0; q < 2; q++) {
      const ca = Math.cos(a + q * 1.57), sa = Math.sin(a + q * 1.57), b = P.length / 3;
      for (const [x, y] of [[-w, 0], [w, 0], [w, 0.62], [-w, 0.62]]) { P.push(x * ca, y, x * sa); U.push(x < 0 ? 0 : 1, y > 0 ? 1 : 0); B.push(bx, bz, seed); }
      I.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aBase', new THREE.Float32BufferAttribute(B, 3)); g.setIndex(I);
  const nn = new Float32Array(P.length); for (let i = 1; i < nn.length; i += 3) nn[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  assets.T.grass.wrapS = assets.T.grass.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.MeshLambertMaterial({ map: assets.T.grass, alphaTest: 0.35, side: THREE.DoubleSide, color: new THREE.Color(2.5, 2.8, 1.9) });
  const u = { uH: { value: world.heightTex }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uWind: { value: 0.3 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 aBase;\nuniform sampler2D uH; uniform vec3 uCam; uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec2 wp = mod(aBase.xy - uCam.xz, ${L.toFixed(1)}) - ${(L / 2).toFixed(1)} + uCam.xz;
      vec4 hd = texture2D(uH, (wp / ${SIZE.toFixed(1)} + 0.5) * ${((N - 1) / N).toFixed(6)} + ${(0.5 / N).toFixed(6)});
      float dist = length(wp - uCam.xz);
      float sc = step(aBase.z * 0.9 + 0.05, hd.g) * (0.55 + aBase.z * 0.9) * smoothstep(${(L / 2).toFixed(1)}, ${(L / 2 - 10).toFixed(1)}, dist);
      vec3 transformed = position * sc;
      float sway = sin(uTime * (1.3 + aBase.z) + wp.x * 0.4 + wp.y * 0.3) * uWind * position.y;
      transformed.x += sway * 0.35; transformed.z += sway * 0.2;
      transformed += vec3(wp.x, hd.r - 0.03, wp.y);`);
  };
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; scene.add(mesh);
  return { mesh, update(t, cam, wind) { u.uCam.value.copy(cam.position); u.uTime.value = t; u.uWind.value = wind; } };
}
