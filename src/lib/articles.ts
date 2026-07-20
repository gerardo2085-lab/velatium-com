// src/lib/articles.ts
// Utility for loading article JSON files from /content/articles/. Mirrors
// src/lib/episodes.ts's pattern — same 4 pillar values, reused directly
// rather than duplicated (see PILLAR_LABELS/PILLAR_EMOJI in episodes.ts).
// Rendering foundation only — the publish pipeline that writes these files
// (weekly article routine) is future work, not built here.

export interface Article {
  slug: string;
  title: string;
  pillar: 'latin-america' | 'forbidden-history' | 'lost-civilizations' | 'god-power';
  language: 'es' | 'en';
  date: string;
  quick_answer: string;
  article_body: string;
  kdp_link?: string;
  hero_image?: string;
  sources?: string[];
  lat?: number;
  lng?: number;
}
