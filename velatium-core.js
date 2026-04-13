// velatium-core.js
// Version: 1.1
// Last updated: 2026-04-06
// Deploys to: BOTH
// Changes: Production build — reading time, progress bar, geo button highlight,
//          live feed rendering, social proof counter, returning visitor recognition,
//          scroll-triggered CTA ladder, related episodes engine,
//          episode completion badges, dark mode toggle

'use strict';

/* ============================================================
   CONFIGURATION
   ============================================================ */
const VT = {
  gold: '#C8A951',
  geo_webhook: '/api/geo',
  lang: document.documentElement.lang || (location.hostname.endsWith('.net') ? 'es' : 'en'),
  ebook_url: 'https://a.co/d/01bFuDNp',
  newsletter_en: '/#notify',
  newsletter_es: '/#notify',
  latam_countries: [
    'MX','CU','PR','DO','GT','BZ','HN','SV','NI','CR','PA',
    'CO','VE','EC','PE','BO','CL','AR','UY','PY','BR',
    'GY','SR','GF','TT','JM','HT','BB','LC','VC','GD','AG','DM','KN'
  ],
};

VT.feed_url   = VT.lang === 'es' ? '/content-feed.ES.json'   : '/content-feed.EN.json';
VT.proof_url  = VT.lang === 'es' ? '/social-proof.ES.json'   : '/social-proof.EN.json';
VT.nl_url     = VT.lang === 'es' ? VT.newsletter_es          : VT.newsletter_en;

/* ============================================================
   01 — READING PROGRESS BAR
   Gold line at top of article pages.
   Activates only when [data-article] exists.
   ============================================================ */
function initProgressBar() {
  if (!document.querySelector('[data-article]')) return;
  const bar = document.createElement('div');
  bar.id = 'vt-progress';
  bar.style.cssText = [
    'position:fixed;top:0;left:0;width:0%;height:3px',
    'background:' + VT.gold,
    'z-index:9999;transition:width 0.1s linear;pointer-events:none'
  ].join(';');
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0) + '%';
  }, { passive: true });
}

/* ============================================================
   02 — ESTIMATED READING TIME
   Injected after first heading inside [data-article].
   Activates only when [data-article] exists.
   ============================================================ */
function initReadingTime() {
  const article = document.querySelector('[data-article]');
  if (!article) return;
  const words = (article.innerText || '').trim().split(/\s+/).length;
  const mins  = Math.max(1, Math.round(words / 200));
  const label = VT.lang === 'es' ? `${mins} min de lectura` : `${mins} min read`;
  const target = article.querySelector('h1, h2');
  if (!target) return;
  const el = document.createElement('p');
  el.id = 'vt-reading-time';
  el.style.cssText = [
    'font-size:12px;letter-spacing:0.2em',
    'color:' + VT.gold,
    'opacity:0.75;margin:8px 0 24px;font-family:monospace'
  ].join(';');
  el.textContent = label.toUpperCase();
  target.insertAdjacentElement('afterend', el);
}

/* ============================================================
   03 — GEO-AWARE LANGUAGE BUTTON HIGHLIGHT
   LatAm IPs → highlight .net button on .com (and vice versa).
   No redirect. No forced switch. Visitor decides.
   Falls back to direct ip-api.com if n8n WF-GEO not live yet.
   ============================================================ */
async function initGeoHighlight() {
  const btn = document.querySelector('[data-lang-switch]');
  if (!btn) return;
  try {
    const res = await fetch(VT.geo_webhook).catch(() => null);
    if (res && res.ok) {
      const geo = await res.json();
      const hit = (VT.lang === 'en' && geo.highlight_es) || (VT.lang === 'es' && geo.highlight_en);
      if (hit) _geoHighlight(btn);
      return;
    }
  } catch (_) {}
  try {
    const res = await fetch('https://ip-api.com/json/?fields=countryCode');
    if (!res.ok) return;
    const { countryCode } = await res.json();
    const isLatam = VT.latam_countries.includes(countryCode);
    const hit = (VT.lang === 'en' && isLatam) || (VT.lang === 'es' && !isLatam);
    if (hit) _geoHighlight(btn);
  } catch (_) {}
}

function _geoHighlight(btn) {
  btn.style.cssText += [
    'border-color:' + VT.gold + '!important',
    'color:' + VT.gold + '!important',
    'box-shadow:0 0 12px rgba(200,169,81,0.25)',
    'transition:all 0.3s ease'
  ].join(';');
  btn.setAttribute('data-geo-highlighted', 'true');
}

