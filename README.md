# Senja Terakhir di Lembah Kala — Flight Game

Bush plane **Elang Senja** membawa sekotak obat ke klinik Desa Kala, di ujung
lembah yang gelap. Matahari tinggal lima menit lagi. Terbang rendah menyusuri
sungai, tembus lima ring jingga di antara tebing, lalu mendaratkan pesawat di
landasan tanah yang pendek — sebelum gelap menelan lembah.

Entry untuk kompetisi make.fun `best-flight-game-20261126-0057` ("Make the best
flight game"). Dibangun dengan Three.js (vendored) + canvas HUD, suara
prosedural WebAudio, tanpa aset eksternal dan tanpa network request.

## Main

Buka `game/index.html` lewat server statis apa pun (atau `node serve.ts` lalu
buka http://localhost:8080).

| Kontrol | Fungsi |
| --- | --- |
| ↑ / W, ↓ / S | Pitch naik / turun |
| ← → / A D | Belok (roll) |
| Shift / Ctrl (atau + / -) | Throttle naik / turun |
| Space | Rem udara |
| C | Ganti kamera (chase / cockpit) |
| P | Jeda · M bisu · R ulang |

## Misi

1. Lepas landas dari strip selatan (throttle penuh, lalu tarik ke atas).
2. Lewati 5 ring jingga berurutan (+100 tiap ring).
3. Mendarat di landasan utara Desa Kala — dinilai dari kecepatan, posisi tengah
   landasan, dan kelembutan sentuhan, plus bonus sisa waktu senja.
4. Hati-hati: menabrak tanah = crash; bahan bakar dan senja sama-sama menipis.

`?auto=1` menyalakan autopilot demo (dipakai untuk tangkap layar playtest).
