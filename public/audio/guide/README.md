# Voice-over panduan VR

Rekaman voice over panduan VR (MP3). Nama & lokasi file harus persis seperti
field `audio` di `lib/vrGuide.ts` / tabel di `docs/VR-GUIDE-VOICEOVER.md`:

- `01-intro.MP3`, `02-look.MP3` — dipakai kedua mode
- `controller/controller-03-select.MP3` … `controller-07-finish.MP3`
- `hand/hand-03-select.MP3` … `hand-07-finish.MP3`

Huruf besar-kecil berpengaruh di server (`.MP3` ≠ `.mp3`). File yang tidak ada
dilewati tanpa suara — panduan tetap berjalan dengan teks.