/* ============================================================
   04 — LIVE FEED RENDERING
   Reads content-feed.json, renders latest episode + newsletter
   inside [data-live-feed]. Renders nothing if feed is empty.
   n8n WF-FEED keeps JSON current on every publish.
   ============================================================ */
async function initLiveFeed() {
  const container = document.querySelector('[data-live-feed]');
  if (!container) return;
  try {
    const res = await fetch(VT.feed_url + '?t=' + Date.now());
    if (!res.ok) return;
    const feed = await res.json();
    const ep = feed.latest_episode;
    const nl = feed.latest_newsletter;
    if (!ep || !ep.title) return;

    const durMin = ep.duration_seconds ? Math.round(ep.duration_seconds / 60) : null;
    const latestLabel = VT.lang === 'es' ? 'ÚLTIMO EPISODIO' : 'LATEST EPISODE';
    const nlLabel     = VT.lang === 'es' ? 'ÚLTIMA CRÓNICA'  : 'LATEST NEWSLETTER';

    container.innerHTML = `
      <div style="margin-bottom:2rem;">
        <span style="font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.35em;color:${VT.gold};opacity:0.8;display:block;margin-bottom:1rem;">${latestLabel}</span>
        <a href="${ep.youtube_url || '#'}" target="_blank" rel="noopener" style="display:block;text-decoration:none;">
          ${ep.thumbnail_url ? `<img src="${ep.thumbnail_url}" alt="${ep.title}" style="width:100%;max-width:560px;display:block;margin-bottom:1rem;border:1px solid rgba(212,160,23,0.2);">` : ''}
          <p style="font-family:'Cinzel',serif;font-size:0.9rem;color:#F5EDD6;line-height:1.4;margin-bottom:0.5rem;letter-spacing:0.03em;">${ep.title}</p>
          <span style="font-family:'Cinzel',serif;font-size:0.55rem;letter-spacing:0.2em;color:${VT.gold};opacity:0.6;text-transform:uppercase;">
            ${ep.series ? ep.series + ' · ' : ''}${ep.published_date || ''}${durMin ? ' · ' + durMin + ' min' : ''}
          </span>
          ${ep.description_short ? `<p style="font-family:'Crimson Pro',serif;font-size:1rem;color:rgba(200,184,138,0.75);margin-top:0.8rem;font-style:italic;line-height:1.6;">${ep.description_short}</p>` : ''}
        </a>
      </div>
      ${nl && nl.title ? `
      <div>
        <span style="font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.35em;color:${VT.gold};opacity:0.8;display:block;margin-bottom:0.8rem;">${nlLabel}</span>
        <a href="${nl.url || '#'}" style="text-decoration:none;display:block;">
          <p style="font-family:'Cinzel',serif;font-size:0.8rem;color:#F5EDD6;letter-spacing:0.03em;">${nl.issue_number ? '#' + nl.issue_number + ' — ' : ''}${nl.title}</p>
          ${nl.preview_line ? `<p style="font-family:'Crimson Pro',serif;font-size:0.95rem;color:rgba(200,184,138,0.6);margin-top:0.4rem;font-style:italic;">${nl.preview_line}</p>` : ''}
        </a>
      </div>` : ''}
    `;
  } catch (_) {}
}

/* ============================================================
   05 — SOCIAL PROOF COUNTER
   Reads social-proof.json, renders subscriber counts
   inside [data-social-proof].
   n8n WF-SOCIALPROOF writes every Monday 09:00 UTC.
   ============================================================ */
async function initSocialProof() {
  const els = document.querySelectorAll('[data-social-proof]');
  if (!els.length) return;
  try {
    const res = await fetch(VT.proof_url + '?t=' + Date.now());
    if (!res.ok) return;
    const p = await res.json();
    if (!p.youtube_es && !p.youtube_en) return;
    const yt = _fmt((p.youtube_es || 0) + (p.youtube_en || 0));
    const nl = _fmt((p.newsletter_es || 0) + (p.newsletter_en || 0));
    const text = VT.lang === 'es'
      ? `${yt} en YouTube · ${nl} en el boletín`
      : `${yt} on YouTube · ${nl} newsletter readers`;
    els.forEach(el => { el.textContent = text; });
  } catch (_) {}
}

function _fmt(n) {
  if (!n || isNaN(n)) return '–';
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : String(n);
}

