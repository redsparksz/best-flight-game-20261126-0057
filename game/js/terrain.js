// terrain.js — Lembah Kala: heightfield lembah, langit senja, kabut, dan sungai.
// Semua geometri prosedural; tidak ada aset eksternal. Dunia membentang di sumbu Z:
// landasan selatan (takeoff) di z=+950, desa + landasan utara di z=-880, pegunungan di
// kedua sisi lembah. Ketinggian tanah dihitung satu fungsi yang dipakai juga oleh
// model terbang untuk deteksi tabrakan.

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Noise nilai deterministik (seeded) — bukit dan punggungan terlihat alami
// tanpa pola berulang yang kentara.
// ---------------------------------------------------------------------------
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(x, z) {
  return (
    valueNoise(x, z) * 0.55 +
    valueNoise(x * 2.13 + 7.3, z * 2.13 + 3.1) * 0.3 +
    valueNoise(x * 4.31 + 13.7, z * 4.31 + 9.4) * 0.15
  );
}

// ---------------------------------------------------------------------------
// Ketinggian tanah. Landasan utara dan strip selatan diratakan (blend) supaya
// pesawat bisa lepas landas dan mendarat di tanah datar.
// ---------------------------------------------------------------------------
export const RUNWAY = { x: 0, z: -880, length: 250, width: 22, y: 6 };
export const STRIP = { x: 0, z: 950, length: 200, width: 18, y: 6 };

function stripBlend(x, z, strip, pad) {
  const dx = Math.abs(x - strip.x) - strip.width / 2 - pad;
  const dz = Math.abs(z - strip.z) - strip.length / 2 - pad;
  const d = Math.max(dx, dz);
  if (d >= 0) return 0;
  return smooth(Math.min(1, -d / pad));
}

export function groundHeight(x, z) {
  // Dasar lembah: bergelombang lembut.
  let h = 4 + fbm(x * 0.006, z * 0.006) * 7 - 3;
  // Sungai mengikis sedikit alur di dasar lembah.
  const riverX = riverCenterX(z);
  const riverD = Math.abs(x - riverX);
  h -= Math.max(0, 1 - riverD / 26) * 2.2;
  // Pegunungan di kedua sisi: naik curam begitu keluar dari koridor lembah.
  const side = Math.abs(x);
  if (side > 190) {
    const t = (side - 190) / 320;
    h += t * t * 260 * (0.55 + 0.9 * fbm(x * 0.01 + 40, z * 0.008));
  }
  // Pegunungan penutup di ujung utara dan selatan, jauh di luar landasan.
  const end = Math.abs(z);
  if (end > 1120) {
    const t = (end - 1120) / 260;
    h += t * t * 200 * (0.6 + 0.8 * fbm(x * 0.009, z * 0.01 + 80));
  }
  // Ratakan tanah di strip lepas landas dan landasan.
  const bRun = stripBlend(x, z, RUNWAY, 60);
  const bStrip = stripBlend(x, z, STRIP, 50);
  const b = Math.max(bRun, bStrip);
  if (b > 0) h = h * (1 - b) + RUNWAY.y * b;
  return h;
}

export function riverCenterX(z) {
  return 62 * Math.sin(z * 0.0042) + 26 * Math.sin(z * 0.0113 + 1.7);
}

// ---------------------------------------------------------------------------
// Langit senja: gradien vertikal digambar ke CanvasTexture, dipakai sebagai
// latar scene; matahari rendah di ufuk utara; kabut ungu-jingga menelan
// dasar lembah.
// ---------------------------------------------------------------------------
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#1d2340');
  grad.addColorStop(0.35, '#4a3560');
  grad.addColorStop(0.58, '#a34d5e');
  grad.addColorStop(0.74, '#e8763f');
  grad.addColorStop(0.86, '#ffb347');
  grad.addColorStop(1.0, '#ffd98a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSky(scene) {
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(0xd88a6a, 420, 2400);
  // Matahari: bola bercahaya rendah di ufuk utara, arah pesawat terbang.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(46, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sun.position.set(-140, 108, -1450);
  scene.add(sun);
  // Halo matahari dari sprite radial.
  const hc = document.createElement('canvas');
  hc.width = hc.height = 256;
  const hg = hc.getContext('2d');
  const rg = hg.createRadialGradient(128, 128, 8, 128, 128, 128);
  rg.addColorStop(0, 'rgba(255,214,140,0.85)');
  rg.addColorStop(0.4, 'rgba(255,150,80,0.28)');
  rg.addColorStop(1, 'rgba(255,150,80,0)');
  hg.fillStyle = rg;
  hg.fillRect(0, 0, 256, 256);
  const haloTex = new THREE.CanvasTexture(hc);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: haloTex, transparent: true, fog: false, depthWrite: false })
  );
  halo.scale.set(520, 520, 1);
  halo.position.copy(sun.position);
  scene.add(halo);
  // Cahaya: matahari jingga rendah + langit ungu dari atas + pantulan tanah.
  const sunLight = new THREE.DirectionalLight(0xff9a4d, 2.8);
  sunLight.position.set(-300, 220, -900);
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x9a7cc8, 0x54402e, 1.15));
  // Isi hangat dari arah selatan supaya lereng yang menghadap kamera tidak gelap.
  const fill = new THREE.DirectionalLight(0xffb080, 0.7);
  fill.position.set(300, 260, 900);
  scene.add(fill);
  return { sun, sunLight };
}

