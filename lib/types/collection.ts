// Tipe data koleksi — dari kontrak GET /api/collections/:id (docs/API.md).
// Sumber data SAMA dengan Web Portal & Multimedia (satu sumber, tanpa duplikasi).

export interface CollectionPhoto {
  url: string;
  caption?: string;
}

export interface Collection {
  id: string;
  name: string;
  latin_name?: string;
  category?: string;
  description: string;
  photos: CollectionPhoto[];
  audio_url?: string | null;
  video_url?: string | null;
  portal_url?: string | null;
}