/* ============================================================
   06 — RETURNING VISITOR RECOGNITION
   Cookie-based. No accounts required.
   Visit 1 → default. Visit 2 → hero tagline changes.
   Visit 3+ → ebook CTA surfaces in hero.
   ============================================================ */
function initReturningVisitor() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const count = (_getCookie('vt_visits') ? parseInt(_getCookie('vt_visits'), 10) : 0) + 1;
  _setCookie('vt_visits', count, 365);
  if (count === 1) return;
  const tagline = hero.querySelector('[data-tagline]');
  if (tagline) {
    tagline.style.color = '#F5EDD6';
    tagline.innerHTML = VT.lang === 'es'
      ? '"Bienvenido de vuelta.<br>Esto es lo que no viste."'
      : '"Welcome back.<br>Here\'s what you missed."';
  }
  if (count >= 3) {
    const existing = hero.querySelector('.vt-ebook-hero');
    if (existing) return;
    const cta = document.createElement('a');
    cta.href = VT.ebook_url;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.className = 'vt-ebook-hero';
    cta.style.cssText = [
      'display:inline-block;margin-top:1.5rem;padding:0.6rem 1.4rem',
      'border:1px solid ' + VT.gold,
      'color:' + VT.gold,
      'font-family:"Cinzel",serif;font-size:0.6rem;letter-spacing:0.25em',
      'text-decoration:none;text-transform:uppercase;transition:all 0.3s'
    ].join(';');
    cta.textContent = VT.lang === 'es'
      ? 'Llevas el regreso. Lee el libro.'
      : "You've read the evidence. Get the book.";
    cta.addEventListener('mouseenter', () => { cta.style.background = VT.gold; cta.style.color = '#080510'; });
    cta.addEventListener('mouseleave', () => { cta.style.background = 'transparent'; cta.style.color = VT.gold; });
    if (tagline) tagline.insertAdjacentElement('afterend', cta);
  }
}

/* ============================================================
   07 — SCROLL-TRIGGERED CTA LADDER
   0–40%: nothing. 60%: pull quote. 80%: newsletter teaser.
   100% + 30s dwell: newsletter CTA popup.
   Activates only when [data-article] exists.
   ============================================================ */
function initScrollCTA() {
  const article = document.querySelector('[data-article]');
  if (!article) return;
  const pullQuote = article.getAttribute('data-pull-quote') || '';
  let t60 = false, t80 = false, t100 = false, dwell = null;

  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct   = total > 0 ? (window.scrollY / total) * 100 : 0;
    if (pct >= 60 && !t60) { t60 = true; if (pullQuote) _injectPullQuote(pullQuote, article); }
    if (pct >= 80 && !t80) { t80 = true; _injectNlTeaser(article); }
    if (pct >= 99 && !t100) { t100 = true; dwell = setTimeout(_injectNlCTA, 30000); }
  }, { passive: true });
}

function _injectPullQuote(quote, article) {
  _ensureAnim();
  const el = document.createElement('blockquote');
  el.className = 'vt-pull-quote';
  el.style.cssText = [
    'border-left:3px solid ' + VT.gold,
    'padding:1.2rem 1.8rem;margin:2rem 0',
    'background:rgba(45,8,84,0.25)',
    'font-family:"Crimson Pro",serif;font-size:1.2rem;font-style:italic',
    'color:#F5EDD6;line-height:1.6',
    'animation:vt-fade-in 0.6s ease both'
  ].join(';');
  el.textContent = quote;
  const paras = article.querySelectorAll('p');
  const after = paras[Math.floor(paras.length * 0.6)] || paras[paras.length - 1];
  if (after) after.insertAdjacentElement('afterend', el);
}

function _injectNlTeaser(article) {
  if (document.querySelector('.vt-nl-teaser')) return;
  _ensureAnim();
  const label = VT.lang === 'es' ? 'Lo Que No Cabe en el Video' : "What Didn't Fit in the Video";
  const sub   = VT.lang === 'es' ? 'El detalle que enterraron. Solo en el boletín.' : 'The detail they buried. Newsletter subscribers only.';
  const cta   = VT.lang === 'es' ? 'Quiero el resto →' : 'I want the rest →';
  const el = document.createElement('div');
  el.className = 'vt-nl-teaser';
  el.style.cssText = [
    'border:1px solid rgba(212,160,23,0.3)',
    'background:rgba(212,160,23,0.05)',
    'padding:1.5rem 1.8rem;margin:2rem 0',
    'animation:vt-fade-in 0.5s ease both'
  ].join(';');
  el.innerHTML = `
    <span style="font-family:'Cinzel',serif;font-size:0.55rem;letter-spacing:0.4em;color:${VT.gold};display:block;margin-bottom:0.6rem;text-transform:uppercase;">${label}</span>
    <p style="font-family:'Crimson Pro',serif;font-size:1rem;color:rgba(200,184,138,0.9);margin-bottom:0.8rem;font-style:italic;">${sub}</p>
    <a href="${VT.nl_url}" style="font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.2em;color:${VT.gold};text-decoration:none;">${cta}</a>
  `;
  const paras = article.querySelectorAll('p');
  const last = paras[paras.length - 1];
  if (last) last.insertAdjacentElement('afterend', el);
}