// ---------------------------------------------------------------------------
// Mesh tanah: heightfield 2400 x 2400 dengan warna verteks — rumput lembah,
// tanah gersang dekat sungai, batu di lereng, salju tipis di puncak.
// ---------------------------------------------------------------------------
export function buildTerrain(scene) {
  const size = 2400;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGrass = new THREE.Color(0x6a8a42);
  const cGrassDry = new THREE.Color(0x9a8a4a);
  const cDirt = new THREE.Color(0x8a6a42);
  const cRock = new THREE.Color(0x6e5a58);
  const cSnow = new THREE.Color(0xd8d2e8);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const slope = Math.abs(groundHeight(x + 6, z) - h) + Math.abs(groundHeight(x, z + 6) - h);
    const n = fbm(x * 0.02 + 3, z * 0.02 + 9);
    tmp.copy(cGrass).lerp(cGrassDry, Math.min(1, n * 0.9));
    if (Math.abs(x - riverCenterX(z)) < 20) tmp.lerp(cDirt, 0.55);
    if (h > 55 || slope > 5.5) tmp.lerp(cRock, Math.min(1, (h - 40) / 60 + slope / 14));
    if (h > 150) tmp.lerp(cSnow, Math.min(1, (h - 150) / 90));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  );
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Sungai: pita berkilau mengikuti lekuk lembah, memantulkan jingga senja.
// ---------------------------------------------------------------------------
export function buildRiver(scene) {
  const pts = [];
  const width = 15;
  for (let z = -1150; z <= 1150; z += 40) {
    const cx = riverCenterX(z);
    const y = groundHeight(cx, z) + 0.7;
    pts.push(new THREE.Vector3(cx - width / 2, y, z));
    pts.push(new THREE.Vector3(cx + width / 2, y, z));
  }
  const idx = [];
  const rows = pts.length / 2;
  for (let r = 0; r < rows - 1; r++) {
    const a = r * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd86a3a,
    roughness: 0.15,
    metalness: 0.55,
    emissive: 0x57280f,
    emissiveIntensity: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// Desa Kala: gubuk-gubuk kayu beratap seng di dekat landasan utara, jendela
// hangat menyala, plus klinik beratap merah dengan tanda salib — tujuan
// kotak obat yang dibawa pesawat.
// ---------------------------------------------------------------------------
function makeHut(w, d, h, wallColor, roofColor) {
  const g = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 })
  );
  walls.position.y = h / 2;
  g.add(walls);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.7, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.85 })
  );
  roof.position.y = h + h * 0.35;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  // Jendela hangat: dua bidang emissive di sisi depan.
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x332211,
    emissive: 0xffb347,
    emissiveIntensity: 1.6,
  });
  for (const sx of [-0.22, 0.22]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.16, h * 0.28), winMat);
    win.position.set(w * sx, h * 0.55, d / 2 + 0.03);
    g.add(win);
  }
  return g;
}

