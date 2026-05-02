// src/lib/episodes.ts
// Utility for loading episode JSON files from /content/episodes/

export interface Episode {
  slug: string;
  title: string;
  pillar: 'latin-america' | 'forbidden-history' | 'lost-civilizations' | 'god-power';
  pillarLabel: string;
  language: 'es' | 'en';
  date: string;
  duration: string;
  youtube_id: string;
  spotify_id?: string;
  thumbnail: string;
  lat?: number;
  lng?: number;
  article_years?: number[];
  quick_answer: string;
  article_body: string;
  kdp_link?: string;
}

export const PILLAR_LABELS: Record<string, string> = {
  'latin-america':       'Latinoamérica Sin Censura',
  'forbidden-history':   'Forbidden History',
  'lost-civilizations':  'Lost Civilizations',
  'god-power':           'God & Power',
};

export const PILLAR_EMOJI: Record<string, string> = {
  'latin-america':       '🌎',
  'forbidden-history':   '🔍',
  'lost-civilizations':  '🏛️',
  'god-power':           '✝️',
};

export function formatDate(dateStr: string): string {
  return dateStr;
}
