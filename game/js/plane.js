// plane.js — "Elang Senja", bush plane pengangkut obat.
// Badan dirakit dari primitif Three.js (bukan model impor): fuselage silinder,
// sayap tinggi (high-wing) khas bush plane, ekor, baling-baling, roda tundra,
// lampu navigasi merah/hijau + strobe putih. Skala: 1 unit = 1 meter.

import * as THREE from 'three';

function paint(color, roughness = 0.55, metalness = 0.15) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function buildPlane() {
  const plane = new THREE.Group();
  // Cat khas: krem gading dengan garis jingga senja di sisi badan.
  const cream = paint(0xe8dcc0);
  const orange = paint(0xe86a1a, 0.5, 0.2);
  const dark = paint(0x2e2a26, 0.7, 0.1);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a4a,
    roughness: 0.12,
    metalness: 0.7,
    emissive: 0xff9a3c,
    emissiveIntensity: 0.25,
  });

  // Fuselage: badan utama + hidung meruncing ke baling-baling.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 12), cream);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0, 0.2);
  plane.add(body);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.4, 12), orange);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, 3.5);
  plane.add(nose);
  // Garis jingga di sisi badan.
  for (const sx of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 4.6), orange);
    stripe.position.set(sx * 0.86, -0.1, 0.1);
    plane.add(stripe);
  }

  // Kabin + kaca depan dan samping (instrumen di dalamnya menyala — lihat cockpit.js).
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 2.2), cream);
  cabin.position.set(0, 0.75, 0.6);
  plane.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.1), glassMat);
  windshield.position.set(0, 0.85, 1.75);
  windshield.rotation.x = -0.35;
  plane.add(windshield);
  for (const sx of [-1, 1]) {
    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.4), glassMat);
    sideWin.position.set(sx * 0.78, 0.85, 0.6);
    plane.add(sideWin);
  }

  // Sayap tinggi + penyangga (strut) khas bush plane.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.22, 1.9), cream);
  wing.position.set(0, 1.35, 0.7);
  plane.add(wing);
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 1.9), orange);
    tip.position.set(sx * 5.55, 1.35, 0.7);
    plane.add(tip);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6), dark);
    strut.position.set(sx * 2.4, 0.45, 0.7);
    strut.rotation.z = sx * 0.5;
    plane.add(strut);
  }

  // Ekor: stabilizer horizontal + fin vertikal jingga.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.2), cream);
  stab.position.set(0, 0.35, -2.6);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.5), orange);
  fin.position.set(0, 0.9, -2.7);
  plane.add(fin);
  return { plane, glassMat };
}

// ---------------------------------------------------------------------------
// Baling-baling, roda tundra, lampu navigasi, dan kotak obat di kabin.
// ---------------------------------------------------------------------------

export function buildPropeller(plane) {
  const group = new THREE.Group();
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.5, metalness: 0.4 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1e1a18, roughness: 0.45, metalness: 0.2 });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.09), bladeMat);
    blade.rotation.z = a;
    blade.position.y = 0;
    group.add(blade);
  }
  // Cakram buram baling-baling saat berputar kencang (transparan, muncul di rpm tinggi).
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 28),
    new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  group.add(disc);
  group.position.set(0, 0, 4.35);
  plane.add(group);
  return { prop: group, disc };
}

export function buildGear(plane) {
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x181512, roughness: 0.95 });
  const strutMat = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.6, metalness: 0.4 });
  for (const sx of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14), tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 1.05, -1.25, 1.2);
    plane.add(wheel);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), strutMat);
    leg.position.set(sx * 0.85, -0.65, 1.2);
    leg.rotation.z = sx * 0.35;
    plane.add(leg);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 10), tireMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.75, -2.7);
  plane.add(tailWheel);
}

export function buildNavLights(plane) {
  const mk = (color, x, y, z) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    lamp.position.set(x, y, z);
    plane.add(lamp);
    return lamp;
  };
  const left = mk(0xff2222, -5.8, 1.35, 0.7);
  const right = mk(0x22ff44, 5.8, 1.35, 0.7);
  const strobe = mk(0xffffff, 0, 1.8, -2.7);
  return { left, right, strobe };
}

// Kotak obat putih bertanda salib merah di rak kabin — muatan misi ini.
export function buildMedicineBox(plane) {
  const box = new THREE.Group();
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.6, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.8 })
  );
  box.add(crate);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xd83226 });
  const cv = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.02), crossMat);
  cv.position.set(0, 0, 0.36);
  const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.02), crossMat);
  ch.position.set(0, 0, 0.36);
  box.add(cv, ch);
  box.position.set(0, 0.35, -0.9);
  plane.add(box);
  return box;
}
