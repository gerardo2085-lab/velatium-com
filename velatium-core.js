// velatium-core.js
// Version: 1.0
// Last updated: 2026-04-05
// Deploys to: BOTH
// Changes: Initial deploy — reading time, progress bar, dark mode, geo button highlight,
//          live feed rendering, returning visitor recognition, scroll-triggered CTA ladder,
//          related episodes engine, episode completion badges

'use strict';

/* ============================================================
   CONFIGURATION
   ============================================================ */
const VT = {
  gold: '#C8A951',
  gdrive_geo_webhook: '/api/geo',        // n8n WF-GEO webhook endpoint — update to your n8n URL
  feed_en: '/content-feed.EN.json',
  feed_es: '/content-feed.ES.json',
  proof_en: '/social-proof.EN.json',
  proof_es: '/social-proof.ES.json',
  lang: document.documentElement.lang || (location.hostname.endsWith('.net') ? 'es' : 'en'),
  ebook_url: 'https://a.co/d/01bFuDNp',
  newsletter_en: 'https://www.thevelatium.com/newsletter',
  newsletter_es: 'https://www.thevelatium.net/numero-003-es.html',
};

/* ============================================================
   01 — READING PROGRESS BAR
   Gold (#C8A951) line at top of article pages. Micro-commitment engine.
   ============================================================ */
