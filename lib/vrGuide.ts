// VR guide (tutorial) content — shown in the headset when the visitor starts at
// the Main Location, and reopenable from the VR menu ("Panduan").
//
// Edit the wording here. `text` is what the panel shows (keep it short — it's
// read in a headset); `voiceOver` is the narration script for recording. The
// recorded file for each step goes in public/audio/guide/ under the `audio`
// file name — until a file exists the step simply plays without sound.
// The full recording script is also in docs/VR-GUIDE-VOICEOVER.md.

export type GuideMode = 'controller' | 'hand';

/** Which animated illustration a step shows (see components/vr/guideArt.ts). */
export type GuideArt =
  | 'welcome'
  | 'look'
  | 'controller-select'
  | 'controller-move'
  | 'controller-info'
  | 'controller-menu'
  | 'controller-finish'
  | 'hand-select'
  | 'hand-move'
  | 'hand-info'
  | 'hand-menu'
  | 'hand-finish';

export interface GuideStep {
  id: string;
  title: string;
  text: string;
  voiceOver: string;
  /** File path inside public/audio/guide/ (case-sensitive on the server) */
  audio: string;
  art: GuideArt;
}

export const GUIDE_AUDIO_BASE = '/audio/guide/';

const intro: GuideStep = {
  id: 'intro',
  title: 'Selamat datang di Virtual Museum Anatomi',
  text:
    'Panduan singkat ini menjelaskan cara menjelajah museum dalam mode VR. ' +
    'Pilih Berikutnya untuk lanjut, atau Lewati jika Anda sudah terbiasa.',
  voiceOver:
    'Selamat datang di Virtual Museum Anatomi Fakultas Kedokteran Universitas Brawijaya. ' +
    'Sebelum mulai menjelajah, ikuti panduan singkat ini untuk mengenal cara menggunakan mode VR. ' +
    'Pilih tombol Berikutnya untuk melanjutkan, atau pilih Lewati jika Anda sudah terbiasa.',
  audio: '01-intro.MP3',
  art: 'welcome',
};

const look: GuideStep = {
  id: 'look',
  title: 'Melihat sekeliling',
  text: 'Cukup putar kepala atau badan Anda untuk melihat seluruh ruangan 360°. Tidak perlu menekan apa pun.',
  voiceOver:
    'Untuk melihat sekeliling, cukup putar kepala atau badan Anda ke arah mana pun. ' +
    'Anda dapat melihat seluruh ruangan tiga ratus enam puluh derajat tanpa perlu menekan tombol apa pun.',
  audio: '02-look.MP3',
  art: 'look',
};

const MENU_ITEMS_TEXT = 'Isi menu: Main Location, All Location, Denah, Hotspot, Panduan, dan Keluar VR.';
const MENU_ITEMS_VO =
  'Dari menu ini Anda bisa kembali ke lokasi utama, melihat semua lokasi, membuka denah museum, ' +
  'menyembunyikan atau menampilkan hotspot, membuka panduan ini kembali, atau keluar dari mode VR.';

const controllerSteps: GuideStep[] = [
  {
    id: 'controller-select',
    title: 'Membidik dan memilih',
    text:
      'Arahkan laser dari controller ke sebuah objek, lalu tekan trigger — tombol di bawah jari telunjuk. ' +
      'Objek yang dibidik akan membesar dan lasernya berubah kuning.',
    voiceOver:
      'Sinar laser keluar dari ujung setiap controller. Arahkan laser ke objek yang ingin Anda pilih, ' +
      'lalu tekan tombol trigger, yaitu tombol di bawah jari telunjuk Anda. ' +
      'Objek yang sedang dibidik akan sedikit membesar, dan lasernya berubah menjadi kuning.',
    audio: 'controller/controller-03-select.MP3',
    art: 'controller-select',
  },
  {
    id: 'controller-move',
    title: 'Berpindah ruangan',
    text:
      'Ikon panah di lantai membawa Anda ke ruangan berikutnya. Bidik panahnya, lalu tekan trigger. ' +
      'Pandangan Anda langsung menghadap ke arah yang tepat.',
    voiceOver:
      'Ikon panah yang ada di lantai adalah jalan menuju ruangan berikutnya. ' +
      'Bidik panah tersebut dengan laser, lalu tekan trigger. ' +
      'Anda akan berpindah ke ruangan baru, dan pandangan Anda langsung menghadap ke arah yang tepat.',
    audio: 'controller/controller-04-move.MP3',
    art: 'controller-move',
  },
  {
    id: 'controller-info',
    title: 'Informasi koleksi',
    text:
      'Ikon (i) berisi informasi koleksi: foto, penjelasan, dan suara. ' +
      'Bidik ikonnya dan tekan trigger untuk membuka panel, lalu pilih Tutup untuk menutupnya.',
    voiceOver:
      'Ikon bertanda huruf i menyimpan informasi tentang koleksi anatomi, berupa foto, penjelasan, dan rekaman suara. ' +
      'Bidik ikon tersebut, lalu tekan trigger untuk membuka panelnya. ' +
      'Setelah selesai, pilih tombol Tutup.',
    audio: 'controller/controller-05-info.MP3',
    art: 'controller-info',
  },
  {
    id: 'controller-menu',
    title: 'Membuka menu',
    text: `Tekan tombol B atau Y untuk membuka menu, atau bidik tombol Menu di atas controller kiri. ${MENU_ITEMS_TEXT}`,
    voiceOver:
      'Untuk membuka menu, tekan tombol B atau tombol Y pada controller. ' +
      'Anda juga dapat membidik tombol Menu yang melayang di atas controller kiri. ' +
      MENU_ITEMS_VO,
    audio: 'controller/controller-06-menu.MP3',
    art: 'controller-menu',
  },
  {
    id: 'controller-finish',
    title: 'Siap menjelajah!',
    text:
      'Untuk keluar, pilih Keluar VR di menu atau tekan tombol Meta pada controller kanan. ' +
      'Panduan ini bisa dibuka lagi dari menu Panduan. Selamat menjelajah!',
    voiceOver:
      'Untuk keluar dari mode VR, pilih Keluar VR pada menu, atau tekan tombol Meta pada controller kanan. ' +
      'Panduan ini dapat dibuka kembali kapan saja melalui menu Panduan. ' +
      'Selamat menjelajahi Museum Anatomi Fakultas Kedokteran Universitas Brawijaya!',
    audio: 'controller/controller-07-finish.MP3',
    art: 'controller-finish',
  },
];

