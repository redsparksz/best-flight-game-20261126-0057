// main.js — "Senja Terakhir di Lembah Kala": bootstrap, kamera, loop utama.
// Chase view default (pesawat terlihat + HUD lengkap); tekan C untuk cockpit view.
// ?auto=1 memulai permainan dan menyalakan autopilot (mode demo / tangkap layar).

import * as THREE from 'three';
import {
  buildSky,
  buildTerrain,
  buildRiver,
  buildVillage,
  buildRunway,
  buildRings,
  groundHeight,
  RINGS,
} from './terrain.js';
import { buildPlane, buildPropeller, buildGear, buildNavLights, buildMedicineBox } from './plane.js';
import {
  createFlight,
  resetFlight,
  bindKeys,
  stepFlight,
  checkRings,
  checkTerrainAndLanding,
  autopilot,
  clearAutopilotKeys,
} from './flight.js';
import { createAudio, ensureAudio, updateAudio, playRing, playThud, playFanfare, setMuted } from './audio.js';
import { buildHud, updateHud, showMessage, showEnd } from './hud.js';

const params = new URLSearchParams(location.search);
const AUTO = params.get('auto') === '1';
const START_CAM = params.get('cam') === 'cockpit' ? 'cockpit' : 'chase';

// ---------------------------------------------------------------------------
// Renderer + scene.
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
buildSky(scene);
buildTerrain(scene);
buildRiver(scene);
buildVillage(scene);
buildRunway(scene);
const ringMeshes = buildRings(scene);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 14, 975);

// ---------------------------------------------------------------------------
// Pesawat + keadaan permainan.
// ---------------------------------------------------------------------------
const { plane } = buildPlane();
const { prop, disc } = buildPropeller(plane);
buildGear(plane);
const navLights = buildNavLights(plane);
buildMedicineBox(plane);
scene.add(plane);

const flight = createFlight();
const audio = createAudio();
const hud = buildHud();

let state = 'menu'; // menu | fly | paused | end
let camMode = START_CAM;
let camPos = new THREE.Vector3(0, 14, 975);
let camLook = new THREE.Vector3(0, 8, 940);
let lastTime = performance.now();
let acc = 0; // akumulator langkah-tetap simulasi
let endShownAt = 0;
const eventLog = [];

function logEvent(name, detail) {
  eventLog.push({ t: +(flight.elapsed || 0).toFixed(2), name, detail: detail || '' });
  if (eventLog.length > 200) eventLog.shift();
}

// Handle untuk playtest otomatis (bukan cheat pemain: hanya membaca keadaan).
window.__game = {
  flight,
  get state() {
    return state;
  },
  get events() {
    return eventLog;
  },
  start: () => startGame(),
  restart: () => restartGame(),
};

function syncPlaneMesh() {
  plane.position.set(flight.x, flight.y, flight.z);
  plane.rotation.set(0, 0, 0);
  plane.rotateY(flight.heading);
  plane.rotateX(-flight.pitch);
  plane.rotateZ(flight.roll);
}

