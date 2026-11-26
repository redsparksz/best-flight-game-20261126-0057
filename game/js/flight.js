// flight.js — Model terbang arcade + misi "antar obat sebelum gelap".
// Fisika sengaja sederhana tapi menuntut disiplin: throttle mengatur kecepatan,
// pitch mengatur naik-turun, roll membelokkan heading; terlalu pelan = stall
// dan pesawat jatuh; bahan bakar dan waktu senja sama-sama menipis.

import { groundHeight, RUNWAY, STRIP, RINGS } from './terrain.js';

export const MISSION = {
  title: 'Senja Terakhir di Lembah Kala',
  plane: 'Elang Senja',
  cargo: 'Kotak obat untuk Klinik Desa Kala',
  daylightSec: 300,
  ringScore: 100,
};

export function createFlight() {
  return {
    // Pose
    x: STRIP.x,
    y: STRIP.y + 1.6,
    z: STRIP.z,
    heading: 0, // menghadap utara (-Z); maju = (sin h, 0, -cos h)
    pitch: 0,
    roll: 0,
    speed: 0, // m/s
    throttle: 0,
    vspeed: 0,
    // Sumber daya
    fuel: 100,
    damage: 0,
    timeLeft: MISSION.daylightSec,
    // Misi
    ringIndex: 0,
    ringsPassed: 0,
    score: 0,
    landed: false,
    crashed: false,
    crashReason: '',
    landingScore: 0,
    onGround: true,
    // Input
    keys: {},
    // Autopilot (null = pemain yang mengendalikan)
    autoPitch: null,
    autoRoll: null,
    // Statistik
    elapsed: 0,
    maxAlt: 0,
    // Tenggang lepas landas: 1,2 dtk setelah takeoff, tanah yang menanjak
    // di depan strip tidak langsung memantulkan pesawat kembali.
    takeoffGrace: 0,
  };
}

const MAX_SPEED = 62; // m/s pada throttle penuh (~223 km/h)
const STALL_SPEED = 17; // di bawah ini pesawat kehilangan daya angkat
const CLIMB_RATE = 1.05; // pengali laju naik dari pitch + kecepatan

export function resetFlight(f) {
  const fresh = createFlight();
  Object.assign(f, fresh);
}