function initProgressBar() {
  if (!document.querySelector('article, .article, [data-article]')) return;

  const bar = document.createElement('div');
  bar.id = 'vt-progress';
  bar.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 0%;
    height: 3px;
    background: ${VT.gold};
    z-index: 9999;
    transition: width 0.1s linear;
    pointer-events: none;
  `;
  document.body.prepend(bar);

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0;
    bar.style.width = pct + '%';
  }, { passive: true });
}

/* ============================================================
   02 — ESTIMATED READING TIME
   Injected below article title. Removes hesitation.
   ============================================================ */
function initReadingTime() {
  const article = document.querySelector('article, .article, [data-article]');
  if (!article) return;

  const text = article.innerText || '';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));

  const label = VT.lang === 'es'
    ? `${minutes} min de lectura`
    : `${minutes} min read`;

  // Find the best insertion point: after h1 or first p
  const target = article.querySelector('h1, h2');
  if (!target) return;

  const el = document.createElement('p');
  el.id = 'vt-reading-time';
  el.style.cssText = `
    font-size: 12px;
    letter-spacing: 0.2em;
    color: ${VT.gold};
    opacity: 0.75;
    margin: 8px 0 24px;
    font-family: monospace;
  `;
  el.textContent = label.toUpperCase();
  target.insertAdjacentElement('afterend', el);
}

/* ============================================================
   03 — GEO-AWARE LANGUAGE BUTTON HIGHLIGHT
   LatAm IPs → highlight .net button on .com site (and vice versa)
   No redirect. Visitor decides. Audience parity maintained.
   ============================================================ */
async function initGeoHighlight() {
  const langBtn = document.querySelector('[data-lang-switch], .lang-switch, #lang-switch, [href*="thevelatium.net"], [href*="thevelatium.com"]');
  if (!langBtn) return;

  try {
    // Try n8n geo webhook first
    const res = await fetch(VT.gdrive_geo_webhook, { method: 'GET' }).catch(() => null);
    if (res && res.ok) {
      const geo = await res.json();
      const shouldHighlight = (VT.lang === 'en' && geo.highlight_es) || (VT.lang === 'es' && geo.highlight_en);
      if (shouldHighlight) _applyGeoHighlight(langBtn);
      return;
    }
  } catch (_) {}

  // Fallback: direct ip-api.com call (no n8n required for initial deploy)
  try {
    const res = await fetch('https://ip-api.com/json/?fields=countryCode', { method: 'GET' });
    if (!res.ok) return;
    const { countryCode } = await res.json();
    const latamCountries = [
      'MX','CU','PR','DO','GT','BZ','HN','SV','NI','CR','PA',
      'CO','VE','EC','PE','BO','CL','AR','UY','PY','BR',
      'GY','SR','GF','TT','JM','HT','BB','LC','VC','GD','AG','DM','KN'
    ];
    const isLatam = latamCountries.includes(countryCode);
    const shouldHighlight = (VT.lang === 'en' && isLatam) || (VT.lang === 'es' && !isLatam);
    if (shouldHighlight) _applyGeoHighlight(langBtn);
  } catch (_) {}
}

function _applyGeoHighlight(btn) {
  btn.style.cssText += `
    border-color: ${VT.gold} !important;
    color: ${VT.gold} !important;
    box-shadow: 0 0 12px rgba(200,169,81,0.25);
    transition: all 0.3s ease;
  `;
  btn.setAttribute('data-geo-highlighted', 'true');
}

/* ============================================================
   04 — LIVE FEED RENDERING
   Reads content-feed.json, renders latest episode + newsletter on homepage.
   n8n WF-FEED keeps the JSON current. Site reads it on load.
   ============================================================ */
async function initLiveFeed() {
  const feedContainer = document.querySelector('[data-live-feed], #live-feed, .live-feed');
  if (!feedContainer) return;

  const feedUrl = VT.lang === 'es' ? VT.feed_es : VT.feed_en;

  try {
    const res = await fetch(feedUrl + '?t=' + Date.now());
    if (!res.ok) return;
    const feed = await res.json();

    const ep = feed.latest_episode;
    const nl = feed.latest_newsletter;
    if (!ep || !ep.title) return;

    const durationMin = ep.duration_seconds ? Math.round(ep.duration_seconds / 60) : null;
    const durationLabel = durationMin
      ? (VT.lang === 'es' ? `${durationMin} min` : `${durationMin} min`)
      : '';

    feedContainer.innerHTML = `
      <div class="vt-feed-episode" style="margin-bottom:32px;">
        <span style="font-family:monospace;font-size:10px;letter-spacing:0.35em;color:${VT.gold};opacity:0.7;">
          ${VT.lang === 'es' ? 'ÚLTIMO EPISODIO' : 'LATEST EPISODE'}
        </span>
        <a href="${ep.youtube_url}" target="_blank" rel="noopener" style="display:block;text-decoration:none;margin-top:10px;">
          ${ep.thumbnail_url ? `<img src="${ep.thumbnail_url}" alt="${ep.title}" style="width:100%;max-width:560px;border:1px solid rgba(200,169,81,0.2);display:block;margin-bottom:12px;">` : ''}
          <h3 style="color:#e8e0d0;font-size:18px;line-height:1.4;margin-bottom:6px;">${ep.title}</h3>
          <span style="font-family:monospace;font-size:11px;letter-spacing:0.15em;color:${VT.gold};opacity:0.6;">
            ${ep.series ? ep.series.toUpperCase() + ' · ' : ''}${ep.published_date}${durationLabel ? ' · ' + durationLabel : ''}
          </span>
          ${ep.description_short ? `<p style="margin-top:10px;font-size:14px;color:rgba(232,224,208,0.7);">${ep.description_short}</p>` : ''}
        </a>
      </div>
      ${nl && nl.title ? `
        <div class="vt-feed-newsletter">
          <span style="font-family:monospace;font-size:10px;letter-spacing:0.35em;color:${VT.gold};opacity:0.7;">
            ${VT.lang === 'es' ? 'ÚLTIMA CRÓNICA' : 'LATEST NEWSLETTER'}
          </span>
          <a href="${nl.url}" style="display:block;text-decoration:none;margin-top:8px;color:#e8e0d0;font-size:15px;">
            ${nl.issue_number ? `#${nl.issue_number} — ` : ''}${nl.title}
          </a>
          ${nl.preview_line ? `<p style="font-size:13px;color:rgba(232,224,208,0.6);margin-top:6px;">${nl.preview_line}</p>` : ''}
        </div>
      ` : ''}
    `;
  } catch (_) {}
}

/* ============================================================
   05 — SOCIAL PROOF COUNTER RENDERING
   Reads social-proof.json, renders current subscriber counts.
   n8n WF-SOCIALPROOF writes weekly. Site reads on load.
   ============================================================ */
