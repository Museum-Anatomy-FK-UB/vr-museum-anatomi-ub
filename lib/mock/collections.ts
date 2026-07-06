import type { Collection } from '@/lib/types/collection';

// Mock data koleksi untuk development sebelum API backend siap.
// collection_id di sini harus konsisten dengan collection_id di lib/mock/scenes.ts.
export const mockCollections: Record<string, Collection> = {
  'skull-001': {
    id: 'skull-001',
    name: 'Tengkorak Manusia',
    latin_name: 'Cranium',
    category: 'Sistem Rangka',
    description:
      'Tengkorak manusia tersusun atas 22 tulang yang melindungi otak dan ' +
      'membentuk struktur wajah. Terbagi menjadi neurocranium (pelindung otak) ' +
      'dan viscerocranium (tulang wajah).',
    photos: [
      { url: 'https://picsum.photos/seed/skull1/640/480', caption: 'Tampak depan' },
      { url: 'https://picsum.photos/seed/skull2/640/480', caption: 'Tampak samping' },
    ],
    audio_url: null,
    video_url: null,
    portal_url: 'https://museumanatomi.ub.ac.id/koleksi/skull-001',
  },
  'femur-001': {
    id: 'femur-001',
    name: 'Tulang Paha',
    latin_name: 'Os femoris',
    category: 'Sistem Rangka',
    description:
      'Femur adalah tulang terpanjang dan terkuat pada tubuh manusia, ' +
      'menghubungkan panggul dengan lutut dan menopang sebagian besar beban tubuh.',
    photos: [
      { url: 'https://picsum.photos/seed/femur1/640/480', caption: 'Tampak anterior' },
    ],
    audio_url: null,
    video_url: null,
    portal_url: 'https://museumanatomi.ub.ac.id/koleksi/femur-001',
  },
  'heart-001': {
    id: 'heart-001',
    name: 'Jantung',
    latin_name: 'Cor',
    category: 'Sistem Kardiovaskular',
    description:
      'Jantung adalah organ berotot yang memompa darah ke seluruh tubuh melalui ' +
      'sistem peredaran darah. Memiliki empat ruang: dua atrium dan dua ventrikel.',
    photos: [
      { url: 'https://picsum.photos/seed/heart1/640/480', caption: 'Tampak anterior' },
      { url: 'https://picsum.photos/seed/heart2/640/480', caption: 'Potongan koronal' },
    ],
    audio_url: null,
    video_url: null,
    portal_url: 'https://museumanatomi.ub.ac.id/koleksi/heart-001',
  },
};
