// velatium-push.js
// Version: 1.1
// Last updated: 2026-04-06
// Deploys to: BOTH
// Changes: Production build — OneSignal web push, branded opt-in prompt,
//          article-page only, max 1 push per week, never promotional

'use strict';

const VT_PUSH = {
  app_id: 'YOUR_ONESIGNAL_APP_ID',
  delay_ms: 4000,
  storage_key: 'vt_push_subscribed',
  dismissed_key: 'vt_push_dismissed',
  gold: '#C8A951',
};

function _isArticlePage() {
  return !!document.querySelector('[data-article]');
}

function _isDismissed() {
  const d = localStorage.getItem(VT_PUSH.dismissed_key);
  return d && Date.now() < parseInt(d, 10);
}

function _isSubscribed() {
  return localStorage.getItem(VT_PUSH.storage_key) === 'true';
}

function initPush() {
  if (!_isArticlePage()) return;
  if (_isSubscribed()) return;
  if (_isDismissed()) return;

  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  document.head.appendChild(script);

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(function(OneSignal) {
    OneSignal.init({
      appId: VT_PUSH.app_id,
      notifyButton: { enable: false },
      autoResubscribe: true,
    });

    setTimeout(() => _showPrompt(OneSignal), VT_PUSH.delay_ms);

    OneSignal.User.PushSubscription.addEventListener('change', (e) => {
      if (e.current.optedIn) {
        localStorage.setItem(VT_PUSH.storage_key, 'true');
        _removePrompt();
      }
    });
  });
}

function _showPrompt(OneSignal) {
  if (document.querySelector('.vt-push-prompt')) return;

  const lang = document.documentElement.lang || 'en';
  const headline = lang === 'es' ? 'El próximo capítulo prohibido.' : 'The next forbidden chapter.';
  const sub      = lang === 'es'
    ? 'Una notificación. Solo cuando sale un episodio nuevo.'
    : 'One notification. Only when a new episode drops.';
  const accept  = lang === 'es' ? 'Avísame' : 'Notify me';
  const decline = lang === 'es' ? 'No, gracias' : 'No thanks';

  const anim = document.createElement('style');
  anim.textContent = '@keyframes vt-slide-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(anim);

  const el = document.createElement('div');
  el.className = 'vt-push-prompt';
  el.style.cssText = [
    'position:fixed;bottom:24px;left:24px;max-width:280px',
    'background:#0E0A1A;border:1px solid rgba(212,160,23,0.35)',
    'padding:1.4rem 1.5rem;z-index:8999',
    'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
    'animation:vt-slide-up 0.4s ease both'
  ].join(';');
  el.innerHTML = `
    <span style="display:block;font-family:'Cinzel',serif;font-size:0.5rem;letter-spacing:0.4em;color:${VT_PUSH.gold};margin-bottom:0.8rem;text-transform:uppercase;">THE VELATIUM</span>
    <p style="font-family:'Cinzel',serif;font-size:0.8rem;color:#F5EDD6;margin-bottom:0.4rem;line-height:1.4;">${headline}</p>
    <p style="font-family:'Crimson Pro',serif;font-size:0.9rem;color:rgba(200,184,138,0.65);margin-bottom:1.2rem;line-height:1.5;font-style:italic;">${sub}</p>
    <div style="display:flex;gap:0.8rem;align-items:center;">
      <button id="vt-push-accept" style="flex:1;padding:0.65rem;background:${VT_PUSH.gold};color:#080510;border:none;cursor:pointer;font-family:'Cinzel',serif;font-size:0.55rem;letter-spacing:0.25em;text-transform:uppercase;">${accept}</button>
      <button id="vt-push-decline" style="background:none;border:none;cursor:pointer;font-family:'Cinzel',serif;font-size:0.52rem;letter-spacing:0.15em;color:rgba(200,184,138,0.4);text-transform:uppercase;white-space:nowrap;">${decline}</button>
    </div>
  `;
  document.body.appendChild(el);

  document.getElementById('vt-push-accept').addEventListener('click', async () => {
    _removePrompt();
    try { await OneSignal.Slidedown.promptPush(); } catch (_) {
      try { await OneSignal.User.PushSubscription.optIn(); } catch (_) {}
    }
  });

  document.getElementById('vt-push-decline').addEventListener('click', () => {
    _removePrompt();
    localStorage.setItem(VT_PUSH.dismissed_key, String(Date.now() + 30 * 86400000));
  });
}

function _removePrompt() {
  const el = document.querySelector('.vt-push-prompt');
  if (el) el.remove();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initPush)
  : initPush();