async function initSocialProof() {
  const containers = document.querySelectorAll('[data-social-proof], .social-proof, #social-proof');
  if (!containers.length) return;

  const proofUrl = VT.lang === 'es' ? VT.proof_es : VT.proof_en;

  try {
    const res = await fetch(proofUrl + '?t=' + Date.now());
    if (!res.ok) return;
    const proof = await res.json();
    if (!proof.youtube_es && !proof.youtube_en) return;

    const totalYT = (proof.youtube_es || 0) + (proof.youtube_en || 0);
    const totalNL = (proof.newsletter_es || 0) + (proof.newsletter_en || 0);

    containers.forEach(el => {
      el.setAttribute('data-yt', _formatCount(totalYT));
      el.setAttribute('data-nl', _formatCount(totalNL));
      el.textContent = VT.lang === 'es'
        ? `${_formatCount(totalYT)} en YouTube · ${_formatCount(totalNL)} en el boletín`
        : `${_formatCount(totalYT)} on YouTube · ${_formatCount(totalNL)} newsletter readers`;
    });
  } catch (_) {}
}

function _formatCount(n) {
  if (!n || isNaN(n)) return '–';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return n.toString();
}

/* ============================================================
   06 — RETURNING VISITOR RECOGNITION
   Cookie-based. No accounts. Creates the feeling of being known.
   Visit 1 → default. Visit 2 → "Welcome back. Here's what you missed."
   Visit 3+ → KDP ebook surface in hero.
   ============================================================ */
function initReturningVisitor() {
  const hero = document.querySelector('[data-hero], .hero, #hero, header.hero');
  if (!hero) return;

  const stored = _getCookie('vt_visits');
  const count = stored ? parseInt(stored, 10) : 0;
  const newCount = count + 1;
  _setCookie('vt_visits', newCount, 365);

  if (newCount === 1) return; // First visit: show default, nothing changes

  // Find the hero tagline/subtitle element
  const tagline = hero.querySelector('[data-tagline], .tagline, .h-sub, p');
  if (!tagline) return;

  if (newCount === 2) {
    tagline.style.cssText += 'color:#e8e0d0;';
    tagline.textContent = VT.lang === 'es'
      ? 'Bienvenido de vuelta. Esto es lo que no viste.'
      : "Welcome back. Here's what you missed.";
    tagline.setAttribute('data-returning', 'true');
    // Trigger live feed to surface below hero if not already there
    document.dispatchEvent(new CustomEvent('vt:returning', { detail: { visits: newCount } }));
  }

  if (newCount >= 3) {
    // Surface ebook CTA in hero
    const existing = hero.querySelector('.vt-ebook-hero');
    if (existing) return;

    const ebookCta = document.createElement('a');
    ebookCta.href = VT.ebook_url;
    ebookCta.target = '_blank';
    ebookCta.rel = 'noopener';
    ebookCta.className = 'vt-ebook-hero';
    ebookCta.style.cssText = `
      display: inline-block;
      margin-top: 20px;
      padding: 10px 22px;
      border: 1px solid ${VT.gold};
      color: ${VT.gold};
      font-family: monospace;
      font-size: 11px;
      letter-spacing: 0.3em;
      text-decoration: none;
      text-transform: uppercase;
      transition: background 0.2s, color 0.2s;
    `;
    ebookCta.textContent = VT.lang === 'es'
      ? 'Llevas el regreso. Lee el libro.'
      : "You've read the evidence. Get the book.";
    ebookCta.addEventListener('mouseenter', () => {
      ebookCta.style.background = VT.gold;
      ebookCta.style.color = '#070708';
    });
    ebookCta.addEventListener('mouseleave', () => {
      ebookCta.style.background = 'transparent';
      ebookCta.style.color = VT.gold;
    });
    tagline.insertAdjacentElement('afterend', ebookCta);
  }
}

/* ============================================================
   07 — SCROLL-TRIGGERED CTA LADDER
   Psychological commitment ladder. CTAs appear at the right moment.
   0–40%: nothing. 60%: pull quote. 80%: newsletter teaser. 100%+30s: newsletter CTA.
   ============================================================ */