const handSteps: GuideStep[] = [
  {
    id: 'hand-select',
    title: 'Membidik dan memilih',
    text:
      'Laser keluar dari tangan Anda. Arahkan ke sebuah objek, lalu cubit — pertemukan ujung ibu jari ' +
      'dan jari telunjuk — untuk memilih.',
    voiceOver:
      'Saat menggunakan tangan, sinar laser keluar dari tangan Anda. ' +
      'Arahkan laser ke objek yang ingin Anda pilih, lalu lakukan gerakan mencubit, ' +
      'yaitu mempertemukan ujung ibu jari dengan ujung jari telunjuk. ' +
      'Objek yang sedang dibidik akan sedikit membesar, dan lasernya berubah menjadi kuning.',
    audio: 'hand/hand-03-select.MP3',
    art: 'hand-select',
  },
  {
    id: 'hand-move',
    title: 'Berpindah ruangan',
    text:
      'Ikon panah di lantai membawa Anda ke ruangan berikutnya. Arahkan laser ke panahnya, lalu cubit. ' +
      'Pandangan Anda langsung menghadap ke arah yang tepat.',
    voiceOver:
      'Ikon panah yang ada di lantai adalah jalan menuju ruangan berikutnya. ' +
      'Arahkan laser ke panah tersebut, lalu lakukan gerakan mencubit. ' +
      'Anda akan berpindah ke ruangan baru, dan pandangan Anda langsung menghadap ke arah yang tepat.',
    audio: 'hand/hand-04-move.MP3',
    art: 'hand-move',
  },
  {
    id: 'hand-info',
    title: 'Informasi koleksi & sentuh langsung',
    text:
      'Cubit ikon (i) untuk membuka informasi koleksi. Panel muncul dekat Anda, dan tombolnya ' +
      'bisa langsung disentuh dengan ujung jari telunjuk — seperti menekan tombol sungguhan.',
    voiceOver:
      'Ikon bertanda huruf i menyimpan informasi tentang koleksi anatomi. ' +
      'Arahkan laser ke ikon tersebut lalu cubit untuk membuka panelnya. ' +
      'Saat menggunakan tangan, panel akan muncul dekat dengan Anda, ' +
      'dan tombol-tombolnya bisa langsung Anda sentuh dengan ujung jari telunjuk, seperti menekan tombol sungguhan.',
    audio: 'hand/hand-05-info.MP3',
    art: 'hand-info',
  },
  {
    id: 'hand-menu',
    title: 'Membuka menu',
    text: `Angkat tangan kiri: tombol Menu muncul di atasnya. Sentuh tombol itu dengan telunjuk kanan. ${MENU_ITEMS_TEXT}`,
    voiceOver:
      'Untuk membuka menu, angkat tangan kiri Anda. Tombol Menu akan melayang di atas tangan kiri. ' +
      'Sentuh tombol tersebut dengan ujung jari telunjuk kanan. ' +
      MENU_ITEMS_VO,
    audio: 'hand/hand-06-menu.MP3',
    art: 'hand-menu',
  },
  {
    id: 'hand-finish',
    title: 'Siap menjelajah!',
    text:
      'Untuk keluar, pilih Keluar VR di menu, atau hadapkan telapak tangan ke wajah lalu cubit ikon Meta. ' +
      'Panduan ini bisa dibuka lagi dari menu Panduan. Selamat menjelajah!',
    voiceOver:
      'Untuk keluar dari mode VR, pilih Keluar VR pada menu, atau hadapkan telapak tangan ke wajah ' +
      'lalu cubit ikon Meta yang muncul. ' +
      'Panduan ini dapat dibuka kembali kapan saja melalui menu Panduan. ' +
      'Selamat menjelajahi Museum Anatomi Fakultas Kedokteran Universitas Brawijaya!',
    audio: 'hand/hand-07-finish.MP3',
    art: 'hand-finish',
  },
];

/** The steps for one input mode, in order. */
export function guideSteps(mode: GuideMode): GuideStep[] {
  return [intro, look, ...(mode === 'hand' ? handSteps : controllerSteps)];
}
