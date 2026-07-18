// Collection data types — from the GET /api/collections/:id contract (docs/API.md).
// SAME data source as the Web Portal & Multimedia (single source, no duplication).

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