function initScrollCTA() {
  const article = document.querySelector('article, .article, [data-article]');
  if (!article) return;

  let triggered60 = false;
  let triggered80 = false;
  let triggered100 = false;
  let dwellTimer = null;

  // Pull quote: highest-impact sentence or data point
  const pullQuote = article.getAttribute('data-pull-quote') || '';

  const nlUrl = VT.lang === 'es' ? VT.newsletter_es : VT.newsletter_en;
  const ebookUrl = VT.ebook_url;

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const pct = total > 0 ? (scrolled / total) * 100 : 0;

    // 60% — Pull quote surfaces. No CTA.
    if (pct >= 60 && !triggered60) {
      triggered60 = true;
      if (pullQuote) {
        _injectPullQuote(pullQuote, article);
      }
    }

    // 80% — "Lo Que No Cabe en el Video" teaser
    if (pct >= 80 && !triggered80) {
      triggered80 = true;
      _injectNewsletterTeaser(article, nlUrl);
    }

    // 100% — start 30s dwell timer, then full newsletter CTA
    if (pct >= 99 && !triggered100) {
      triggered100 = true;
      dwellTimer = setTimeout(() => {
        _injectNewsletterCTA(nlUrl);
      }, 30000);
    }
  }, { passive: true });
}

function _injectPullQuote(quote, article) {
  const el = document.createElement('blockquote');
  el.className = 'vt-pull-quote';
  el.style.cssText = `
    border-left: 3px solid ${VT.gold};
    padding: 20px 28px;
    margin: 32px 0;
    background: rgba(200,169,81,0.05);
    font-size: 19px;
    font-style: italic;
    color: #e8e0d0;
    line-height: 1.6;
    animation: vt-fade-in 0.6s ease both;
  `;
  el.textContent = quote;
  _ensureAnimation();

  // Insert at 60% scroll position in the article
  const paras = article.querySelectorAll('p');
  const insertAfter = paras[Math.floor(paras.length * 0.6)] || paras[paras.length - 1];
  if (insertAfter) insertAfter.insertAdjacentElement('afterend', el);
}

function _injectNewsletterTeaser(article, nlUrl) {
  if (document.querySelector('.vt-nl-teaser')) return;
  const label = VT.lang === 'es'
    ? 'Lo Que No Cabe en el Video'
    : "What Didn't Fit in the Video";
  const sub = VT.lang === 'es'
    ? 'El detalle que enterraron. Solo en el boletín.'
    : 'The detail they buried. Newsletter subscribers only.';
  const cta = VT.lang === 'es' ? 'Quiero el resto →' : 'I want the rest →';

  const el = document.createElement('div');
  el.className = 'vt-nl-teaser';
  el.style.cssText = `
    border: 1px solid rgba(200,169,81,0.3);
    background: rgba(200,169,81,0.05);
    padding: 22px 26px;
    margin: 32px 0;
    animation: vt-fade-in 0.5s ease both;
  `;
  el.innerHTML = `
    <span style="font-family:monospace;font-size:9px;letter-spacing:0.4em;color:${VT.gold};display:block;margin-bottom:8px;">
      ${label.toUpperCase()}
    </span>
    <p style="font-size:15px;color:rgba(232,224,208,0.9);margin-bottom:14px;">${sub}</p>
    <a href="${nlUrl}" style="font-family:monospace;font-size:11px;letter-spacing:0.2em;color:${VT.gold};text-decoration:none;">${cta}</a>
  `;
  _ensureAnimation();

  const paras = article.querySelectorAll('p');
  const last = paras[paras.length - 1];
  if (last) last.insertAdjacentElement('afterend', el);
}

