// hud.js — HUD, instrumen, menu, dan layar akhir.
// Semua overlay DOM + satu kanvas kecil untuk attitude indicator dan kompas.
// Instrumen "menyala": angka amber di atas panel gelap, seperti kokpit senja.

export function buildHud() {
  const root = document.getElementById('hud');
  root.innerHTML = `
    <div id="hud-top">
      <div class="panel" id="mission-panel">
        <div class="panel-title">MISI — ANTAR OBAT KE DESA KALA</div>
        <div id="mission-rings">RING <b>0 / 5</b></div>
        <div id="mission-time">SENJA <b>05:00</b></div>
      </div>
      <canvas id="compass" width="360" height="46"></canvas>
      <div class="panel" id="score-panel">
        <div class="panel-title">SKOR</div>
        <div id="score-value">0</div>
      </div>
    </div>
    <div id="hud-right">
      <div class="panel gauge"><div class="label">KETINGGIAN</div><div class="big" id="alt-value">0 m</div><div class="sub" id="vspeed-value">V/S 0 m/s</div></div>
      <div class="panel gauge"><div class="label">KECEPATAN</div><div class="big" id="speed-value">0 km/h</div><div class="sub" id="throttle-value">THR 0%</div></div>
      <canvas id="attitude" width="150" height="150"></canvas>
      <div class="panel gauge"><div class="label">BAHAN BAKAR</div><div id="fuel-bar"><div id="fuel-fill"></div></div><div class="sub" id="fuel-value">100%</div></div>
    </div>
    <div id="hud-bottom">
      <div id="message"></div>
      <div id="hint">↑↓ pitch &nbsp;·&nbsp; ←→ belok &nbsp;·&nbsp; Shift/Ctrl throttle &nbsp;·&nbsp; Space rem &nbsp;·&nbsp; C kamera &nbsp;·&nbsp; P jeda</div>
    </div>
    <div id="menu" class="overlay">
      <div class="card">
        <div class="kicker">MAKE.FUN — FLIGHT GAME</div>
        <h1>Senja Terakhir<br>di Lembah Kala</h1>
        <p class="story">Matahari tinggal <b>lima menit</b> lagi. Bush plane <b>Elang Senja</b> membawa
        sekotak obat untuk klinik Desa Kala, di ujung lembah yang gelap. Terbang rendah
        menyusuri sungai, tembus <b>lima ring jingga</b> di antara tebing, lalu mendaratkan
        pesawat di landasan tanah yang pendek — sebelum gelap menelan lembah.</p>
        <div class="controls">
          <div><b>↑ / W</b> naik &nbsp; <b>↓ / S</b> turun</div>
          <div><b>← → / A D</b> belok &nbsp; <b>Shift / Ctrl</b> throttle</div>
          <div><b>Space</b> rem udara &nbsp; <b>C</b> ganti kamera &nbsp; <b>P</b> jeda</div>
        </div>
        <button id="start-btn">TERBANG SEKARANG</button>
        <div class="fine">Keyboard + mouse · suara prosedural · tanpa unduhan apa pun</div>
      </div>
    </div>
    <div id="end-screen" class="overlay hidden">
      <div class="card">
        <div class="kicker" id="end-kicker">MISI SELESAI</div>
        <h1 id="end-title">Obat Sampai!</h1>
        <p class="story" id="end-story"></p>
        <div id="end-breakdown"></div>
        <button id="again-btn">TERBANG LAGI</button>
      </div>
    </div>
    <div id="pause-screen" class="overlay hidden">
      <div class="card"><h1>Jeda</h1><p class="story">Tekan P untuk lanjut terbang.</p></div>
    </div>`;
  return {
    alt: document.getElementById('alt-value'),
    vspeed: document.getElementById('vspeed-value'),
    speed: document.getElementById('speed-value'),
    throttle: document.getElementById('throttle-value'),
    fuelFill: document.getElementById('fuel-fill'),
    fuelValue: document.getElementById('fuel-value'),
    rings: document.getElementById('mission-rings'),
    time: document.getElementById('mission-time'),
    score: document.getElementById('score-value'),
    message: document.getElementById('message'),
    compass: document.getElementById('compass'),
    attitude: document.getElementById('attitude'),
    menu: document.getElementById('menu'),
    endScreen: document.getElementById('end-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    endKicker: document.getElementById('end-kicker'),
    endTitle: document.getElementById('end-title'),
    endStory: document.getElementById('end-story'),
    endBreakdown: document.getElementById('end-breakdown'),
    startBtn: document.getElementById('start-btn'),
    againBtn: document.getElementById('again-btn'),
  };
}

function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function updateHud(h, f) {
  h.alt.textContent = `${Math.round(f.y - 6)} m`;
  h.vspeed.textContent = `V/S ${f.vspeed >= 0 ? '+' : ''}${f.vspeed.toFixed(1)} m/s`;
  h.speed.textContent = `${Math.round(f.speed * 3.6)} km/h`;
  h.throttle.textContent = `THR ${Math.round(f.throttle * 100)}%`;
  h.fuelFill.style.width = `${Math.max(0, f.fuel)}%`;
  h.fuelFill.style.background = f.fuel < 20 ? '#ff4444' : '#ffb347';
  h.fuelValue.textContent = `${Math.round(f.fuel)}%`;
  h.rings.innerHTML = `RING <b>${f.ringsPassed} / 5</b>`;
  h.time.innerHTML = `SENJA <b>${fmtTime(f.timeLeft)}</b>`;
  h.time.style.color = f.timeLeft < 60 ? '#ff6a5a' : '';
  h.score.textContent = f.score;
  drawCompass(h.compass, f.heading);
  drawAttitude(h.attitude, f.roll, f.pitch);
}

// Kompas: strip heading 0–360 dengan tanda mata angin, jendela 120 derajat.
function drawCompass(canvas, heading) {
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,12,20,0.55)';
  g.fillRect(0, 0, w, h);
  // Heading 0 = utara; derajat kompas = heading dalam derajat, 0–360.
  const deg = (((heading * 180) / Math.PI) % 360 + 360) % 360;
  const pxPerDeg = w / 120;
  g.font = 'bold 13px monospace';
  g.textAlign = 'center';
  const labels = { 0: 'U', 45: 'TL', 90: 'T', 135: 'TG', 180: 'S', 225: 'BD', 270: 'B', 315: 'BL' };
  for (let d = -60; d <= 60; d += 5) {
    const hd = (Math.round(deg) + d + 360) % 360;
    const x = w / 2 + d * pxPerDeg;
    const major = hd % 45 === 0;
    const mid = hd % 15 === 0;
    g.strokeStyle = major ? '#ffb347' : 'rgba(255,255,255,0.5)';
    g.beginPath();
    g.moveTo(x, major ? 8 : 16);
    g.lineTo(x, 26);
    g.stroke();
    if (major) {
      g.fillStyle = '#ffb347';
      g.fillText(labels[hd] || String(hd), x, 42);
    } else if (mid) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillText(String(hd), x, 42);
    }
  }
  // Penanda tengah.
  g.fillStyle = '#ff6a3c';
  g.beginPath();
  g.moveTo(w / 2 - 7, 0);
  g.lineTo(w / 2 + 7, 0);
  g.lineTo(w / 2, 8);
  g.closePath();
  g.fill();
}