// ---------------------------------------------------------------------------
// Input: panah/WASD untuk pitch & roll, Shift/Ctrl atau +/- untuk throttle,
// Space rem udara, C kamera, P jeda, M bisu, R ulang.
// ---------------------------------------------------------------------------
export function bindKeys(f, onAction) {
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    f.keys[e.key.toLowerCase()] = true;
    if (e.key === 'c' || e.key === 'C') onAction('camera');
    if (e.key === 'p' || e.key === 'P') onAction('pause');
    if (e.key === 'm' || e.key === 'M') onAction('mute');
    if (e.key === 'r' || e.key === 'R') onAction('restart');
  };
  const up = (e) => {
    f.keys[e.key.toLowerCase()] = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

function key(f, ...names) {
  return names.some((n) => f.keys[n]);
}

// ---------------------------------------------------------------------------
// Satu langkah simulasi (dt detik). Mengembalikan event string atau null:
// 'ring' | 'landed' | 'crashed' | 'timeout' | 'fuel-empty'.
// ---------------------------------------------------------------------------
export function stepFlight(f, dt, events) {
  if (f.crashed || f.landed) return null;
  f.elapsed += dt;
  f.timeLeft -= dt;
  if (f.timeLeft <= 0) {
    f.crashed = true;
    f.crashReason = 'Gelap turun sebelum obat sampai — senja habis.';
    events.push('timeout');
    return 'timeout';
  }

  // Throttle: Shift naik, Ctrl turun, +/- juga bisa.
  if (key(f, 'shift')) f.throttle = Math.min(1, f.throttle + dt * 0.5);
  if (key(f, 'control')) f.throttle = Math.max(0, f.throttle - dt * 0.6);
  if (key(f, '=', '+')) f.throttle = Math.min(1, f.throttle + dt * 0.5);
  if (key(f, '-', '_')) f.throttle = Math.max(0, f.throttle - dt * 0.6);

  // Pitch & roll dari input, dengan pemulihan lembut ke netral. Autopilot
  // (autoPitch/autoRoll) mengendalikan langsung dengan nilai proporsional,
  // bukan tombol on/off, supaya pendaratan bisa halus.
  const pitchIn = (key(f, 'arrowup', 'w') ? 1 : 0) - (key(f, 'arrowdown', 's') ? 1 : 0);
  const rollIn = (key(f, 'arrowleft', 'a') ? 1 : 0) - (key(f, 'arrowright', 'd') ? 1 : 0);
  const targetPitch = f.autoPitch !== null ? f.autoPitch : pitchIn * 0.42;
  const targetRoll = f.autoRoll !== null ? f.autoRoll : rollIn * 0.85;
  f.pitch += (targetPitch - f.pitch) * Math.min(1, dt * 3.2);
  f.roll += (targetRoll - f.roll) * Math.min(1, dt * 3.2);
  // Belok mengikuti kemiringan sayap; makin cepat makin responsif.
  const turnRate = -f.roll * 0.55 * Math.min(1, f.speed / 30);
  f.heading += turnRate * dt;

  // Kecepatan mengejar throttle; rem udara (Space) mengerem kuat.
  const targetSpeed = f.throttle * MAX_SPEED * (f.fuel > 0 ? 1 : 0);
  const accel = key(f, ' ') ? 14 : 5;
  f.speed += Math.sign(targetSpeed - f.speed) * Math.min(Math.abs(targetSpeed - f.speed), accel * dt);
  if (f.fuel > 0) f.fuel = Math.max(0, f.fuel - (0.12 + f.throttle * 0.55) * dt);
  if (f.fuel <= 0 && f.throttle > 0) events.push('fuel-empty');

  // Gaya angkat: pitch menaikkan pesawat sebanding kecepatan; di bawah stall,
  // pesawat tenggelam apa pun inputnya.
  const liftFactor = Math.max(0, Math.min(1, (f.speed - STALL_SPEED * 0.4) / (STALL_SPEED * 1.4)));
  let climb = Math.sin(f.pitch) * f.speed * CLIMB_RATE * liftFactor;
  if (f.speed < STALL_SPEED) climb -= (STALL_SPEED - f.speed) * 0.85;
  f.vspeed = climb;
  const ground = groundHeight(f.x, f.z);
  const wasGround = f.onGround;
  if (f.onGround) {
    // Di darat: melaju di strip; lepas landas begitu kecepatan cukup + pitch naik.
    f.y = ground + 1.6;
    if (f.speed > 26 && f.pitch > 0.1) {
      f.onGround = false;
      f.takeoffGrace = 1.2;
      events.push('takeoff');
    }
  } else {
    f.y += climb * dt;
    if (f.takeoffGrace > 0) f.takeoffGrace -= dt;
  }
  f.maxAlt = Math.max(f.maxAlt, f.y - ground);

  // Gerak maju mengikuti heading + pitch.
  const forward = f.speed * dt;
  f.x += Math.sin(f.heading) * Math.cos(f.pitch) * forward;
  f.z += -Math.cos(f.heading) * Math.cos(f.pitch) * forward;
  // Batas dunia: dinding lembah — putar balik dengan lembut, jangan tembus.
  if (Math.abs(f.x) > 1050 || Math.abs(f.z) > 1150) {
    f.heading += Math.PI * dt * 0.8;
    events.push('edge');
  }
  void wasGround;
  return null;
}

// ---------------------------------------------------------------------------
// Ring, tabrakan, dan pendaratan — dipanggil setiap frame setelah stepFlight.
// ---------------------------------------------------------------------------
export function checkRings(f, events) {
  if (f.ringIndex >= RINGS.length) return;
  const ring = RINGS[f.ringIndex];
  const dx = f.x - ring.x;
  const dy = f.y - ring.y;
  const dz = f.z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Pesawat harus melewati bidang cincin: dekat dengan pusatnya.
  if (dist < ring.r * 0.95) {
    f.ringIndex += 1;
    f.ringsPassed += 1;
    f.score += MISSION.ringScore;
    events.push('ring');
  }
}

export function checkTerrainAndLanding(f, events) {
  const ground = groundHeight(f.x, f.z);
  const clearance = f.y - ground;
  const overRunway =
    Math.abs(f.x - RUNWAY.x) < RUNWAY.width / 2 + 4 &&
    Math.abs(f.z - RUNWAY.z) < RUNWAY.length / 2 + 10;
  const overStrip =
    Math.abs(f.x - STRIP.x) < STRIP.width / 2 + 4 &&
    Math.abs(f.z - STRIP.z) < STRIP.length / 2 + 10;

  if (f.onGround) return;
  if (f.takeoffGrace > 0) return; // masih dalam tenggang lepas landas
  if (clearance <= 1.6) {
    if ((overRunway || overStrip) && f.ringIndex >= RINGS.length) {
      // Pendaratan dinilai: makin pelan, makin tengah, makin datar, makin bagus.
      const centerErr = Math.abs(f.x - RUNWAY.x);
      const sinkOk = Math.abs(f.vspeed) < 6;
      const speedOk = f.speed < 46;
      const levelOk = Math.abs(f.roll) < 0.5 && Math.abs(f.pitch) < 0.3;
      if (sinkOk && speedOk && levelOk) {
        f.landed = true;
        f.onGround = true;
        const centerPts = Math.max(0, 200 - centerErr * 12);
        const speedPts = Math.max(0, 150 - Math.max(0, f.speed - 20) * 6);
        const smoothPts = Math.max(0, 150 - Math.abs(f.vspeed) * 18);
        f.landingScore = Math.round(centerPts + speedPts + smoothPts);
        f.score += f.landingScore;
        // Bonus waktu: sisa senja yang tidak terpakai.
        const timeBonus = Math.round(f.timeLeft);
        f.score += timeBonus;
        f.timeBonus = timeBonus;
        events.push('landed');
        return;
      }
      f.crashed = true;
      f.crashReason = !sinkOk
        ? 'Menukik terlalu keras ke landasan.'
        : !speedOk
          ? 'Terlalu cepat saat menyentuh landasan.'
          : 'Sayap belum rata saat menyentuh landasan.';
      events.push('crashed');
      return;
    }
    if (overRunway || overStrip) {
      // Menyentuh landasan sebelum semua ring dilewati: bukan crash, tapi
      // pesawat memantul kembali — misi belum selesai, lepas landas lagi.
      if (Math.abs(f.vspeed) < 4 && f.speed < 40) {
        f.onGround = true;
        f.y = ground + 1.6;
        events.push('touchdown-early');
        return;
      }
    }
    // Sentuhan lembut dengan tanah di luar landasan: pesawat memantul dan
    // menggelinding lagi, bukan langsung hancur — hanya hantaman keras
    // (menukik / kecepatan tinggi) yang mengakhiri misi. Ini juga mencegah
    // kematian murah tepat setelah lepas landas saat tanah di depan menanjak.
    if (f.vspeed > -3.5 && f.speed < 52 && clearance > 0.4) {
      f.onGround = true;
      f.y = ground + 1.6;
      f.damage += 5;
      events.push('bounce');
      return;
    }
    f.crashed = true;
    f.crashReason = clearance < 0.5 ? 'Menabrak tanah lembah.' : 'Mendarat darurat di luar landasan.';
    events.push('crashed');
  }
}

// ---------------------------------------------------------------------------
// Autopilot (mode demo / tangkap layar): mengarahkan pesawat ke ring berikut
// lalu ke ambang landasan, mengatur throttle dan pitch dengan kontrol sederhana.
// Bukan cheat untuk pemain — hanya alat uji dan demo atraksi.
// ---------------------------------------------------------------------------
export function autopilot(f, dt) {
  let target;
  if (f.ringIndex < RINGS.length) {
    target = RINGS[f.ringIndex];
  } else if (f.onGround) {
    // Sudah menyentuh landasan terlalu dini: lepas landas lagi ke titik kumpul.
    target = { x: RUNWAY.x, y: RUNWAY.y + 26, z: RUNWAY.z + 130 };
  } else {
    // Final: garis lurus ke ujung jauh landasan, membidik titik DI BAWAH
    // permukaan supaya kontrol proporsional terus menurunkan pesawat sampai
    // pemeriksaan pendaratan (clearance <= 1,6 m) memicu — membidik tepat
    // di ketinggian landasan membuat pesawat melayang selamanya di 2 m.
    target = { x: RUNWAY.x, y: RUNWAY.y - 4, z: RUNWAY.z - 40 };
  }
  const dx = target.x - f.x;
  const dz = target.z - f.z;
  const dy = target.y - f.y;
  const wantHeading = Math.atan2(dx, -dz);
  let dh = wantHeading - f.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  // Kontrol proporsional: roll sebanding selisih heading (dh > 0 = target di
  // kanan = heading harus bertambah = roll negatif), pitch sebanding selisih
  // ketinggian. Nilai kecil = gerak halus, penting saat final pendaratan.
  // Di final (dekat landasan), batasi roll supaya sayap sudah rata sebelum
  // menyentuh tanah.
  const nearFinal = f.ringIndex >= RINGS.length && !f.onGround;
  const rollLimit = nearFinal ? 0.4 : 0.85;
  f.autoRoll = Math.max(-rollLimit, Math.min(rollLimit, -dh * 1.2));
  f.autoPitch = Math.max(-0.22, Math.min(0.3, dy * 0.008 + (f.onGround ? 0.08 : 0)));
  const dist = Math.sqrt(dx * dx + dz * dz);
  // Setelah lepas landas, throttle penuh sampai ring pertama terlewati.
  const wantThrottle = f.onGround || f.ringIndex === 0 ? 1 : dist > 120 ? 0.85 : 0.55;
  f.throttle += Math.sign(wantThrottle - f.throttle) * Math.min(Math.abs(wantThrottle - f.throttle), dt * 0.4);
  if (f.ringIndex >= RINGS.length && !f.onGround && dist < 200) {
    // Final: pelan-pelan kurangi throttle, tapi jangan sampai di bawah stall.
    f.throttle = Math.max(0.35, f.throttle - dt * 0.2);
  }
}

export function clearAutopilotKeys(f) {
  f.autoPitch = null;
  f.autoRoll = null;
  for (const k of ['arrowleft', 'arrowright', 'a', 'd', 'arrowup', 'arrowdown', 'w', 's']) {
    f.keys[k] = false;
  }
}
