// velatium-push.js
// Version: 1.0
// Last updated: 2026-04-05
// Deploys to: BOTH
// Changes: Initial deploy — web push service worker and subscription handler
//          Works with OneSignal free tier (up to 10,000 subscribers)
//          Rule: max 1 push per week, new episodes only, never promotional

'use strict';

/* ============================================================
   CONFIGURATION
   Update VT_PUSH_CONFIG before deploying.
   Add OneSignal App ID to velatium-config.json, then here.
   ============================================================ */
const VT_PUSH_CONFIG = {
  onesignal_app_id: 'YOUR_ONESIGNAL_APP_ID',   // From velatium-config.json push.onesignal_app_id
  safari_web_id: '',                             // Optional — from OneSignal if Safari is enabled
  permission_prompt_delay_ms: 3000,             // Don't ask immediately — let them read first
  storage_key: 'vt_push_subscribed',
  gold: '#C8A951',
};

/* ============================================================
   ONESIGNAL INITIALIZATION
   Only runs once. Only asks after article reach (3s delay).
   Shows branded prompt, not browser native dialog immediately.
   ============================================================ */
function initWebPush() {
  // Only show on article pages. Never on homepage on first visit.
  const isArticle = !!document.querySelector('article, .article, [data-article]');
  if (!isArticle) return;

  // Don't ask if already subscribed
  if (localStorage.getItem(VT_PUSH_CONFIG.storage_key) === 'true') return;

  // Load OneSignal SDK
  const script = document.createElement('script');
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  script.defer = true;
  document.head.appendChild(script);

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(function(OneSignal) {
    OneSignal.init({
      appId: VT_PUSH_CONFIG.onesignal_app_id,
      safari_web_id: VT_PUSH_CONFIG.safari_web_id || undefined,
      notifyButton: { enable: false },        // We control the UI
      autoResubscribe: true,
      promptOptions: {
        slidedown: {
          prompts: [
            {
              type: 'push',
              autoPrompt: false,              // We trigger manually with our CTA
              text: {
                actionMessage: document.documentElement.lang === 'es'
                  ? 'Recibe el próximo capítulo prohibido cuando salga.'
                  : 'Get notified when the next forbidden chapter drops.',
                acceptButton: document.documentElement.lang === 'es'
                  ? 'Sí, avísame'
                  : 'Notify me',
                cancelButton: document.documentElement.lang === 'es'
                  ? 'Ahora no'
                  : 'Not now',
              },
            }
          ]
        }
      },
    });

    // Show branded prompt after delay — only after scroll engagement
    setTimeout(() => {
      _showBrandedPushPrompt(OneSignal);
    }, VT_PUSH_CONFIG.permission_prompt_delay_ms);

    // Track subscription state
    OneSignal.User.PushSubscription.addEventListener('change', (event) => {
      if (event.current.optedIn) {
        localStorage.setItem(VT_PUSH_CONFIG.storage_key, 'true');
        _removePushPrompt();
      }
    });
  });
}

/* ============================================================
   BRANDED PUSH PROMPT
   Shown only after 3s dwell. Respects the audience's autonomy.
   Not the browser native dialog — our branded UI first.
   ============================================================ */
function _showBrandedPushPrompt(OneSignal) {
  if (document.querySelector('.vt-push-prompt')) return;

  const lang = document.documentElement.lang || 'en';
  const headline = lang === 'es'
    ? 'El próximo capítulo prohibido.'
    : 'The next forbidden chapter.';
  const sub = lang === 'es'
    ? 'Una notificación. Solo cuando sale un episodio nuevo.'
    : 'One notification. Only when a new episode drops.';
  const accept = lang === 'es' ? 'Avísame' : 'Notify me';
  const decline = lang === 'es' ? 'No, gracias' : 'No thanks';

  const prompt = document.createElement('div');
  prompt.className = 'vt-push-prompt';
  prompt.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 24px;
    max-width: 300px;
    background: #111018;
    border: 1px solid rgba(200,169,81,0.35);
    padding: 20px 22px;
    z-index: 8999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    animation: vt-slide-up 0.4s ease both;
  `;

  prompt.innerHTML = `
    <span style="display:block;font-family:monospace;font-size:9px;letter-spacing:0.4em;color:${VT_PUSH_CONFIG.gold};margin-bottom:10px;">THE VELATIUM</span>
    <p style="font-size:14px;font-weight:600;color:#e8e0d0;margin-bottom:6px;line-height:1.4;">${headline}</p>
    <p style="font-size:12px;color:rgba(232,224,208,0.6);margin-bottom:16px;line-height:1.5;">${sub}</p>
    <div style="display:flex;gap:10px;align-items:center;">
      <button id="vt-push-accept" style="
        flex:1;padding:9px 12px;
        background:${VT_PUSH_CONFIG.gold};color:#070708;
        border:none;cursor:pointer;
        font-family:monospace;font-size:10px;letter-spacing:0.25em;
        text-transform:uppercase;
      ">${accept}</button>
      <button id="vt-push-decline" style="
        background:none;border:none;cursor:pointer;
        font-family:monospace;font-size:10px;letter-spacing:0.15em;
        color:rgba(232,224,208,0.4);
        text-transform:uppercase;
        white-space:nowrap;
      ">${decline}</button>
    </div>
  `;

  // Inject animation if not already present
  const style = document.createElement('style');
  style.textContent = `@keyframes vt-slide-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(style);

  document.body.appendChild(prompt);

  document.getElementById('vt-push-accept').addEventListener('click', async () => {
    _removePushPrompt();
    // This triggers the actual browser permission dialog via OneSignal
    try {
      await OneSignal.Slidedown.promptPush();
    } catch (_) {
      // If OneSignal slidedown fails, use native
      try { await OneSignal.User.PushSubscription.optIn(); } catch (_) {}
    }
  });

  document.getElementById('vt-push-decline').addEventListener('click', () => {
    _removePushPrompt();
    // Don't ask again for 30 days
    const expiry = Date.now() + (30 * 86400000);
    localStorage.setItem('vt_push_dismissed', expiry.toString());
  });
}

function _removePushPrompt() {
  const el = document.querySelector('.vt-push-prompt');
  if (el) el.remove();
}

/* ============================================================
   INIT
   ============================================================ */
function initPush() {
  // Don't show if user dismissed within 30 days
  const dismissed = localStorage.getItem('vt_push_dismissed');
  if (dismissed && Date.now() < parseInt(dismissed, 10)) return;

  // Don't show if already subscribed
  if (localStorage.getItem(VT_PUSH_CONFIG.storage_key) === 'true') return;

  // Initialize on article pages only
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebPush);
  } else {
    initWebPush();
  }
}

initPush();