// ---------------------------------------------------------------------------
// Kamera: chase mengikuti dari belakang-atas; cockpit dari hidung pesawat.
// ---------------------------------------------------------------------------
function updateCamera(dt, time) {
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  const forward = new THREE.Vector3(Math.sin(flight.heading), 0, -Math.cos(flight.heading));
  if (state === 'menu') {
    // Sinematik pembuka: kamera mengorbit pelan mengelilingi pesawat sambil
    // memandang ke utara — lembah, sungai, dan matahari senja dalam satu frame.
    const a = time * 0.07;
    target.set(
      plane.position.x + Math.sin(a) * 26,
      plane.position.y + 9 + Math.sin(time * 0.11) * 1.5,
      plane.position.z + 15 + Math.cos(a) * 8
    );
    look.copy(plane.position).addScaledVector(forward, 60);
    look.y = plane.position.y + 26;
  } else if (camMode === 'cockpit') {
    // Kokpit: kamera rendah di atas hidung, memandang ke depan agak menunduk —
    // baling-baling dan hidung pesawat tetap terlihat di tepi bawah frame.
    target.copy(plane.position).addScaledVector(forward, 2.0);
    target.y = plane.position.y + 1.1;
    look.copy(plane.position).addScaledVector(forward, 60);
    look.y = plane.position.y - 1.0 - flight.pitch * 20;
  } else {
    target.copy(plane.position).addScaledVector(forward, -11.5);
    target.y = plane.position.y + 4.6;
    const minY = groundHeight(target.x, target.z) + 2.2;
    if (target.y < minY) target.y = minY;
    look.copy(plane.position).addScaledVector(forward, 26);
    look.y = plane.position.y + 1.2;
  }
  const k = Math.min(1, dt * (camMode === 'cockpit' ? 14 : 5));
  camPos.lerp(target, k);
  camLook.lerp(look, Math.min(1, dt * 8));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

function updateRingsVisual(time) {
  ringMeshes.forEach((mesh, i) => {
    const mat = mesh.material;
    if (i < flight.ringIndex) {
      mat.emissive.setHex(0x1a8a3c);
      mat.color.setHex(0x2a8a4c);
      mat.emissiveIntensity = 0.5;
    } else if (i === flight.ringIndex) {
      mat.emissive.setHex(0xff6a00);
      mat.color.setHex(0xff7a1a);
      mat.emissiveIntensity = 1.1 + Math.sin(time * 5) * 0.55;
      mesh.rotation.z = Math.sin(time * 0.8) * 0.05;
    } else {
      mat.emissive.setHex(0x883a00);
      mat.color.setHex(0xb05a1a);
      mat.emissiveIntensity = 0.55;
    }
  });
}

// ---------------------------------------------------------------------------
// Alur permainan: mulai, jeda, ulang, akhir.
// ---------------------------------------------------------------------------
function startGame() {
  ensureAudio(audio);
  hud.menu.classList.add('hidden');
  hud.endScreen.classList.add('hidden');
  hud.pauseScreen.classList.add('hidden');
  state = 'fly';
  showMessage(hud, 'Throttle penuh (Shift), lalu tarik ke atas (↑) untuk lepas landas!', 4200);
  logEvent('start');
}

function restartGame() {
  resetFlight(flight);
  hud.endScreen.classList.add('hidden');
  hud.pauseScreen.classList.add('hidden');
  camPos.set(flight.x, flight.y + 8, flight.z + 14);
  camLook.set(flight.x, flight.y, flight.z - 20);
  state = 'fly';
  ensureAudio(audio);
  showMessage(hud, 'Misi diulang — obat harus sampai sebelum gelap!', 3200);
  logEvent('restart');
}

function endGame() {
  state = 'end';
  endShownAt = performance.now();
  showEnd(hud, flight);
  logEvent('end', flight.landed ? 'landed' : 'crashed');
}

function handleAction(action) {
  if (action === 'camera') {
    camMode = camMode === 'chase' ? 'cockpit' : 'chase';
    showMessage(hud, camMode === 'chase' ? 'Kamera: chase view' : 'Kamera: cockpit view', 1400);
    logEvent('camera', camMode);
  } else if (action === 'pause') {
    if (state === 'fly') {
      state = 'paused';
      hud.pauseScreen.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'fly';
      hud.pauseScreen.classList.add('hidden');
    }
  } else if (action === 'mute') {
    setMuted(audio, !audio.muted);
    showMessage(hud, audio.muted ? 'Suara mati' : 'Suara hidup', 1200);
  } else if (action === 'restart') {
    if (state !== 'menu') restartGame();
  }
}

bindKeys(flight, handleAction);
hud.startBtn.addEventListener('click', startGame);
hud.againBtn.addEventListener('click', restartGame);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && state === 'menu') startGame();
  if (e.key === 'Enter' && state === 'end') restartGame();
});
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// Loop utama.
// ---------------------------------------------------------------------------
function handleEvents(events) {
  for (const ev of events) {
    if (ev === 'takeoff') {
      showMessage(hud, 'Lepas landas! Ikuti ring jingga menyusuri lembah.', 3200);
      logEvent('takeoff');
    } else if (ev === 'ring') {
      playRing(audio);
      showMessage(
        hud,
        `Ring ${flight.ringsPassed}/5 dilewati! +100 — ${flight.ringIndex < RINGS.length ? 'ring berikutnya di depan' : 'terakhir: mendarat di landasan!'}`
      );
      logEvent('ring', `${flight.ringsPassed}/5`);
    } else if (ev === 'landed') {
      playFanfare(audio);
      logEvent('landed', `score=${flight.score}`);
      endGame();
    } else if (ev === 'crashed' || ev === 'timeout') {
      playThud(audio);
      logEvent('crashed', flight.crashReason);
      endGame();
    } else if (ev === 'fuel-empty') {
      showMessage(hud, 'Bahan bakar habis! Meluncur tanpa mesin — cari landasan.', 4000);
      logEvent('fuel-empty');
    } else if (ev === 'touchdown-early') {
      showMessage(hud, 'Menyentuh landasan terlalu dini — lepas landas lagi, ring belum habis!', 3500);
      logEvent('touchdown-early');
    } else if (ev === 'bounce') {
      showMessage(hud, 'Sentuhan keras dengan tanah — pesawat memantul, jaga ketinggian!', 3000);
      logEvent('bounce');
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  const time = now / 1000;

  if (state === 'fly') {
    // Langkah tetap 1/60 dtk, beberapa substep per frame: simulasi berjalan
    // dalam waktu nyata walau render lambat (mis. software GL di headless).
    const STEP = 1 / 60;
    acc += dtReal;
    let substeps = 0;
    while (acc >= STEP && substeps < 12) {
      const events = [];
      if (AUTO) autopilot(flight, STEP);
      stepFlight(flight, STEP, events);
      checkRings(flight, events);
      checkTerrainAndLanding(flight, events);
      handleEvents(events);
      if (flight.crashed || flight.landed) {
        if (AUTO) clearAutopilotKeys(flight);
        acc = 0;
        break;
      }
      acc -= STEP;
      substeps += 1;
    }
    if (substeps >= 12) acc = 0; // buang sisa supaya tidak spiral of death
    updateAudio(audio, flight.throttle, flight.speed, flight.onGround);
  }

  syncPlaneMesh();
  // Baling-baling berputar mengikuti throttle; cakram muncul di rpm tinggi.
  const spin = 2 + flight.throttle * 38 + flight.speed * 0.25;
  prop.rotation.z += spin * dtReal;
  disc.material.opacity = flight.throttle > 0.55 ? Math.min(0.28, (flight.throttle - 0.55) * 0.8) : 0;
  // Strobe berkedip tiap detik.
  navLights.strobe.visible = Math.floor(time * 1.4) % 2 === 0;
  updateRingsVisual(time);
  updateCamera(dtReal, time);
  updateHud(hud, flight);
  renderer.render(scene, camera);
}

syncPlaneMesh();
updateHud(hud, flight);
requestAnimationFrame(frame);

// Mode demo: mulai sendiri begitu halaman siap.
if (AUTO) {
  setTimeout(() => {
    if (state === 'menu') startGame();
  }, 600);
}