// Attitude indicator: horizon miring mengikuti roll, naik-turun mengikuti pitch.
function drawAttitude(canvas, roll, pitch) {
  const g = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = 68;
  g.clearRect(0, 0, w, h);
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.translate(cx, cy);
  g.rotate(-roll);
  const pitchPx = Math.max(-r, Math.min(r, pitch * 110));
  // Langit (senja) di atas horizon, tanah gelap di bawah.
  g.fillStyle = '#e8763f';
  g.fillRect(-r - 10, -r - 10 - pitchPx, r * 2 + 20, r + 10 + pitchPx);
  g.fillStyle = '#3a2a22';
  g.fillRect(-r - 10, -pitchPx, r * 2 + 20, r + 10 + pitchPx);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-r, -pitchPx);
  g.lineTo(r, -pitchPx);
  g.stroke();
  g.restore();
  // Bingkai + pesawat mini di tengah.
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#ffb347';
  g.beginPath();
  g.moveTo(cx - 26, cy);
  g.lineTo(cx - 8, cy);
  g.lineTo(cx, cy - 6);
  g.lineTo(cx + 8, cy);
  g.lineTo(cx + 26, cy);
  g.lineTo(cx + 8, cy + 3);
  g.lineTo(cx - 8, cy + 3);
  g.closePath();
  g.fill();
}

let messageTimer = 0;
export function showMessage(h, text, ms = 2600) {
  h.message.textContent = text;
  h.message.style.opacity = '1';
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    h.message.style.opacity = '0';
  }, ms);
}

export function showEnd(h, f) {
  const win = f.landed;
  h.endKicker.textContent = win ? 'MISI SELESAI' : 'MISI GAGAL';
  h.endTitle.textContent = win ? 'Obat Sampai di Desa Kala!' : 'Elang Senja Jatuh';
  h.endStory.textContent = win
    ? 'Kotak obat diserahkan ke klinik sebelum gelap. Lampu-lampu desa menyala satu per satu — malam ini, seseorang di lembah bisa tidur dengan tenang.'
    : f.crashReason || 'Penerbangan berakhir sebelum obat sampai.';
  const rows = [
    ['Ring dilewati', `${f.ringsPassed} / 5 × 100`, f.ringsPassed * 100],
    ['Pendaratan', f.landed ? 'mendarat mulus' : '—', f.landingScore || 0],
    ['Bonus sisa senja', f.landed ? `${f.timeBonus || 0} detik` : '—', f.timeBonus || 0],
    ['Waktu terbang', `${Math.round(f.elapsed)} detik`, ''],
    ['Ketinggian maks', `${Math.round(f.maxAlt)} m`, ''],
  ];
  h.endBreakdown.innerHTML = rows
    .map(
      ([label, val, pts]) =>
        `<div class="row"><span>${label}</span><span>${val}</span><b>${pts === '' ? '' : '+' + pts}</b></div>`
    )
    .join('') +
    `<div class="row total"><span>SKOR AKHIR</span><span></span><b>${f.score}</b></div>`;
  h.endScreen.classList.remove('hidden');
}