function _injectNlCTA() {
  if (document.querySelector('.vt-nl-cta')) return;
  _ensureAnim();
  const headline = VT.lang === 'es' ? 'La historia no termina aquí.' : "History doesn't stop here.";
  const sub      = VT.lang === 'es' ? 'El próximo capítulo ya está esperando.' : 'The next chapter is already waiting.';
  const cta      = VT.lang === 'es' ? 'Unirme al boletín' : 'Join the newsletter';
  const el = document.createElement('div');
  el.className = 'vt-nl-cta';
  el.style.cssText = [
    'position:fixed;bottom:24px;right:24px;max-width:300px',
    'background:#0E0A1A;border:1px solid rgba(212,160,23,0.4)',
    'padding:1.5rem 1.6rem;z-index:9000',
    'box-shadow:0 8px 40px rgba(0,0,0,0.6)',
    'animation:vt-slide-up 0.4s ease both'
  ].join(';');
  el.innerHTML = `
    <button onclick="this.parentElement.remove()" style="position:absolute;top:8px;right:12px;background:none;border:none;color:rgba(200,184,138,0.4);cursor:pointer;font-size:1.1rem;line-height:1;">&times;</button>
    <p style="font-family:'Cinzel',serif;font-size:0.85rem;color:#F5EDD6;margin-bottom:0.5rem;line-height:1.4;">${headline}</p>
    <p style="font-family:'Crimson Pro',serif;font-size:0.95rem;color:rgba(200,184,138,0.7);margin-bottom:1rem;font-style:italic;">${sub}</p>
    <a href="${VT.nl_url}" style="display:block;text-align:center;padding:0.7rem;background:${VT.gold};color:#080510;font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.25em;text-decoration:none;text-transform:uppercase;">${cta}</a>
  `;
  document.body.appendChild(el);
}

/* ============================================================
   08 — RELATED EPISODES ENGINE
   Rule-based: same series first, then same pillar.
   Reads recent_episodes[] from content-feed.json.
   Renders inside [data-related-episodes].
   ============================================================ */
async function initRelatedEpisodes() {
  const container = document.querySelector('[data-related-episodes]');
  if (!container) return;
  const currentSlug   = document.body.getAttribute('data-slug')   || '';
  const currentPillar = document.body.getAttribute('data-pillar') || '';
  const currentSeries = document.body.getAttribute('data-series') || '';
  try {
    const res = await fetch(VT.feed_url + '?t=' + Date.now());
    if (!res.ok) return;
    const feed = await res.json();
    const all  = feed.recent_episodes || [];
    if (!all.length) return;
    const related = [
      ...all.filter(e => e.series === currentSeries && e.slug !== currentSlug),
      ...all.filter(e => e.pillar === currentPillar && e.series !== currentSeries && e.slug !== currentSlug),
    ].slice(0, 3);
    if (!related.length) return;
    const label = VT.lang === 'es' ? 'TAMBIÉN EN THE VELATIUM' : 'ALSO FROM THE VELATIUM';
    container.innerHTML = `
      <div style="margin:3rem 0;padding-top:2rem;border-top:1px solid rgba(212,160,23,0.1);">
        <span style="font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.35em;color:${VT.gold};opacity:0.7;display:block;margin-bottom:1.5rem;text-transform:uppercase;">${label}</span>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
          ${related.map(ep => `
            <a href="/${ep.slug}.html" style="text-decoration:none;border:1px solid rgba(212,160,23,0.12);padding:1.2rem;display:block;background:rgba(13,8,26,0.5);transition:border-color 0.3s;">
              ${ep.thumbnail_url ? `<img src="${ep.thumbnail_url}" alt="${ep.title}" style="width:100%;display:block;margin-bottom:0.8rem;">` : ''}
              <span style="font-family:'Cinzel',serif;font-size:0.5rem;letter-spacing:0.25em;color:${VT.gold};opacity:0.6;display:block;margin-bottom:0.4rem;text-transform:uppercase;">${ep.series || ep.pillar || ''}</span>
              <span style="font-family:'Cinzel',serif;font-size:0.75rem;color:#F5EDD6;line-height:1.4;display:block;">${ep.title}</span>
            </a>
          `).join('')}
        </div>
      </div>
    `;
  } catch (_) {}
}