function _injectNewsletterCTA(nlUrl) {
  if (document.querySelector('.vt-nl-cta')) return;
  const proofEl = document.querySelector('[data-social-proof]');
  const proof = proofEl ? proofEl.textContent : '';
  const headline = VT.lang === 'es'
    ? 'La historia no termina aquí.'
    : "History doesn't stop here.";
  const sub = VT.lang === 'es'
    ? `El siguiente capítulo ya está esperando.${proof ? '<br><span style="font-size:12px;opacity:0.6;">' + proof + '</span>' : ''}`
    : `The next chapter is already waiting.${proof ? '<br><span style="font-size:12px;opacity:0.6;">' + proof + '</span>' : ''}`;
  const cta = VT.lang === 'es' ? 'Unirme al boletín' : 'Join the newsletter';

  const el = document.createElement('div');
  el.className = 'vt-nl-cta';
  el.style.cssText = `
    position: fixed;
    bottom: 24px; right: 24px;
    max-width: 320px;
    background: #111018;
    border: 1px solid rgba(200,169,81,0.4);
    padding: 22px 24px;
    z-index: 9000;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5);
    animation: vt-slide-up 0.4s ease both;
  `;
  el.innerHTML = `
    <button onclick="this.parentElement.remove()" style="
      position:absolute;top:10px;right:12px;
      background:none;border:none;color:rgba(232,224,208,0.4);
      cursor:pointer;font-size:18px;line-height:1;
    ">&times;</button>
    <p style="font-size:16px;font-weight:600;color:#e8e0d0;margin-bottom:8px;">${headline}</p>
    <p style="font-size:13px;color:rgba(232,224,208,0.7);margin-bottom:16px;line-height:1.5;">${sub}</p>
    <a href="${nlUrl}" target="_blank" style="
      display:block;text-align:center;padding:10px;
      background:${VT.gold};color:#070708;
      font-family:monospace;font-size:11px;letter-spacing:0.25em;
      text-decoration:none;text-transform:uppercase;
    ">${cta}</a>
  `;
  _ensureAnimation();
  document.body.appendChild(el);
}

/* ============================================================
   08 — RELATED EPISODES ENGINE
   Rule-based matching by pillar and series. No ML. No server needed.
   Reads content graph from content-feed.json recent_episodes array.
   ============================================================ */
async function initRelatedEpisodes() {
  const container = document.querySelector('[data-related-episodes], .related-episodes, #related-episodes');
  if (!container) return;

  const currentSlug = container.getAttribute('data-current-slug') || '';
  const currentPillar = container.getAttribute('data-pillar') || '';
  const currentSeries = container.getAttribute('data-series') || '';
  const feedUrl = VT.lang === 'es' ? VT.feed_es : VT.feed_en;

  try {
    const res = await fetch(feedUrl + '?t=' + Date.now());
    if (!res.ok) return;
    const feed = await res.json();
    const all = feed.recent_episodes || [];
    if (!all.length) return;

    // Match: same series first, then same pillar, excluding current
    const related = [
      ...all.filter(e => e.series === currentSeries && e.slug !== currentSlug),
      ...all.filter(e => e.pillar === currentPillar && e.series !== currentSeries && e.slug !== currentSlug),
    ].slice(0, 3);

    if (!related.length) return;

    const label = VT.lang === 'es' ? 'TAMBIÉN EN THE VELATIUM' : 'ALSO FROM THE VELATIUM';
    container.innerHTML = `
      <p style="font-family:monospace;font-size:10px;letter-spacing:0.35em;color:${VT.gold};opacity:0.7;margin-bottom:20px;">${label}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
        ${related.map(ep => `
          <a href="/${ep.slug}.html" style="text-decoration:none;border:1px solid rgba(200,169,81,0.15);padding:16px;display:block;background:rgba(255,255,255,0.02);">
            ${ep.thumbnail_url ? `<img src="${ep.thumbnail_url}" alt="${ep.title}" style="width:100%;margin-bottom:10px;display:block;">` : ''}
            <span style="font-family:monospace;font-size:9px;letter-spacing:0.3em;color:${VT.gold};opacity:0.6;display:block;margin-bottom:6px;">${ep.series || ep.pillar || ''}</span>
            <span style="font-size:14px;color:#e8e0d0;line-height:1.4;display:block;">${ep.title}</span>
          </a>
        `).join('')}
      </div>
    `;
  } catch (_) {}
}

/* ============================================================
   09 — EPISODE COMPLETION BADGES (Silent Gamification)
   localStorage. No accounts. Quiet acknowledgment. One CTA: the ebook.
   ============================================================ */