export function buildVillage(scene) {
  const group = new THREE.Group();
  const spots = [
    [-95, -830, 9, 7, 5], [-70, -860, 8, 7, 4.5], [-118, -895, 10, 8, 5.5],
    [-55, -915, 7, 6, 4], [-130, -950, 9, 7, 5], [-78, -975, 8, 6, 4.5],
    [72, -845, 9, 7, 5], [98, -880, 8, 7, 4.5], [64, -920, 10, 8, 5],
    [110, -945, 7, 6, 4], [82, -985, 8, 7, 4.5], [-150, -870, 7, 6, 4],
    [135, -905, 8, 6, 4], [-100, -1010, 9, 7, 5],
  ];
  const walls = [0x7a5c38, 0x6b4e33, 0x84643f];
  const roofs = [0x4a3a2e, 0x5a3a30, 0x3e4a3a];
  spots.forEach(([x, z, w, d, h], i) => {
    const hut = makeHut(w, d, h, walls[i % 3], roofs[i % 3]);
    hut.position.set(x, groundHeight(x, z), z);
    hut.rotation.y = (i * 0.7) % Math.PI;
    group.add(hut);
  });
  // Klinik desa: lebih besar, atap merah, tanda salib putih menyala di depan.
  const clinic = makeHut(14, 11, 6.5, 0xe8ddc8, 0xa83226);
  clinic.position.set(-60, groundHeight(-60, -1000), -1000);
  group.add(clinic);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xff5040 });
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.2, 0.3), crossMat);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.3), crossMat);
  crossV.position.set(-60, groundHeight(-60, -1000) + 9.5, -994.2);
  crossH.position.set(-60, groundHeight(-60, -1000) + 9.9, -994.2);
  group.add(crossV, crossH);
  // Pohon pinus tersebar di lembah.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x2e4a26, roughness: 0.95 });
  for (let i = 0; i < 90; i++) {
    const x = (hash2(i, 11) - 0.5) * 700;
    const z = (hash2(i, 23) - 0.5) * 2100;
    if (Math.abs(x) < 60 || Math.abs(x - riverCenterX(z)) < 30) continue;
    if (Math.abs(z - RUNWAY.z) < 150 && Math.abs(x) < 60) continue;
    if (Math.abs(z - STRIP.z) < 130 && Math.abs(x) < 50) continue;
    const s = 3 + hash2(i, 37) * 4;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, s * 0.5, 6), trunkMat);
    trunk.position.y = s * 0.25;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(s * 0.55, s, 8), pineMat);
    cone.position.y = s * 0.5 + s * 0.5;
    tree.add(trunk, cone);
    tree.position.set(x, groundHeight(x, z), z);
    group.add(tree);
  }
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------
// Landasan: strip tanah + lampu tepi menyala + windsock + papan penanda.
// ---------------------------------------------------------------------------
function makeStripLights(scene, strip, color) {
  const mat = new THREE.MeshBasicMaterial({ color });
  const geo = new THREE.SphereGeometry(0.9, 8, 6);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const z = strip.z - strip.length / 2 + (i * strip.length) / (n - 1);
    for (const sx of [-1, 1]) {
      const lamp = new THREE.Mesh(geo, mat);
      lamp.position.set(strip.x + sx * (strip.width / 2 + 3), strip.y + 1.2, z);
      scene.add(lamp);
    }
  }
}

function makeWindsock(scene, x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, 12, 6),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.6 })
  );
  const y = groundHeight(x, z);
  pole.position.set(x, y + 6, z);
  scene.add(pole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 4.5, 10, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.8, side: THREE.DoubleSide })
  );
  sock.rotation.z = Math.PI / 2 + 0.25;
  sock.position.set(x + 2.4, y + 11.4, z);
  scene.add(sock);
}

export function buildRunway(scene) {
  const group = new THREE.Group();
  // Strip tanah: bidang cokelat muda sedikit di atas tanah.
  for (const strip of [RUNWAY, STRIP]) {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(strip.width, strip.length),
      new THREE.MeshStandardMaterial({ color: 0x9a7a4e, roughness: 1 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(strip.x, strip.y + 0.25, strip.z);
    group.add(pad);
    // Garis tengah putus-putus.
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2e8c8 });
    for (let i = 0; i < 7; i++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 9), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(strip.x, strip.y + 0.4, strip.z - strip.length / 2 + 18 + i * ((strip.length - 36) / 6));
      group.add(dash);
    }
    makeStripLights(scene, strip, 0xffc46a);
  }
  makeWindsock(scene, 26, RUNWAY.z + 40);
  makeWindsock(scene, -24, STRIP.z - 30);
  scene.add(group);
  return group;
}

// ---------------------------------------------------------------------------
// Ring target: 5 cincin jingga berurutan menyusuri lembah. Ring aktif
// berdenyut (emissive kuat); yang sudah dilewati berubah hijau redup.
// ---------------------------------------------------------------------------
export const RINGS = [
  { x: 40, y: 58, z: 600, r: 18 },
  { x: -62, y: 72, z: 250, r: 18 },
  { x: 72, y: 88, z: -100, r: 18 },
  { x: -42, y: 62, z: -450, r: 18 },
  { x: 0, y: 46, z: -700, r: 18 },
];

export function buildRings(scene) {
  const meshes = RINGS.map((ring) => {
    const geo = new THREE.TorusGeometry(ring.r, 1.4, 12, 40);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff7a1a,
      emissive: 0xff6a00,
      emissiveIntensity: 1.1,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ring.x, ring.y, ring.z);
    scene.add(mesh);
    return mesh;
  });
  return meshes;
}