/* ============================================================
   09 — EPISODE COMPLETION BADGES (Silent Gamification)
   localStorage only. No accounts. No leaderboards.
   Quiet acknowledgment when arc is complete. One CTA: the book.
   ============================================================ */
const VT_ARCS = {
  'cuba-arc': {
    slugs: ['video-001-es','video-002-es','video-003-es','video-004-es','video-005-es','video-006-es',
            'video-001-en','video-002-en','video-003-en','video-004-en','video-005-en','video-006-en'],
    label_en: "You've completed the Cuba Arc.",
    label_es: 'Completaste el Arco Cuba.',
  }
};

function initCompletionBadges() {
  const slug = document.body.getAttribute('data-slug') || '';
  if (!slug) return;
  _markRead(slug);
  _checkArc(slug);
}

function _markRead(slug) {
  try {
    const read = JSON.parse(localStorage.getItem('vt_read') || '[]');
    if (!read.includes(slug)) { read.push(slug); localStorage.setItem('vt_read', JSON.stringify(read)); }
  } catch (_) {}
}

function _checkArc(currentSlug) {
  try {
    const read       = JSON.parse(localStorage.getItem('vt_read') || '[]');
    const celebrated = JSON.parse(localStorage.getItem('vt_celebrated') || '[]');
    for (const [arcId, arc] of Object.entries(VT_ARCS)) {
      if (!arc.slugs.includes(currentSlug)) continue;
      if (celebrated.includes(arcId)) continue;
      if (!arc.slugs.every(s => read.includes(s))) continue;
      celebrated.push(arcId);
      localStorage.setItem('vt_celebrated', JSON.stringify(celebrated));
      _ensureAnim();
      const label = VT.lang === 'es' ? arc.label_es : arc.label_en;
      const cta   = VT.lang === 'es' ? 'Lee el libro completo.' : 'Read the full book.';
      const badge = document.createElement('div');
      badge.style.cssText = [
        'margin:3rem 0;padding:1.5rem 1.8rem',
        'border:1px solid ' + VT.gold,
        'background:rgba(212,160,23,0.05);text-align:center',
        'animation:vt-fade-in 0.8s ease both'
      ].join(';');
      badge.innerHTML = `
        <p style="font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.4em;color:${VT.gold};margin-bottom:0.8rem;text-transform:uppercase;">✦ ${label}</p>
        <a href="${VT.ebook_url}" target="_blank" style="font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.25em;color:${VT.gold};text-decoration:none;border-bottom:1px solid rgba(212,160,23,0.4);text-transform:uppercase;">${cta}</a>
      `;
      const article = document.querySelector('[data-article]');
      if (article) article.appendChild(badge);
    }
  } catch (_) {}
}

/* ============================================================
   10 — DARK MODE TOGGLE
   Persists in localStorage. Opt-in only — Velatium is dark-first.
   ============================================================ */
function initDarkMode() {
  const toggle = document.querySelector('[data-dark-toggle]');
  if (!toggle) return;
  if (localStorage.getItem('vt_theme') === 'light') document.documentElement.setAttribute('data-theme', 'light');
  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('vt_theme', 'dark'); }
    else { document.documentElement.setAttribute('data-theme', 'light'); localStorage.setItem('vt_theme', 'light'); }
  });
}

/* ============================================================
   UTILITIES
   ============================================================ */
function _setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 86400000);
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}
function _getCookie(name) {
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return m ? m[2] : null;
}

let _animInjected = false;
function _ensureAnim() {
  if (_animInjected) return;
  _animInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes vt-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes vt-slide-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(s);
}

/* ============================================================
   INIT
   ============================================================ */
function _init() {
  initProgressBar();
  initReadingTime();
  initDarkMode();
  initReturningVisitor();
  initCompletionBadges();
  initGeoHighlight();
  initLiveFeed();
  initSocialProof();
  initRelatedEpisodes();
  initScrollCTA();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', _init)
  : _init();