const ARCS = {
  cuba: {
    slugs: ['cuba-ep1','cuba-ep2','cuba-ep3','cuba-ep4','cuba-ep5','cuba-ep6'],
    label_en: "You've completed the Cuba Arc.",
    label_es: 'Completaste el Arco Cuba.',
  }
};

function initCompletionBadges() {
  // Mark current article as read
  const article = document.querySelector('article, .article, [data-article]');
  const slug = document.body.getAttribute('data-slug') || '';
  if (article && slug) {
    _markRead(slug);
    _checkArcCompletion(slug);
  }
}

function _markRead(slug) {
  try {
    const read = JSON.parse(localStorage.getItem('vt_read') || '[]');
    if (!read.includes(slug)) {
      read.push(slug);
      localStorage.setItem('vt_read', JSON.stringify(read));
    }
  } catch (_) {}
}

function _checkArcCompletion(currentSlug) {
  try {
    const read = JSON.parse(localStorage.getItem('vt_read') || '[]');
    const celebrated = JSON.parse(localStorage.getItem('vt_celebrated') || '[]');

    for (const [arcId, arc] of Object.entries(ARCS)) {
      if (!arc.slugs.includes(currentSlug)) continue;
      if (celebrated.includes(arcId)) continue;
      const allRead = arc.slugs.every(s => read.includes(s));
      if (!allRead) continue;

      // Arc complete — quiet acknowledgment
      celebrated.push(arcId);
      localStorage.setItem('vt_celebrated', JSON.stringify(celebrated));

      const label = VT.lang === 'es' ? arc.label_es : arc.label_en;
      const ctaText = VT.lang === 'es' ? 'Lee el libro completo.' : 'Read the full book.';

      const badge = document.createElement('div');
      badge.className = 'vt-arc-badge';
      badge.style.cssText = `
        margin: 48px 0;
        padding: 24px 28px;
        border: 1px solid ${VT.gold};
        background: rgba(200,169,81,0.05);
        text-align: center;
        animation: vt-fade-in 0.8s ease both;
      `;
      badge.innerHTML = `
        <p style="font-family:monospace;font-size:10px;letter-spacing:0.4em;color:${VT.gold};margin-bottom:10px;">
          ✦ ${label.toUpperCase()}
        </p>
        <a href="${VT.ebook_url}" target="_blank" style="
          font-family:monospace;font-size:11px;letter-spacing:0.25em;
          color:${VT.gold};text-decoration:none;border-bottom:1px solid rgba(200,169,81,0.4);
        ">${ctaText}</a>
      `;
      _ensureAnimation();

      const article = document.querySelector('article, .article, [data-article]');
      if (article) article.appendChild(badge);
    }
  } catch (_) {}
}

/* ============================================================
   10 — DARK MODE TOGGLE
   Persists in localStorage. No flash on load.
   ============================================================ */
function initDarkMode() {
  // The Velatium is dark-first. This toggle allows light reading mode.
  const toggle = document.querySelector('[data-dark-toggle], #dark-toggle, .dark-toggle');
  if (!toggle) return;

  const stored = localStorage.getItem('vt_theme');
  if (stored === 'light') _applyLight();

  toggle.addEventListener('click', () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('vt_theme', 'dark');
    } else {
      _applyLight();
      localStorage.setItem('vt_theme', 'light');
    }
  });
}

function _applyLight() {
  document.documentElement.setAttribute('data-theme', 'light');
}

/* ============================================================
   UTILITIES
   ============================================================ */
function _setCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + (days * 86400000));
  document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/;SameSite=Lax`;
}

function _getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

let _animationInjected = false;
function _ensureAnimation() {
  if (_animationInjected) return;
  _animationInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes vt-fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes vt-slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   INIT — DOM READY
   ============================================================ */
function init() {
  initProgressBar();
  initReadingTime();
  initDarkMode();
  initReturningVisitor();
  initCompletionBadges();

  // Async: geo highlight, live feed, social proof, related episodes, scroll CTA
  initGeoHighlight();
  initLiveFeed();
  initSocialProof();
  initRelatedEpisodes();
  initScrollCTA();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
