import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Search, Plus, X, Star, ArrowRightLeft, Package, CheckCircle2, Clock, MapPin, LogOut, Loader2, Bell, MessageCircle, Send, Menu } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { IS_PREVIEW, IS_INTEGRATION, API_BASE, storage } from './runtime';
import { previewRequest } from './preview/api';
import { Home, Layers, Users, MoreHorizontal, ChevronRight, ArrowRight, ArrowLeft, Settings, Trophy, Moon, Sun, HelpCircle, Camera, Truck, ShieldCheck, Sparkles, History, UserRound } from 'lucide-react';
import { configureRevenueCat, purchaseFounderPackage } from './revenuecat';

// =================================================================
// API CLIENT
// Point API_BASE at your deployed backend. Every call goes through
// `request()`, which attaches the auth token and normalizes errors.
// =================================================================
// API_BASE is explicit release configuration; previews use in-memory fixtures.

// Temporarily disabled while the Founder Membership In-App Purchase
// works through Apple review as its own submission (see Apple's
// 2.1(b) rejection re: an app referencing a purchase that hasn't
// been submitted). Hides every "Become a Founder" entry point and
// skips RevenueCat setup entirely, without touching the underlying
// integration - flip back to true once the IAP is approved and
// properly attached to a submission.
const FOUNDER_ENABLED = false;

const AuthContext = createContext(null);
const ThemeContext = createContext({ dark: false, toggle: () => {} });
const AlbumContext = createContext({ albumId: 1, albums: [], setAlbumId: () => {} });

function useAuth() {
  return useContext(AuthContext);
}

function useTheme() {
  return useContext(ThemeContext);
}

function useAlbum() {
  return useContext(AlbumContext);
}

async function request(path, { method = 'GET', body, token } = {}) {
  if (IS_PREVIEW && !IS_INTEGRATION) return previewRequest(path, { method, body, token });
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.stale = data?.stale || false;
    err.autoDeclined = data?.autoDeclined || false;
    err.swapId = data?.swapId || null;
    throw err;
  }
  return data;
}

const api = {
  signup: (name, email, password, inviteCode, referralCode) => request('/auth/signup', { method: 'POST', body: { name, email, password, inviteCode, referralCode } }),
  getReferral: (token) => request('/auth/me/referral', { token }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/auth/me', { token }),
  updateMe: (token, fields) => request('/auth/me', { method: 'PUT', body: fields, token }),
  deleteAccount: (token) => request('/auth/me', { method: 'DELETE', token }),
  verifyEmail: (verificationToken) => request('/auth/verify-email', { method: 'POST', body: { token: verificationToken } }),
  resendVerification: (token) => request('/auth/resend-verification', { method: 'POST', token }),
  getStats: () => request('/stats'),
  getActivity: () => request('/activity'),
  getUnreadMessageCount: (token) => request('/messages', { token }).then(convos => convos.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0)).catch(() => 0),
  getVapidKey: () => request('/push/vapid-public-key'),
  subscribePush: (token, subscription, isStandalone) => request('/push/subscribe', { method: 'POST', body: { subscription, isStandalone }, token }),
  trackInstall: (token) => request('/push/track-install', { method: 'POST', token }),
  trackNativeAppOpen: (token) => request('/push/track-native-open', { method: 'POST', token }),
  registerDeviceToken: (token, deviceToken) => request('/push/register-device', { method: 'POST', body: { deviceToken }, token }),

  getAlbums: () => request('/albums'),

  searchStickers: (token, { search, team, albumId = 1 } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (team) params.set('team', team);
    params.set('albumId', albumId);
    return request(`/stickers?${params.toString()}`, { token });
  },
  getTeams: (token, albumId = 1) => request(`/stickers/teams?albumId=${albumId}`, { token }),
  getMyDuplicates: (token, albumId = 1) => request(`/stickers/me/duplicates?albumId=${albumId}`, { token }),
  addDuplicate: (token, stickerId, quantity) =>
    request('/stickers/me/duplicates', { method: 'POST', body: { stickerId, quantity }, token }),
  updateDuplicateQty: (token, stickerId, quantity) =>
    request('/stickers/me/duplicates', { method: 'POST', body: { stickerId, quantity }, token }),
  addDuplicatesBulk: (token, stickerIds) =>
    request('/stickers/me/duplicates/bulk', { method: 'POST', body: { stickerIds }, token }),
  removeDuplicate: (token, stickerId) =>
    request(`/stickers/me/duplicates/${stickerId}`, { method: 'DELETE', token }),
  getMyNeeds: (token, albumId = 1) => request(`/stickers/me/needs?albumId=${albumId}`, { token }),
  addNeed: (token, stickerId) => request('/stickers/me/needs', { method: 'POST', body: { stickerId }, token }),
  addNeedsBulk: (token, stickerIds) =>
    request('/stickers/me/needs/bulk', { method: 'POST', body: { stickerIds }, token }),
  removeNeed: (token, stickerId) => request(`/stickers/me/needs/${stickerId}`, { method: 'DELETE', token }),
  clearAllStickers: (token, albumId = 1) => request(`/stickers/me/all?albumId=${albumId}`, { method: 'DELETE', token }),

  getMatches: (token, albumId = 1) => request(`/swaps/matches?albumId=${albumId}`, { token }),
  getMySwaps: (token, albumId = 1) => request(`/swaps/mine?albumId=${albumId}`, { token }),
  getSwapPreview: (token, matchId) => request(`/swaps/preview/${matchId}`, { token }),
  createSwap: (token, matchId) => request('/swaps', { method: 'POST', body: { matchId }, token }),
  getSwap: (token, swapId) => request(`/swaps/${swapId}`, { token }),
  acceptSwap: (token, swapId) => request(`/swaps/${swapId}/accept`, { method: 'POST', token }),
  declineSwap: (token, swapId, reason) => request(`/swaps/${swapId}/decline`, { method: 'POST', body: { reason }, token }),
  withdrawSwap: (token, swapId) => request(`/swaps/${swapId}/withdraw`, { method: 'POST', token }),
  markPosted: (token, swapId, photo) => request(`/swaps/${swapId}/posted`, { method: 'POST', body: { photo }, token }),
  uploadStickerPhoto: (token, swapId, photo) => request(`/swaps/${swapId}/sticker-photo`, { method: 'POST', body: { photo }, token }),
  submitAmbassador: (token, swapId) => request('/ambassador/submit', { method: 'POST', body: { swapId }, token }),
  getAmbassadorStatus: (token) => request('/ambassador/status', { token }),
  markReceived: (token, swapId) => request(`/swaps/${swapId}/received`, { method: 'POST', token }),
  awardAmbassadorBadge: (token) => request('/auth/me', { method: 'PUT', body: { has_shared_facebook: true }, token }),

  submitRating: (token, swapId, stars, comment) =>
    request('/ratings', { method: 'POST', body: { swapId, stars, comment }, token }),
  getUserRatings: (token, userId) => request(`/ratings/user/${userId}`, { token }),
  getUserStats: (token, userId) => request(`/swaps/stats/${userId}`, { token }),
  getFounderStatus: (token) => request('/founder/status', { token }),
  getFounderCount: () => request('/founder/count'),
  createFounderCheckout: (token) => request('/founder/checkout', { method: 'POST', token }),

  getAppLaunchStatus: (token) => request('/app-launch/status', { token }),
  registerAppLaunchInterest: (token) => request('/app-launch/notify', { method: 'POST', token }),
  trackAppStoreClick: (token, source) => request('/app-launch/track-click', { method: 'POST', body: { source }, token }),

  getAndroidTesterStatus: (token) => request('/android-testers/status', { token }),
  signupAndroidTester: (token, googleEmail) => request('/android-testers/signup', { method: 'POST', body: { googleEmail }, token }),
  getAndroidTesterPublicStatus: () => request('/android-testers/public-status'),
  signupAndroidTesterPublic: (name, googleEmail) => request('/android-testers/public-signup', { method: 'POST', body: { name, googleEmail } }),

  fileDispute: (token, swapId, reason, details) =>
    request('/disputes', { method: 'POST', body: { swapId, reason, details }, token }),
  getMyDisputes: (token) => request('/disputes/me', { token }),

  getMessages: (token, swapId) => request(`/swaps/${swapId}/messages`, { token }),
  sendMessage: (token, swapId, body) =>
    request(`/swaps/${swapId}/messages`, { method: 'POST', body: { body }, token }),

  getNotifications: (token) => request('/notifications', { token }),
  markAllRead: (token) => request('/notifications/read', { method: 'POST', token }),
  markOneRead: (token, id) => request(`/notifications/${id}/read`, { method: 'POST', token }),

  submitFeedback: (token, message, page) =>
    request('/feedback', { method: 'POST', body: { message, page }, token }),

  logDonationClick: (token, location) =>
    request('/donations/click', { method: 'POST', body: { location }, token }).catch(() => {}),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
  getConversations: (token) => request('/messages', { token }),
  startConversation: (token, recipientId, body) => request('/messages', { method: 'POST', body: { recipientId, body }, token }),
  getConversationMessages: (token, conversationId) => request(`/messages/${conversationId}`, { token }),
  sendDirectMessage: (token, conversationId, body) => request(`/messages/${conversationId}/send`, { method: 'POST', body: { body }, token }),
  reportMessage: (token, messageId, reason) => request(`/messages/${messageId}/report`, { method: 'POST', body: { reason }, token }),
  getBlockedUsers: (token) => request('/messages/blocked', { token }),
  blockUser: (token, userId) => request(`/messages/block/${userId}`, { method: 'POST', token }),
  unblockUser: (token, userId) => request(`/messages/block/${userId}`, { method: 'DELETE', token }),
  getSwapHistory: (token, albumId = 1) => request(`/swaps/history?albumId=${albumId}`, { token }),
  getBadges: (token, userId) => request(`/badges/${userId}`, { token }),
  searchUsers: (token, q) => request(`/auth/search?q=${encodeURIComponent(q)}`, { token }),
  getMyReports: (token) => request('/reports/mine', { token }),
  withdrawReport: (token, reportId) => request(`/reports/${reportId}`, { method: 'DELETE', token }),
};

// =================================================================
// DESIGN TOKENS
// New palette matching the modern teal/blue/white reference design.
// Injected as CSS custom properties so every component can use them
// without prop-drilling colors through every element.
// =================================================================
const DESIGN_TOKENS = `
:root { --primary:#174a7b; --primary-light:#eaf3ff; --primary-dark:#082d58; --blue:#287ce4; --blue-light:#eaf3ff; --navy:#082d58; --bg:#f3f7fc; --surface:#fff; --border:#dfe9f4; --text-primary:#092852; --text-secondary:#4e6380; --text-muted:#61748e; --danger:#c93443; --danger-light:#fff0f1; --warning:#ffcf25; --warning-light:#fff8db; --success:#00835b; --success-light:#dcf8eb; --gold:#a46e04; --gold-light:#fff3ca; --radius-sm:12px; --radius-md:18px; --radius-lg:24px; --radius-full:999px; }
[data-theme="dark"] { --bg:#04192e; --surface:#0c2c4b; --border:#23435f; --text-primary:#f3f8ff; --text-secondary:#c0d1e5; --text-muted:#9eb7d1; --primary:#a9cfff; --primary-light:#163d63; --primary-dark:#24609a; --blue-light:#11385b; --danger-light:#442332; --warning-light:#3b3522; --success-light:#123e32; --gold-light:#3f341d; }
body { background:var(--bg); color:var(--text-primary); font-family:'Nunito',ui-rounded,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; -webkit-font-smoothing:antialiased; }
* { box-sizing:border-box; } button { cursor:pointer; border:none; background:none; padding:0; font:inherit; } input,textarea,select { font:inherit; } button:focus-visible,a:focus-visible,summary:focus-visible { outline:3px solid #287ce4; outline-offset:3px; } input:focus,textarea:focus,select:focus { outline:2px solid #287ce4; outline-offset:2px; } input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),textarea,select { font-size:16px!important; }
`;

// =================================================================
// LOGO — square rounded mark with two overlapping stickers
// =================================================================
// Native dialog supplies focus containment and Escape handling; actions remain explicit.
function confirmAction(message) {
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'action-confirmation';
    const title = document.createElement('h2');
    title.id = 'action-confirmation-title';
    title.textContent = 'Please confirm';
    dialog.setAttribute('aria-labelledby', title.id);
    const body = document.createElement('p');
    body.textContent = message;
    const actions = document.createElement('div');
    const cancel = document.createElement('button');
    cancel.textContent = 'Cancel';
    cancel.autofocus = true;
    const proceed = document.createElement('button');
    proceed.textContent = 'Confirm';
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      previousFocus?.focus();
      resolve(value);
    };
    cancel.onclick = () => finish(false);
    proceed.onclick = () => finish(true);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    actions.append(cancel, proceed);
    dialog.append(title, body, actions);
    document.body.append(dialog);
    dialog.showModal();
  });
}

function Logo({ size = 60 }) {
  return <img src="/design/wordmark.png" alt="Got One Spare?" className="gos-logo" style={{ width: size * 1.65, height: size }} />;
}
function StickerArt() {
  return <div aria-hidden="true" className="sticker-back"><Layers size={28} /><span>GOT ONE SPARE?</span></div>;
}
function CollectorAvatar({ person, size = 42 }) {
  return <span className="collector-avatar" style={{ width: size, height: size }}>
    {person?.profile_photo ? <img src={person.profile_photo} alt="" /> : <span>{(person?.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('')}</span>}
  </span>;
}
function AlbumCover({ album, small = false }) {
  const league = album?.id === 2;
  return <div aria-hidden="true" className={`album-cover ${league ? 'league' : ''} ${small ? 'small' : ''}`}>
    <span className="cover-kicker">COLLECTOR EDITION</span>
    <div className="cover-emblem">{league ? <ShieldCheck /> : <Trophy />}</div>
    <strong className="cover-title"><span className="cover-category">{league ? "MEN'S" : " "}</span>{league ? <>PREMIER<br />LEAGUE</> : <>WORLD CUP</>}<span>{league ? 'TRADING CARDS' : 'STICKERS'}</span></strong>
    <span className="cover-season">{league ? '2026/27' : '2026'}</span>
    <div className="cover-ribbon" />
  </div>;
}
// =================================================================
// Shared UI pieces
// =================================================================
function StickerCard({ sticker, onAdd, onRemove, onUpdateQty, qtyOverride, mode = 'duplicate' }) {
  const qty = qtyOverride ?? sticker.quantity;
  const isNeed = mode === 'need';
  const teamAccent = ({ England: '#df4054', France: '#3974dc', Spain: '#e3a817', Germany: '#718096', Brazil: '#13a779', Argentina: '#56b5df' })[sticker.team_name] || '#438bc2';
  return <article className={`sticker-card ${isNeed ? 'needed' : ''}`} style={{ '--team-accent': teamAccent }}>
    <div className="sticker-picture album-pocket">
      <span className="pocket-label">{isNeed ? 'WANTED' : 'SPARE'}</span>
      <span className="pocket-number">{sticker.sticker_number}</span>
      <span className="pocket-emblem" aria-hidden="true"><ShieldCheck size={23} /></span>
      <span className="pocket-team">{sticker.team_name}</span>
    </div>
    <div className="sticker-caption"><strong>{sticker.description || `Sticker ${sticker.sticker_number}`}</strong></div>
    {onUpdateQty && qty !== undefined ? <div className="quantity-controls"><button aria-label={`Remove one spare of ${sticker.sticker_number}`} onClick={e => { e.stopPropagation(); if (qty <= 1) onRemove?.(); else onUpdateQty(qty - 1); }}>−</button><span>{qty} spare{qty === 1 ? '' : 's'}</span><button aria-label={`Add one spare of ${sticker.sticker_number}`} onClick={e => { e.stopPropagation(); onUpdateQty(qty + 1); }}>+</button></div> : onRemove && <button className="sticker-remove" aria-label={`Remove ${sticker.sticker_number} from ${isNeed ? 'needs' : 'spares'}`} onClick={onRemove}><X size={14} /> Remove</button>}
    {onAdd && <button className="sticker-add" aria-label={`Add sticker ${sticker.sticker_number}`} onClick={onAdd}><Plus size={22} /></button>}
  </article>;
}

function ActivityTicker() {
  const [events, setEvents] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const load = () => api.getActivity().then(data => {
      if (data?.length) setEvents(data);
    }).catch(() => {});
    load();
    const refresh = setInterval(load, 60000);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    const rotate = setInterval(() => setIdx(i => (i + 1) % events.length), 12000);
    return () => clearInterval(rotate);
  }, [events.length]);

  if (!events.length) return null;

  const event = events[idx];
  const emoji = event.type === 'swap_completed' ? '✅' : event.type === 'swap_agreed' ? '🤝' : '🎉';

  return (
    <div style={{ background: 'var(--navy)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 32 }}>
      <span style={{ fontSize: 13 }}>{emoji}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600, transition: 'opacity 0.3s' }}>{event.label}</span>
    </div>
  );
}

function InstallAndNotifyBanner() {
  const [show, setShow] = useState(false);
  const [variant, setVariant] = useState(null); // 'ios-install' | 'android-install' | 'notifications-blocked'
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    // Already a real native app — "add to home screen" doesn't apply.
    if (Capacitor.isNativePlatform()) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;

    const dismissedAt = parseInt(storage.getItem('install_banner_dismissed_at') || '0', 10);
    const cooledDown = Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000;

    if (!cooledDown) return;

    const timer = setTimeout(() => {
      if (isIOS && !isStandalone) {
        setVariant('ios-install');
        setShow(true);
      } else if (isAndroid && !isStandalone && deferredPromptRef.current) {
        setVariant('android-install');
        setShow(true);
      } else if ('Notification' in window && Notification.permission === 'denied') {
        setVariant('notifications-blocked');
        setShow(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    storage.setItem('install_banner_dismissed_at', String(Date.now()));
  };

  const installAndroid = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return dismiss();
    promptEvent.prompt();
    try { await promptEvent.userChoice; } catch {}
    deferredPromptRef.current = null;
    dismiss();
  };

  if (!show) return null;

  const BENEFITS = "Get notified the instant someone matches with you or accepts a swap — so you don't lose out to a faster swapper.";
  const wrapStyle = { position: 'fixed', bottom: 90, left: 12, right: 70, zIndex: 300, background: 'var(--navy)', borderRadius: 12, padding: '14px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'flex-start', gap: 12 };
  const iconStyle = { width: 44, height: 44, borderRadius: 10, flexShrink: 0 };
  const titleStyle = { fontSize: 13, fontWeight: 800, color: 'white', marginBottom: 3 };
  const bodyStyle = { fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 };
  const benefitStyle = { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, marginTop: 6, fontStyle: 'italic' };
  const closeStyle = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, fontSize: 18, lineHeight: 1, flexShrink: 0 };

  if (variant === 'ios-install') {
    return (
      <div style={wrapStyle}>
        <img src="/icon-192.png" alt="" style={iconStyle} />
        <div style={{ flex: 1 }}>
          <div style={titleStyle}>Add to Home Screen for instant alerts</div>
          <div style={bodyStyle}>
            1. Tap the <strong style={{ color: 'white' }}>Share icon</strong> <span style={{ fontSize: 14 }}>⬆</span> at the bottom of Safari<br />
            2. Tap <strong style={{ color: 'white' }}>"View More"</strong><br />
            3. Tap <strong style={{ color: 'white' }}>"Add to Home Screen"</strong>
          </div>
          <div style={benefitStyle}>{BENEFITS}</div>
        </div>
        <button onClick={dismiss} style={closeStyle}>×</button>
      </div>
    );
  }

  if (variant === 'android-install') {
    return (
      <div style={wrapStyle}>
        <img src="/icon-192.png" alt="" style={iconStyle} />
        <div style={{ flex: 1 }}>
          <div style={titleStyle}>Install the app for instant alerts</div>
          <div style={benefitStyle}>{BENEFITS}</div>
          <button onClick={installAndroid} style={{ marginTop: 8, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Install app
          </button>
        </div>
        <button onClick={dismiss} style={closeStyle}>×</button>
      </div>
    );
  }

  const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div style={wrapStyle}>
      <img src="/icon-192.png" alt="" style={iconStyle} />
      <div style={{ flex: 1 }}>
        <div style={titleStyle}>Turn notifications back on</div>
        <div style={bodyStyle}>
          {isIOSDevice
            ? <>Go to <strong style={{ color: 'white' }}>Settings → Notifications → Got One Spare?</strong> and turn Allow Notifications on.</>
            : <>Tap the <strong style={{ color: 'white' }}>lock/info icon</strong> next to the address bar → Permissions → Notifications → Allow.</>}
        </div>
        <div style={benefitStyle}>{BENEFITS}</div>
      </div>
      <button onClick={dismiss} style={closeStyle}>×</button>
    </div>
  );
}

function CommunityBanner() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    const load = () => api.getStats().then(setStats).catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);
  if (!stats) return null;
  return (
    <div style={{ background: 'var(--navy)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      {[
        ['👥', stats.collectors, 'collectors'],
        ['📦', stats.stickersExchanged, 'stickers exchanged'],
        ['🔥', stats.matches, 'matches waiting'],
        ['⭐', stats.activeThisWeek, 'active this week'],
      ].map(([emoji, val, label], i) => (
        <span key={label} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px' }}>·</span>}
          <span>{emoji}</span>
          <span style={{ fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{val?.toLocaleString()}</span>
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

function AmbassadorMark({ show, size = 13 }) {
  if (!show) return null;
  return (
    <span
      title="Got One Spare? Ambassador — helped spread the word about the platform"
      style={{ fontSize: size, marginLeft: 4, verticalAlign: 'middle', lineHeight: 1, cursor: 'default' }}
    >
      🏅
    </span>
  );
}

function FounderBadge({ show, size = 13 }) {
  if (!show) return null;
  return (
    <span
      title="Got One Spare? Founder — helped support the platform's future"
      style={{ fontSize: size, marginLeft: 4, verticalAlign: 'middle', lineHeight: 1, cursor: 'default' }}
    >
      🏆
    </span>
  );
}

// Colour tier + precise relative-time text (e.g. "3d ago", "2mo ago")
// so people can judge at a glance whether a match/swap partner is
// likely to actually respond, without singling anyone out too bluntly.
function formatLastActive(lastLoginAt) {
  if (!lastLoginAt) return { label: 'Never active', color: '#9CA3AF' };
  const diffMs = Date.now() - new Date(lastLoginAt).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  let label;
  if (mins < 1) label = 'Active just now';
  else if (mins < 60) label = `Active ${mins}m ago`;
  else if (hours < 24) label = `Active ${hours}h ago`;
  else if (days < 7) label = `Active ${days}d ago`;
  else if (weeks < 5) label = `Active ${weeks}w ago`;
  else if (months < 12) label = `Active ${months}mo ago`;
  else label = `Active ${years}y ago`;

  const color = days < 1 ? '#10B981' : days < 7 ? '#F59E0B' : '#9CA3AF';
  return { label, color };
}

function ActivityIndicator({ lastLoginAt, size = 11, showText = true }) {
  const { label, color } = formatLastActive(lastLoginAt);
  if (!showText) {
    return <span title={label} style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />;
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: size, color: 'var(--text-muted)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

// Shows a plain time for messages sent today, "Yesterday, HH:MM" for
// yesterday, and a full date otherwise — so a conversation spanning
// more than a day always makes it clear which day something was sent.
function formatMessageTimestamp(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

// Compact "how long ago" text for swap proposal timestamps, e.g.
// "3 days ago" — lets people judge how long they've been waiting.
function formatSwapAge(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// Reusable stats grid — used on your own profile (full detail) and
// when viewing someone else's reliability profile (same data, same
// component). Add more entries to STAT_DEFS to extend later.
function StatsGrid({ stats, compact = false }) {
  if (!stats) return null;

  const STAT_DEFS = [
    { key: 'completedSwaps', label: 'Completed swaps', format: (v) => v ?? 0 },
    { key: 'successRatePct', label: 'Successful swaps', format: (v) => (v == null ? '—' : `${v}%`) },
    { key: 'stickersExchanged', label: 'Stickers exchanged', format: (v) => v ?? 0 },
    { key: 'activeSwaps', label: 'Active swaps', format: (v) => v ?? 0 },
    { key: 'avgResponseHours', label: 'Average response', format: (v) => (v == null ? '—' : `${v}h`) },
    { key: 'avgDispatchDays', label: 'Average dispatch', format: (v) => (v == null ? '—' : `${v}d`) },
    { key: 'fastestCompletedDays', label: 'Fastest swap', format: (v) => (v == null ? '—' : `${v}d`) },
    { key: 'longestCompletedDays', label: 'Longest swap', format: (v) => (v == null ? '—' : `${v}d`) },
    { key: 'currentStreak', label: 'Current streak', format: (v) => (v ? `${v}` : '0') },
    {
      key: 'memberSince',
      label: 'Member since',
      format: (v) => (v ? new Date(v).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'),
    },
  ];

  const visible = compact ? STAT_DEFS.slice(0, 4) : STAT_DEFS;

  return (
    <div className="collector-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
      {visible.map(({ key, label, format }) => (
        <div key={key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{format(stats[key])}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function StarRating({ value, size = 14, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= Math.round(value || 0) ? 'var(--warning)' : 'none'}
          color={n <= Math.round(value || 0) ? 'var(--warning)' : 'var(--text-muted)'}
          style={{ cursor: onChange ? 'pointer' : 'default' }}
          onClick={() => onChange?.(n)}
        />
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }) { return <div className="section-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>; }

function ErrorBanner({ message, onDismiss, action }) {
  if (!message) return null;
  return (
    <div style={{ background: 'var(--danger-light)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#991B1B' }}>
        {message}
        {action && (
          <>
            {' '}
            <button onClick={action.onClick} style={{ color: '#991B1B', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              {action.label}
            </button>
          </>
        )}
      </span>
      <button aria-label="Dismiss error" onClick={onDismiss} style={{ color: '#991B1B', flexShrink: 0 }}><X size={16} /></button>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
      <Loader2 size={24} color="var(--primary)" className="animate-spin" />
    </div>
  );
}

function EmptyState({ text }) { return <div className="empty-state"><span><Layers size={30} /></span><p>{text}</p></div>; }

function Btn({ onClick, disabled, children, variant = 'primary', size = 'md', style: extraStyle }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontWeight: 600, borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.15s',
    border: 'none',
    fontSize: size === 'sm' ? 13 : 14,
    padding: size === 'sm' ? '6px 14px' : '10px 18px',
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'white' },
    navy: { background: 'var(--navy)', color: 'white' },
    outline: { background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border)' },
    danger: { background: 'var(--danger)', color: 'white' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)' },
  };
  return (
    <button className={`gos-button ${variant}`} onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>
      {children}
    </button>
  );
}

// =================================================================
// AUTH SCREENS
// =================================================================
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'forgot_sent'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) setReferralCode(ref);
  }, []);

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'var(--bg)',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  };


  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = mode === 'login'
        ? await api.login(email, password)
        : await api.signup(name, email, password, inviteCode, referralCode || undefined);
      onAuthed(result.token, result.user);
    } catch (err) {
      if (err.message && err.message.includes('invite')) {
        setInviteRequired(true);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const HOW_IT_WORKS = [
    { emoji: '📋', step: '1', title: 'List your spares', desc: 'Add the stickers you have duplicates of' },
    { emoji: '🔍', step: '2', title: 'List your needs', desc: 'Add the stickers you\'re still missing' },
    { emoji: '⚡', step: '3', title: 'Get matched', desc: 'We find others who have what you need' },
    { emoji: '✉️', step: '4', title: 'Swap by post', desc: 'Agree a swap and post stickers to each other' },
  ];

  return (
    <div className="auth-screen" style={{ minHeight: '100vh', width: '100%', background: 'var(--navy)', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif" }}>
      <style>{DESIGN_TOKENS}</style>
      {IS_PREVIEW && <div className="preview-ribbon">{IS_INTEGRATION ? "Integration test · real catalogue, test accounts" : "Isolated preview · fictional data"} {!IS_INTEGRATION && <button onClick={async () => onAuthed('preview-alex', await api.me('preview-alex'))}>Return to demo</button>}</div>}

      {/* Forgot / reset modes */}
      {(mode === 'forgot' || mode === 'forgot_sent') && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 12, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Logo size={48} />
            </div>
            {mode === 'forgot_sent' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 8 }}>Check your inbox</div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 24 }}>If an account exists for {email}, we've sent a reset link.</p>
                <button onClick={() => setMode('login')} style={{ width: '100%', padding: 12, background: 'var(--navy)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to login</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 20 }}>Reset your password</div>
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
                <input type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }} autoFocus />
                <button onClick={async () => { if (!email.trim()) { setError('Please enter your email'); return; } setLoading(true); setError(null); try { await api.forgotPassword(email.trim()); setMode('forgot_sent'); } catch(err) { setError(err.message); } finally { setLoading(false); } }} disabled={loading} style={{ width: '100%', padding: 12, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <button onClick={() => setMode('login')} style={{ width: '100%', textAlign: 'center', fontSize: 13, marginTop: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>← Back to login</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Login / signup */}
      {(mode === 'login' || mode === 'signup') && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>

          {/* Logo + brand */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <Logo size={120} />
          </div>

          <div className="auth-heading"><h1>Your next great swap<br /><em>starts here.</em></h1><p>List your spares. Find your missing pieces.</p></div>
          {/* Form card */}
          <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>

            {/* Tab strip */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
              <button
                onClick={() => { setMode('login'); setError(null); setInviteRequired(false); }}
                style={{ flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', borderBottom: mode === 'login' ? '2px solid #1AAB8A' : '2px solid transparent', color: mode === 'login' ? 'var(--primary)' : '#aaa', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}
              >Log in</button>
              <button
                onClick={() => { setMode('signup'); setError(null); setInviteRequired(false); }}
                style={{ flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', borderBottom: mode === 'signup' ? '2px solid #1AAB8A' : '2px solid transparent', color: mode === 'signup' ? 'var(--primary)' : '#aaa', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}
              >Sign up</button>
            </div>

            {/* Form */}
            <div style={{ padding: '24px 24px 28px' }}>
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mode === 'signup' && (
                  <>
                    <input aria-label="Your name" autoComplete="name" type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
                    {inviteRequired && (
                      <input type="text" placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                    )}
                  </>
                )}
                <input aria-label="Email address" autoComplete="email" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                <input aria-label="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', marginTop: 2 }}>
                  {loading && <Loader2 className="animate-spin" size={15} />}
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </button>
              </form>

              {mode === 'login' && (
                <button onClick={() => setMode('forgot')} style={{ width: '100%', textAlign: 'center', fontSize: 12, marginTop: 14, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Forgot your password?
                </button>
              )}
            </div>

            {/* Bottom stats strip */}
            <div style={{ background: 'var(--bg)', borderTop: '1px solid #f0f0f0', padding: '10px 24px', display: 'flex', justifyContent: 'space-around' }}>
              {stats ? [
                [stats.collectors, 'collectors'],
                [stats.activeThisWeek, 'active this week'],
              ].map(([val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{val.toLocaleString()}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                </div>
              )) : (
                ['980 stickers', 'UK collectors', 'Post by post'].map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t}</span>
                ))
              )}
            </div>
          </div>

          {/* 4 steps */}
          <div style={{ display: 'flex', gap: 16, marginTop: 28, maxWidth: 380, width: '100%' }}>
            {[['1','List spares'],['2','Add needs'],['3','Get matched'],['4','Swap by post']].map(([n, t]) => (
              <div key={n} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', margin: '0 auto 5px' }}>{n}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>{t}</div>
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}

// =================================================================
// STICKER SEARCH PICKER (modal) — used for adding to duplicates/needs
// =================================================================
const WC2026_GROUP_ORDER = [
  'FWC',
  'Mexico', 'South Africa', 'South Korea', 'Czechia',
  'Canada', 'Switzerland', 'Qatar', 'Bosnia and Herzegovina',
  'Brazil', 'Morocco', 'Haiti', 'Scotland',
  'USA', 'Paraguay', 'Australia', 'Turkiye',
  'Germany', 'Ivory Coast', 'Ecuador', 'Curacao',
  'Netherlands', 'Japan', 'Tunisia', 'Sweden',
  'Belgium', 'Egypt', 'Iran', 'New Zealand',
  'Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay',
  'France', 'Senegal', 'Norway', 'Iraq',
  'Argentina', 'Algeria', 'Austria', 'Jordan',
  'Portugal', 'Uzbekistan', 'Colombia', 'Congo DR',
  'England', 'Croatia', 'Ghana', 'Panama',
  'Coca-Cola (North America)',
  'Coca-Cola (Europe)',
  'Coca-Cola (Latin America)',
];

const TEAM_NAME_ALIASES = {
  'Korea Republic': 'South Korea',
  'Turkey': 'Turkiye',
  'United States': 'USA',
  'Curaçao': 'Curacao',
  "Côte d'Ivoire": 'Ivory Coast',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'DR Congo': 'Congo DR',
  'Cabo Verde': 'Cape Verde',
};

// Per-album sort/display config. Albums with no groupOrder (e.g. Premier
// League, whose clubs already sort alphabetically in physical album order)
// fall back to a plain A–Z sort with no name aliasing.
const ALBUM_CONFIG = {
  1: { groupOrder: WC2026_GROUP_ORDER, teamAliases: TEAM_NAME_ALIASES },
  2: { groupOrder: null, teamAliases: {} },
};

function normaliseTeamName(name, albumId = 1) {
  const aliases = ALBUM_CONFIG[albumId]?.teamAliases || {};
  return aliases[name] || name;
}

function sortTeamsByGroup(teams, albumId = 1) {
  const groupOrder = ALBUM_CONFIG[albumId]?.groupOrder;
  if (!groupOrder) return [...teams].sort((a, b) => a.team_name.localeCompare(b.team_name));
  return [...teams].sort((a, b) => {
    const an = normaliseTeamName(a.team_name, albumId);
    const bn = normaliseTeamName(b.team_name, albumId);
    const ai = groupOrder.indexOf(an);
    const bi = groupOrder.indexOf(bn);
    if (ai === -1 && bi === -1) return a.team_name.localeCompare(b.team_name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

// Sorts a list of owned/needed stickers into physical-album order for a
// given album (falls back to plain sticker-number order for albums with
// no configured groupOrder).
function sortStickersByAlbumOrder(items, albumId = 1) {
  const groupOrder = ALBUM_CONFIG[albumId]?.groupOrder || [];
  return [...items].sort((a, b) => {
    const ai = groupOrder.indexOf(normaliseTeamName(a.team_name, albumId));
    const bi = groupOrder.indexOf(normaliseTeamName(b.team_name, albumId));
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return (a.sticker_number || '').localeCompare(b.sticker_number || '', undefined, { numeric: true });
  });
}

function StickerPickerModal({ mode, onClose, onPicked }) {
  const { token } = useAuth();
  const { albumId } = useAlbum();
  const [pickerTab, setPickerTab] = useState('team');
  const [teams, setTeams] = useState([]);
  const [teamSort, setTeamSort] = useState('group');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamStickers, setTeamStickers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSelected, setSearchSelected] = useState(null);
  const [searchQty, setSearchQty] = useState(1);

  const [basket, setBasket] = useState({});
  const [existing, setExisting] = useState({});

  useEffect(() => {
    api.getTeams(token, albumId).then(setTeams).catch(() => {});
    const getter = mode === 'duplicate' ? api.getMyDuplicates : api.getMyNeeds;
    getter(token, albumId).then(items => {
      const map = {};
      items.forEach(s => { map[s.sticker_id] = s; });
      setExisting(map);
    }).catch(() => {});
  }, [token, mode, albumId]);

  useEffect(() => {
    if (!selectedTeam) { setTeamStickers([]); return; }
    setTeamLoading(true);
    api.searchStickers(token, { team: selectedTeam, albumId })
      .then(setTeamStickers).catch(() => {}).finally(() => setTeamLoading(false));
  }, [selectedTeam, token, albumId]);

  useEffect(() => {
    if (pickerTab !== 'search') return;
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const handle = setTimeout(() => {
      setSearchLoading(true);
      api.searchStickers(token, { search: searchQuery, albumId })
        .then(setSearchResults).catch(() => {}).finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, token, pickerTab, albumId]);

  const addFromSearch = async (sticker, qty) => {
    setError(null);
    try {
      if (mode === 'duplicate') {
        await api.addDuplicate(token, sticker.id, qty);
      } else {
        await api.addNeed(token, sticker.id);
      }
      setExisting(prev => ({ ...prev, [sticker.id]: { sticker_id: sticker.id, quantity: qty, sticker_number: sticker.sticker_number, description: sticker.description, team_name: sticker.team_name } }));
      setSearchSelected(null);
      setSearchQty(1);
      setSearchQuery('');
      setSearchResults([]);
      onPicked();
      setSuccess(`✓ ${sticker.sticker_number} added!`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) { setError(err.message); }
  };

  const toggleBasket = (sticker) => {
    if (existing[sticker.id]) return;
    setBasket(prev => {
      const next = { ...prev };
      if (next[sticker.id]) { delete next[sticker.id]; }
      else { next[sticker.id] = { sticker, quantity: 1 }; }
      return next;
    });
  };

  const setBasketQty = (id, val) => {
    const n = Math.max(1, Math.min(99, parseInt(val) || 1));
    setBasket(prev => ({ ...prev, [id]: { ...prev[id], quantity: n } }));
  };

  const updateExistingQty = async (stickerId, newQty) => {
    try {
      if (newQty <= 0) {
        if (mode === 'duplicate') await api.removeDuplicate(token, stickerId);
        else await api.removeNeed(token, stickerId);
        setExisting(prev => { const next = { ...prev }; delete next[stickerId]; return next; });
      } else {
        if (mode === 'duplicate') await api.updateDuplicateQty(token, stickerId, newQty);
        setExisting(prev => ({ ...prev, [stickerId]: { ...prev[stickerId], quantity: newQty } }));
      }
      onPicked();
    } catch (err) { setError(err.message); }
  };

  const confirmAll = async () => {
    const basketItems = Object.values(basket);
    if (!basketItems.length) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === 'duplicate') {
        const singleQty = basketItems.filter(i => i.quantity === 1).map(i => i.sticker.id);
        const multiQty = basketItems.filter(i => i.quantity > 1);
        if (singleQty.length) await api.addDuplicatesBulk(token, singleQty);
        for (const item of multiQty) await api.addDuplicate(token, item.sticker.id, item.quantity);
      } else {
        await api.addNeedsBulk(token, basketItems.map(i => i.sticker.id));
      }
      setExisting(prev => {
        const next = { ...prev };
        basketItems.forEach(item => {
          next[item.sticker.id] = { sticker_id: item.sticker.id, quantity: item.quantity, sticker_number: item.sticker.sticker_number, description: item.sticker.description, team_name: item.sticker.team_name };
        });
        return next;
      });
      setBasket({});
      onPicked();
      const total = basketItems.reduce((s, i) => s + i.quantity, 0);
      setSuccess(`✓ Added ${total} sticker${total > 1 ? 's' : ''}! Select another team or close when done.`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const basketItems = Object.values(basket);
  const totalCount = basketItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Add stickers" className="modern-dialog fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="team-picker-panel modern-dialog-panel w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col" style={{ background: 'var(--surface)' }}>

        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>
              {mode === 'duplicate' ? 'Build your spare list' : 'Build your needs list'}
            </h3>
            {basketItems.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2 }}>
                {basketItems.length} new sticker{basketItems.length !== 1 ? 's' : ''} selected across teams — save when ready
              </div>
            )}
          </div>
          <button onClick={async () => { if (basketItems.length && !await confirmAction("Discard your unsaved sticker selections?")) return; onClose(); }} aria-label="Close"><X size={18} color="var(--text-secondary)" /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {[['team', 'Browse by team'], ['search', 'Search by code']].map(([tab, label]) => (
            <button key={tab} onClick={() => setPickerTab(tab)} style={{
              flex: 1, padding: '10px', fontSize: 13, fontWeight: pickerTab === tab ? 600 : 400,
              color: pickerTab === tab ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: pickerTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'none', border: 'none', cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>

        {success && <div style={{ background: 'var(--success-light)', color: '#065F46', fontSize: 13, fontWeight: 500, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>{success}</div>}
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {pickerTab === 'search' && (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Type a sticker code (e.g. ARG7, FWC3, CC1-EU)"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSearchSelected(null); }}
                  style={{ width: '100%', padding: '10px 10px 10px 32px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
                Search by sticker code or player name — tap a result to select it.
              </p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {searchLoading && <Spinner />}
              {!searchLoading && searchQuery && searchResults.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No stickers found for "{searchQuery}"</div>
              )}
              {searchResults.map(s => {
                const isExisting = !!existing[s.id];
                const isSelected = searchSelected?.id === s.id;
                return (
                  <div key={s.id} style={{ borderBottom: '1px solid var(--border)', background: isSelected ? 'var(--primary-light)' : isExisting ? '#F9FAFB' : 'transparent', opacity: isExisting ? 0.7 : 1 }}>
                    <button onClick={() => { if (!isExisting) { setSearchSelected(s); setSearchQty(1); } }}
                      style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: isExisting ? 'default' : 'pointer', textAlign: 'left' }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isExisting ? '#9CA3AF' : 'var(--primary)', fontFamily: 'monospace', marginRight: 8 }}>{s.sticker_number}</span>
                        <span style={{ fontSize: 14, color: isExisting ? '#6B7280' : 'var(--text-primary)' }}>{s.description}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.team_name}{isExisting ? ' · already added' : ''}</div>
                      </div>
                      {isSelected && <CheckCircle2 size={16} color="var(--primary)" style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                    </button>
                    {isSelected && (
                      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        {mode === 'duplicate' && (
                          <>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Quantity:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button onClick={() => setSearchQty(q => Math.max(1, q - 1))} style={{ width: 26, height: 26, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700 }}>−</button>
                              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{searchQty}</span>
                              <button onClick={() => setSearchQty(q => q + 1)} style={{ width: 26, height: 26, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700 }}>+</button>
                            </div>
                          </>
                        )}
                        <Btn variant="primary" onClick={() => addFromSearch(s, searchQty)} style={{ marginLeft: 'auto' }}>
                          Add {s.sticker_number}{mode === 'duplicate' && searchQty > 1 ? ` ×${searchQty}` : ''}
                        </Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {pickerTab === 'team' && (<>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[['group', 'Group order'], ['alpha', 'A–Z']].map(([val, label]) => (
              <button key={val} onClick={() => setTeamSort(val)}
                style={{ flex: 1, padding: '6px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: teamSort === val ? 'var(--primary)' : 'var(--bg)', color: teamSort === val ? 'white' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>
          <div className="picker-team-sections" aria-label="Choose a team">
            {(teamSort === 'group' ? sortTeamsByGroup(teams, albumId) : [...teams].sort((a, b) => a.team_name.localeCompare(b.team_name))).map(t => {
              const pending = basketItems.filter(item => item.sticker.team_name === t.team_name).length;
              return <button key={t.team_name} aria-pressed={selectedTeam === t.team_name} onClick={() => setSelectedTeam(t.team_name)}><ShieldCheck size={17} /><span>{t.team_name}</span>{pending > 0 && <strong>{pending}</strong>}</button>;
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Choose a team, select stickers, then move to another team. Your new selections stay selected until you save. Existing quantity changes save immediately.
          </p>
        </div>

        {selectedTeam && (
          <>
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {teamStickers.filter(s => basket[s.id]).length} selected · {teamStickers.filter(s => existing[s.id]).length} already added
              </span>
              <button
                onClick={() => {
                  const newOnes = teamStickers.filter(s => !existing[s.id]);
                  const allSelected = newOnes.length > 0 && newOnes.every(s => basket[s.id]);
                  setBasket(prev => {
                    const next = { ...prev };
                    if (allSelected) { newOnes.forEach(s => delete next[s.id]); }
                    else { newOnes.forEach(s => { if (!next[s.id]) next[s.id] = { sticker: s, quantity: 1 }; }); }
                    return next;
                  });
                }}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {teamStickers.filter(s => !existing[s.id]).every(s => basket[s.id]) ? 'Deselect all' : 'Select all new'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {teamLoading ? <Spinner /> : teamStickers.map((s) => {
                const isExisting = !!existing[s.id];
                const existingQty = existing[s.id]?.quantity ?? 1;
                const isInBasket = !!basket[s.id];

                if (isExisting) {
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', background: '#F9FAFB', borderBottom: '1px solid var(--border)', opacity: 0.7 }}>
                      <div style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 20, height: 20, borderRadius: 12, flexShrink: 0, background: '#9CA3AF', border: '2px solid #9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', fontFamily: 'monospace', marginRight: 8 }}>{s.sticker_number}</span>
                          <span style={{ fontSize: 14, color: '#6B7280' }}>{s.description}</span>
                        </div>
                      </div>
                      {mode === 'duplicate' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 12, flexShrink: 0 }}>
                          <button onClick={() => updateExistingQty(s.id, existingQty - 1)}
                            style={{ width: 22, height: 22, borderRadius: 12, background: existingQty <= 1 ? '#FEE2E2' : '#E5E7EB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: existingQty <= 1 ? '#DC2626' : '#374151' }}>
                            {existingQty <= 1 ? <X size={10} /> : '−'}
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center', color: '#6B7280' }}>{existingQty}</span>
                          <button onClick={() => updateExistingQty(s.id, existingQty + 1)}
                            style={{ width: 22, height: 22, borderRadius: 12, background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => updateExistingQty(s.id, 0)}
                          style={{ marginRight: 12, width: 22, height: 22, borderRadius: 12, background: '#FEE2E2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', background: isInBasket ? 'var(--primary-light)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                    <button aria-pressed={isInBasket} aria-label={`Select ${s.sticker_number} ${s.description}`} onClick={() => toggleBasket(s)}
                      style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 12, flexShrink: 0, background: isInBasket ? 'var(--primary)' : 'transparent', border: `2px solid ${isInBasket ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isInBasket && <span style={{ color: 'white', fontSize: 13, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', marginRight: 8 }}>{s.sticker_number}</span>
                        <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.description}</span>
                      </div>
                    </button>
                    {mode === 'duplicate' && isInBasket && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 12, flexShrink: 0 }}>
                        <button onClick={() => setBasketQty(s.id, (basket[s.id]?.quantity || 1) - 1)}
                          style={{ width: 22, height: 22, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center', color: 'var(--text-primary)' }}>{basket[s.id]?.quantity || 1}</span>
                        <button onClick={() => setBasketQty(s.id, (basket[s.id]?.quantity || 1) + 1)}
                          style={{ width: 22, height: 22, borderRadius: 12, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!selectedTeam && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Choose a team above to see its sticker checklist.
          </div>
        )}

        {basketItems.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Btn variant="primary" onClick={confirmAll} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : `Save ${totalCount} sticker${totalCount > 1 ? 's' : ''}`}
            </Btn>
          </div>
        )}
        </>)}
      </div>
    </div>
  );
}

function RatingModal({ swapId, otherUserName, onClose, onSubmitted }) {
  const { token } = useAuth();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.submitRating(token, swapId, stars, comment);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Rate your swap" className="modern-dialog fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="modern-dialog-panel w-full max-w-sm rounded-lg p-6" style={{ background: 'var(--surface)' }}>
        <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Rate your swap</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>How was trading with {otherUserName}?</p>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <div className="flex justify-center mb-4">
          <StarRating value={stars} size={32} onChange={setStars} />
        </div>

        <textarea
          placeholder="Optional comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded text-sm mb-4"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
            Skip
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
            {loading && <Loader2 className="animate-spin" size={14} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// DISPUTE MODAL
// =================================================================
const DISPUTE_REASONS = [
  { value: 'never_posted', label: "They never posted their stickers" },
  { value: 'never_received', label: "I never received the stickers" },
  { value: 'wrong_item', label: "Wrong or different stickers arrived" },
  { value: 'no_response', label: "They've stopped responding" },
  { value: 'other', label: 'Something else' },
];

function DisputeModal({ swapId, otherUserName, onClose, onFiled }) {
  const { token } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.fileDispute(token, swapId, reason, details);
      onFiled();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Report a swap problem" className="modern-dialog fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="modern-dialog-panel w-full max-w-sm rounded-lg p-6" style={{ background: 'var(--surface)' }}>
        <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Report a problem</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          This will flag your swap with {otherUserName} for review and let them know something's wrong.
        </p>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <div className="space-y-2 mb-4">
          {DISPUTE_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm cursor-pointer"
              style={{
                background: reason === r.value ? 'var(--bg)' : 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <input
                type="radio"
                name="dispute-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              {r.label}
            </label>
          ))}
        </div>

        <textarea
          placeholder="Any extra details (optional)"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded text-sm mb-4"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--danger)', color: 'var(--surface)' }}>
            {loading && <Loader2 className="animate-spin" size={14} />}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// BECOME A FOUNDER MODAL
// One-time £14.99 supporter purchase — redirects to Stripe Checkout.
// =================================================================
function FounderModal({ onClose }) {
  const { token } = useAuth();
  const [count, setCount] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getFounderCount().then((d) => setCount(d.count)).catch(() => {});
    api.getFounderStatus(token).then(setStatus).catch(() => {});
  }, [token]);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    api.logDonationClick(token, 'become_a_founder').catch(() => {});

    // On the iOS app this must go through Apple's in-app purchase system
    // (App Store guideline 3.1.1) rather than Stripe. The RevenueCat
    // webhook updates founder_member server-side, so we just poll
    // briefly afterward until that lands.
    if (Capacitor.isNativePlatform()) {
      try {
        await purchaseFounderPackage();
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const fresh = await api.getFounderStatus(token).catch(() => null);
          if (fresh?.isFounder) {
            setStatus(fresh);
            setLoading(false);
            return;
          }
        }
        setLoading(false);
        setError("Purchase complete — your Founder badge may take a moment to appear. Reopen this if it hasn't shown up shortly.");
      } catch (err) {
        setLoading(false);
        if (!err.userCancelled) setError(err.message || 'Purchase failed — please try again.');
      }
      return;
    }

    try {
      const { url } = await api.createFounderCheckout(token);
      window.location.href = url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const BENEFITS = [
    'Founder badge shown next to your name',
    'Gold styling on your profile',
    'Early access to vote on new features',
    'Lifetime recognition as a founding supporter',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-lg overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
        <div style={{ background: 'linear-gradient(135deg, #78350F, #92400E)', padding: '24px 24px 20px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} color="white" />
          </button>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🏆</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 4 }}>Become a Founder</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
            Help build the future of Got One Spare — a one-time contribution that supports hosting, development, and future sticker collections.
          </div>
          {count !== null && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#FDE68A', fontWeight: 700 }}>
              🎉 {count} founding supporter{count === 1 ? '' : 's'} already on board
            </div>
          )}
        </div>

        <div style={{ padding: 22 }}>
          {status?.isFounder ? (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🏆</div>
              <div style={{ fontWeight: 700, color: '#92400E', marginBottom: 4 }}>You're already a Founder!</div>
              <div style={{ fontSize: 13, color: '#78350F' }}>
                Thank you for supporting Got One Spare
                {status.founderSince && ` since ${new Date(status.founderSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Founder benefits
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {BENEFITS.map((b) => (
                  <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{ color: '#D97706', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {b}
                  </div>
                ))}
              </div>

              <ErrorBanner message={error} onDismiss={() => setError(null)} />

              <button
                onClick={startCheckout}
                disabled={loading}
                style={{ width: '100%', padding: '13px', borderRadius: 8, background: 'linear-gradient(135deg, #D97706, #92400E)', border: 'none', color: 'white', fontWeight: 800, fontSize: 15, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? (Capacitor.isNativePlatform() ? 'Processing…' : 'Redirecting to checkout…') : 'Become a Founder — £14.99'}
              </button>

              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
                One-time payment, not a subscription. Core swapping, matching and messaging will always stay completely free for everyone.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// DASHBOARD FOUNDER BANNER
// Dismissible, re-shows every few weeks — same cooldown pattern as
// the install banner. Never shown to existing Founders.
// =================================================================
function FounderBanner({ onOpen }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissedAt = parseInt(storage.getItem('founder_banner_dismissed_at') || '0', 10);
    const cooledDown = Date.now() - dismissedAt > 21 * 24 * 60 * 60 * 1000; // 3 weeks
    if (cooledDown) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    storage.setItem('founder_banner_dismissed_at', String(Date.now()));
  };

  if (!show) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>❤️</span>
      <div style={{ flex: 1, fontSize: 13, color: '#78350F' }}>
        <strong>Enjoying Got One Spare?</strong> If it's helped you find swaps, consider becoming a Founder to help fund future collections.
      </div>
      <button onClick={onOpen} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 6, background: '#92400E', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        Become a Founder
      </button>
      <button onClick={dismiss} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', opacity: 0.6 }}>
        <X size={15} />
      </button>
    </div>
  );
}

// Web-only "coming soon" banner for the iOS/Android apps — never shown
// inside the native apps themselves (Capacitor.isNativePlatform() guard),
// since there's no point advertising the app to someone already using it.
// The iOS app is live — banner announcing it with an App Store link.
// (Was the "coming soon — notify me" banner before the launch.)
function AppLaunchBanner() {
  const { token } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const dismissedAt = parseInt(storage.getItem('ios_live_banner_dismissed_at') || '0', 10);
    const cooledDown = Date.now() - dismissedAt > 21 * 24 * 60 * 60 * 1000; // 3 weeks
    if (cooledDown) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    storage.setItem('ios_live_banner_dismissed_at', String(Date.now()));
  };

  if (!show) return null;

  return (
    <div style={{ background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)', border: '1px solid #6EE7B7', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🎉</span>
      <div style={{ flex: 1, fontSize: 13, color: '#065F46' }}>
        <strong>The iOS app is now live!</strong> Get Got One Spare on the App Store for a faster experience on iPhone and iPad.
      </div>
      <a href={IOS_APP_URL} target="_blank" rel="noopener noreferrer"
        onClick={() => { api.trackAppStoreClick(token, 'banner').catch(() => {}); }}
        style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 6, background: 'var(--navy)', color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
        Download
      </a>
      <button onClick={dismiss} style={{ flexShrink: 0, background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', opacity: 0.6 }}>
        <X size={15} />
      </button>
    </div>
  );
}


// =================================================================
// USER PROFILE MODAL
// Reachable by tapping any name anywhere in the app. Shows ratings,
// reliability stats, badges, and a message/edit action.
// =================================================================
function UserProfileModal({ userId, onClose, onEditOwnProfile }) {
  const { token, user, openConversationWith } = useAuth();
  const isSelf = user?.id === userId;

  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [composing, setComposing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getUserRatings(token, userId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.getUserStats(token, userId).then((res) => { if (!cancelled) setStats(res); }).catch(() => {});
    if (!isSelf) {
      api.getBlockedUsers(token).then((list) => {
        if (!cancelled) setIsBlocked(list.some((b) => b.id === userId));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [token, userId]);

  const toggleBlock = async () => {
    if (!isBlocked && !await confirmAction(`Block ${stats?.name || 'this user'}? They won't be able to message you, and you won't be able to message them.`)) return;
    try {
      if (isBlocked) await api.unblockUser(token, userId);
      else await api.blockUser(token, userId);
      setIsBlocked(!isBlocked);
    } catch (err) { setError(err.message); }
  };

  const sendFirstMessage = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.startConversation(token, userId, messageText.trim());
      setSent(true);
      setMessageText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const initials = (stats?.name || data?.name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div role="dialog" aria-modal="true" aria-label="Collector profile" className="collector-profile modern-dialog fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="collector-profile-panel modern-dialog-panel" style={{ background: 'var(--surface)', border: stats?.isFounder ? '2px solid #D97706' : 'none' }}>

        <div className="collector-profile-top">
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>COLLECTOR CARD</span>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--text-secondary)" /></button>
        </div>

        {loading && <Spinner />}
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {stats && (
          <>
            <div className="collector-profile-identity">
              <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: stats.isFounder ? 'linear-gradient(135deg, #D97706, #92400E)' : 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: stats.isFounder ? '2px solid #FDE68A' : 'none' }}>
                {stats.profilePhoto ? (
                  <img src={stats.profilePhoto} alt={stats.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{initials}</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: stats.isFounder ? '#B45309' : 'var(--text-primary)', display: 'flex', alignItems: 'center' }}>
                  {stats.name}<AmbassadorMark show={stats.ambassadorBadge} /><FounderBadge show={stats.isFounder} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {stats.city ? `${stats.city} · ` : ''}Member since {stats.memberSince ? new Date(stats.memberSince).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'}
                </div>
                <div style={{ marginTop: 3 }}>
                  <ActivityIndicator lastLoginAt={stats.lastLoginAt} size={12} />
                </div>
                {stats.isFounder && stats.founderSince && (
                  <div style={{ fontSize: 11, color: '#92400E', fontWeight: 700, marginTop: 2 }}>
                    🏆 Founder since {new Date(stats.founderSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>

            <div className="collector-profile-rating" style={{ borderBottom: '1px solid var(--border)' }}>
              <StarRating value={stats.ratingAvg} size={18} />
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {stats.ratingAvg ? Number(stats.ratingAvg).toFixed(1) : 'No ratings yet'}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                ({stats.ratingCount} {stats.ratingCount === 1 ? 'review' : 'reviews'})
              </span>
            </div>

            <div style={{ marginBottom: 20 }}>
              {isSelf ? (
                <button
                  onClick={onEditOwnProfile}
                  className="w-full py-2.5 rounded text-sm font-semibold"
                  style={{ background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  Profile & settings
                </button>
              ) : sent ? (
                <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>✓ Message sent</span>
                  <button
                    onClick={() => openConversationWith?.(userId)}
                    style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-dark)', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Go to conversation →
                  </button>
                </div>
              ) : composing ? (
                <div>
                  <textarea
                    autoFocus
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Write a message to ${stats.name}…`}
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 8, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setComposing(false); setMessageText(''); }}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={sendFirstMessage}
                      disabled={sending || !messageText.trim()}
                      style={{ flex: 2, padding: '9px 0', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', border: 'none', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', opacity: sending || !messageText.trim() ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      {sending && <Loader2 size={13} className="animate-spin" />} Send
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setComposing(true)}
                  className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)', color: 'white' }}
                >
                  <MessageCircle size={15} /> Message {stats.name?.split(' ')[0]}
                </button>
              )}
            </div>

            {!isSelf && (
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <button onClick={toggleBlock} style={{ fontSize: 12, fontWeight: 600, color: isBlocked ? 'var(--primary)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {isBlocked ? 'Unblock this user' : '🚫 Block this user'}
                </button>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Swapping record</div>
              <StatsGrid stats={stats} compact />
            </div>

            {data && (
              data.recentRatings.length === 0 ? (
                <EmptyState text="No reviews yet — be the first to swap and rate." />
              ) : (
                <div className="space-y-3">
                  {data.recentRatings.map((r, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.rater_name}</span>
                        <StarRating value={r.stars} size={12} />
                      </div>
                      {r.comment && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.comment}</p>}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// HOME HUB — landing screen shown right after login, before any
// specific collection's dashboard. A grid of large tiles so it's
// obvious where everything lives, and a natural place to add more
// collection types (e.g. trading cards) later without cramming the
// album tab row.
// =================================================================
function HomeHubScreen({ onNavigate, onOpenProfile, unreadMessages }) {
  const { token, user } = useAuth();
  const { albums, albumId, setAlbumId } = useAlbum();
  const [counts, setCounts] = useState({});
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all(albums.map(async album => {
      const [matches, swaps, spares, needs] = await Promise.all([api.getMatches(token, album.id), api.getMySwaps(token, album.id), api.getMyDuplicates(token, album.id), api.getMyNeeds(token, album.id)]);
      return [album.id, { matches: matches.length, swaps, spares: spares.reduce((n, s) => n + s.quantity, 0), needs: needs.length }];
    })).then(entries => { if (!cancelled) setCounts(Object.fromEntries(entries)); }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [token, albums]);
  const current = counts[albumId];
  const ready = Object.values(counts).flatMap(c => c.swaps).find(s => ['You need to post', 'Ready to post'].includes(getSwapLabel(s, user.id)));
  const openAlbum = album => { setAlbumId(album.id); onNavigate('dashboard'); };
  return <div className="home-screen">
    <ErrorBanner message={error} onDismiss={() => setError(null)} />
    <div className="welcome"><div><h1>Morning, {user?.name?.split(' ')[0] || 'collector'} <span aria-hidden="true">👋</span></h1><p>Same stickers. Bigger connections.</p></div><button className="desktop-profile icon-button" onClick={onOpenProfile} aria-label="Edit your profile"><CollectorAvatar person={user} /></button></div>
    <button className="home-search" onClick={() => onNavigate('dashboard')}><Search size={19} /><span>Find stickers in your album…</span><ChevronRight size={17} /></button>
    <div className="home-feature"><section className="collector-hero"><div className="hero-copy"><h2>Your next<br />great swap<br /><em>starts here.</em></h2><p>List your spares.<br />Find your missing pieces.</p><button className="yellow-button" onClick={() => onNavigate('dashboard')}>Add spares <ArrowRight size={18} /></button></div></section>
    <div className="home-stats">{[[Layers, current?.spares, 'Spares', 'dashboard'], [Package, current?.needs, 'Needed', 'dashboard'], [Users, current?.matches, 'Matches', 'matches']].map(([Icon, value, label, tab]) => <button key={label} onClick={() => onNavigate(tab)}><Icon size={24} /><strong>{value ?? '—'}</strong><span>{label}</span></button>)}</div></div>
    <section className="your-albums"><div className="section-row"><h2>Your albums</h2><button onClick={() => onNavigate('dashboard')}>See all <ChevronRight size={15} /></button></div><div className="album-shelf">{albums.map(a => <button className="album-tile" key={a.id} onClick={() => openAlbum(a)}><AlbumCover album={a} /><span>{counts[a.id] ? `${counts[a.id].spares} spares · ${counts[a.id].needs} needed` : 'Open collection'}</span><strong>{a.name}</strong></button>)}</div></section>
    <div className="home-next"><button className="next-action" onClick={() => { if (ready) setAlbumId(ready.album_id); onNavigate('mySwaps'); }}><span className="parcel-icon"><Package size={27} /></span><span><strong>{ready ? `Ready to post to ${ready.other_user_name}` : 'Your swaps, all in one place'}</strong><small>{ready ? 'Your next step is ready when you are' : 'Keep track from proposal to delivery'}</small></span><ChevronRight size={20} /></button>
    <div className="home-shortcuts"><button onClick={() => onNavigate('messages')}><MessageCircle size={19} />Messages{unreadMessages > 0 && <span className="count-badge">{unreadMessages}</span>}</button><button onClick={() => setShowHowItWorks(true)}><HelpCircle size={19} />How it works</button></div></div>
    {showHowItWorks && <div className="gos-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="How swapping works" className="gos-modal"><SectionHeader title="Small swaps. Big collections." action={<button className="icon-button" onClick={() => setShowHowItWorks(false)} aria-label="Close guide"><X /></button>} /><ol className="how-steps"><li>List your spare stickers and the ones you need.</li><li>We find collectors whose spares and needs match yours.</li><li>Review a match, propose a swap and both accept.</li><li>Post, mark received, then rate your swap.</li></ol><Btn onClick={() => setShowHowItWorks(false)}>Let’s get collecting</Btn></section></div>}
  </div>;
}

// =================================================================
// DASHBOARD (duplicates + needs), now backed by real API state
// =================================================================
function DashboardScreen({ onOpenSwap }) {
  const { token, user } = useAuth();
  const { albumId, albums, setAlbumId } = useAlbum();
  const [duplicates, setDuplicates] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [albumStickerCount, setAlbumStickerCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorSwapId, setErrorSwapId] = useState(null);
  const [picker, setPicker] = useState(null); // 'duplicate' | 'need' | null
  const [duplicatesOpen, setDuplicatesOpen] = useState(true);
  const [needsOpen, setNeedsOpen] = useState(true);
  const [showFounderModal, setShowFounderModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dups, needsList, teamsList, allStickers] = await Promise.all([
        api.getMyDuplicates(token, albumId),
        api.getMyNeeds(token, albumId),
        api.getTeams(token, albumId),
        api.searchStickers(token, { albumId }), // full album list — teams excludes team-less stickers, so this is the only accurate total
      ]);
      setTeams(teamsList);
      setAlbumStickerCount(allStickers.length);
      setDuplicates(sortStickersByAlbumOrder(dups, albumId));
      setNeeds(sortStickersByAlbumOrder(needsList, albumId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, albumId]);

  useEffect(() => { load(); }, [load]);

  const removeDuplicate = async (stickerId) => {
    setDuplicates((d) => d.filter((x) => x.sticker_id !== stickerId));
    try {
      await api.removeDuplicate(token, stickerId);
      setErrorSwapId(null);
    } catch (err) {
      await load();
      setError(err.message);
      setErrorSwapId(err.swapId || null);
    }
  };

  const removeNeed = async (stickerId) => {
    setNeeds((n) => n.filter((x) => x.sticker_id !== stickerId));
    try {
      await api.removeNeed(token, stickerId);
    } catch (err) {
      await load();
      setError(err.message);
    }
  };

  const [activeTeam, setActiveTeam] = useState('All');
  const [pane, setPane] = useState('duplicate');
  const [query, setQuery] = useState('');
  useEffect(() => { setActiveTeam('All'); }, [albumId]);

  if (loading) return <Spinner />;

  const totalSpares = duplicates.reduce((s, d) => s + d.quantity, 0);
  const totalNeeds = needs.length;
  const totalStickers = albumStickerCount || 1;
  const completionPct = Math.round(((totalStickers - totalNeeds) / totalStickers) * 100);

  const teamGroups = ['All', ...sortTeamsByGroup(teams, albumId).map(t => t.team_name)];
  const filteredDuplicates = activeTeam === 'All' ? duplicates : duplicates.filter(s => normaliseTeamName(s.team_name, albumId) === activeTeam || s.team_name === activeTeam);
  const filteredNeeds = activeTeam === 'All' ? needs : needs.filter(s => normaliseTeamName(s.team_name, albumId) === activeTeam || s.team_name === activeTeam);

  const shown = (pane === 'duplicate' ? filteredDuplicates : filteredNeeds).filter(s => `${s.sticker_number} ${s.description} ${s.team_name}`.toLowerCase().includes(query.toLowerCase()));
  const selectedAlbum = albums.find(a => a.id === albumId);
  return <div className="album-screen">
    <ErrorBanner message={error} onDismiss={() => { setError(null); setErrorSwapId(null); }} action={errorSwapId && onOpenSwap ? { label: `View swap #${errorSwapId}`, onClick: () => onOpenSwap(errorSwapId) } : null} />
    <div className="album-heading"><AlbumCover album={selectedAlbum} small /><div><p className="eyebrow">MY STICKERS</p><h1>{selectedAlbum?.name || 'Your collection'}</h1><p>{totalSpares} spares · {totalNeeds} needed</p></div></div>
    {user?.matching_paused && <p className="matching-notice">Matching paused. Turn it back on in your profile to receive new matches.</p>}
    <div className="album-controls"><label className="album-select"><Layers size={17} /><select aria-label="Choose album" value={albumId} onChange={e => setAlbumId(Number(e.target.value))}>{albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><div className="album-tabs"><button aria-pressed={pane === 'duplicate'} onClick={() => setPane('duplicate')}>Spares ({totalSpares})</button><button aria-pressed={pane === 'need'} onClick={() => setPane('need')}>Needs ({totalNeeds})</button></div><button className="yellow-button album-add" onClick={() => setPicker(pane)}>Add {pane === 'duplicate' ? 'spare' : 'missing'} stickers <Plus size={22} /></button><label className="album-search"><Search size={19} /><input aria-label="Search your stickers" placeholder="Search numbers, players or teams…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="team-filter"><label>Team<select aria-label="Filter by team" value={activeTeam} onChange={e => setActiveTeam(e.target.value)}>{teamGroups.map(t => <option key={t}>{t}</option>)}</select></label><span>{shown.length} sticker{shown.length === 1 ? '' : 's'}</span></div></div>
    {shown.length ? <div className="album-grid">{shown.map(sticker => <StickerCard key={sticker.sticker_id} sticker={sticker} mode={pane} onRemove={() => pane === 'duplicate' ? removeDuplicate(sticker.sticker_id) : removeNeed(sticker.sticker_id)} onUpdateQty={pane === 'duplicate' ? async newQty => { try { await api.updateDuplicateQty(token, sticker.sticker_id, newQty); setDuplicates(d => d.map(x => x.sticker_id === sticker.sticker_id ? { ...x, quantity: newQty } : x)); } catch(err) { setError(err.message); } } : undefined} />)}</div> : <EmptyState text={query ? 'No stickers match your search.' : pane === 'duplicate' ? 'Add your spare stickers to start finding matches.' : 'Add the stickers you’re missing to find your next swap.'} />}
    <details className="album-progress"><summary>Album progress</summary><p>{completionPct}% based on your listed needs · {totalStickers} stickers in this album</p><div className="progress-track"><span style={{ width: `${completionPct}%` }} /></div></details>
    {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={() => { Promise.all([api.getMyDuplicates(token, albumId), api.getMyNeeds(token, albumId)]).then(([dups, needsList]) => { setDuplicates(sortStickersByAlbumOrder(dups, albumId)); setNeeds(sortStickersByAlbumOrder(needsList, albumId)); }).catch(err => setError(err.message)); }} />}
  </div>;
}

// =================================================================
// SWAP PREVIEW MODAL
// Shows the sticker list for a match WITHOUT creating a swap.
// =================================================================
function SwapPreviewModal({ match, onClose, onPropose }) {
  const { token, user } = useAuth();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [proposing, setProposing] = useState(false);

  useEffect(() => {
    api.getSwapPreview(token, match.id)
      .then(setPreview)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, match.id]);

  const handlePropose = async () => {
    setProposing(true);
    setError(null);
    try {
      const { swap } = await api.createSwap(token, match.id);
      onPropose(swap.id);
    } catch (err) {
      if (err.stale) {
        setError('This match is no longer valid as sticker availability has changed. It has been refreshed — please close this and check your Matches tab in a minute for an updated match.');
      } else {
        setError(err.message);
      }
      setProposing(false);
    }
  };

  const isUserA = preview?.userAId === user?.id;
  const youGive = preview ? (isUserA ? preview.aGivesB : preview.bGivesA) : [];
  const youGet = preview ? (isUserA ? preview.bGivesA : preview.aGivesB) : [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Preview your swap" className="modern-dialog fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="modern-dialog-panel w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col" style={{ background: 'var(--surface)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>Swap preview</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>with {match.other_user_name}<AmbassadorMark show={match.ambassador_badge} size={11} /><FounderBadge show={match.founder_member} size={11} /></div>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--text-secondary)" /></button>
        </div>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {loading && <Spinner />}
          {!loading && preview && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>You give ({youGive.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {youGive.map(s => (
                    <div key={s.sticker_id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', fontFamily: 'monospace', minWidth: 50 }}>{s.sticker_number}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.description}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.team_name}</span>
                      </div>
                      {s.also_in_progress && (
                        <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>⚠️ Also part of your swap #{s.other_swap_id}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>You receive ({youGet.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {youGet.map(s => (
                    <div key={s.sticker_id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', background: '#F0FDF9', borderRadius: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', minWidth: 50 }}>{s.sticker_number}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.description}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.team_name}</span>
                      </div>
                      {s.also_in_progress && (
                        <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600 }}>⚠️ {match.other_user_name} has also committed this to another swap in progress</div>
                      )}
                      {s.already_receiving && (
                        <div style={{ fontSize: 11, color: '#3B6FA6', fontWeight: 600 }}>You're already receiving this from swap #{s.already_receiving_swap_id}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, padding: '10px', background: 'var(--bg)', borderRadius: 6 }}>
                This is a preview only — nothing has been proposed yet. Tap "Propose swap" to send this to {match.other_user_name}, or go back if you're not happy with it.
              </p>
            </>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
            Go back
          </button>
          <button onClick={handlePropose} disabled={proposing || loading} style={{ flex: 2, padding: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--primary-dark)', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {proposing && <Loader2 size={14} className="animate-spin" />}
            Propose swap
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchesScreen({ onOpenSwap }) {
  const { token, openProfile } = useAuth();
  const { albumId } = useAlbum();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewingMatch, setPreviewingMatch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMatches(await api.getMatches(token, albumId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, albumId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  return <div className="matches-screen"><section className="matches-hero"><div className="match-illustration" aria-hidden="true"><div><StickerArt index={0} fictional /></div><ArrowRightLeft /><div><StickerArt index={2} fictional /></div></div><h1>Your missing pieces<br />are out there.</h1><p>{matches.length} collector{matches.length === 1 ? '' : 's'} found for you</p></section><div className="matches-content"><ErrorBanner message={error} onDismiss={() => setError(null)} /><div className="section-row"><h2>Your matches ({matches.length})</h2><span>Best matches first</span></div>{matches.length === 0 ? <EmptyState text="No matches yet — list more spares and needs to improve your chances." /> : <div className="match-grid">{[...matches].sort((a,b) => Math.min(b.a_gives_b_count,b.b_gives_a_count)-Math.min(a.a_gives_b_count,a.b_gives_a_count)).map(m => { const swapCount = Math.min(m.a_gives_b_count,m.b_gives_a_count); return <article className="match-card" key={m.id}><div className="match-person"><button className="person-button" onClick={() => openProfile(m.other_user_id)}><CollectorAvatar person={{ name:m.other_user_name }} /><span><strong>{m.other_user_name}<AmbassadorMark show={m.ambassador_badge} /><FounderBadge show={m.founder_member} /></strong><span className="rating-line"><StarRating value={m.rating_avg} size={13} /><small>({m.rating_count})</small></span></span></button><span className="match-count">{swapCount}<small>each way</small></span></div><div className="match-meta"><ActivityIndicator lastLoginAt={m.last_login_at} />{m.distance_miles != null && <span><MapPin size={12} /> ~{m.distance_miles} mi away</span>}</div><div className="match-exchange"><div><strong>You give ({swapCount})</strong><div className="mini-stickers" aria-hidden="true">{Array.from({length:Math.min(swapCount,6)},(_,i) => <StickerArt key={i} index={i} fictional={IS_PREVIEW} />)}</div></div><div><strong>You get ({swapCount})</strong><div className="mini-stickers" aria-hidden="true">{Array.from({length:Math.min(swapCount,6)},(_,i) => <StickerArt key={i} index={5-i} fictional={IS_PREVIEW} />)}</div></div></div><button className="green-button" onClick={() => setPreviewingMatch(m)}>View swap <ArrowRight size={18} /></button>{m.has_conflict && <p className="matching-notice">Some stickers may already be committed. Check the preview before proposing.</p>}</article>; })}</div>}</div>{previewingMatch && <SwapPreviewModal match={previewingMatch} onClose={() => setPreviewingMatch(null)} onPropose={swapId => { setPreviewingMatch(null); onOpenSwap(swapId); }} />}</div>;
}

// =================================================================
// MY SWAPS SCREEN
// =================================================================
const SWAP_STATUS_LABELS = {
  proposed: 'Awaiting acceptance',
  accepted: 'Ready to post',
  posted: 'Posted',
  completed: 'Completed',
  declined: 'Declined',
  disputed: 'Disputed',
};

function getSwapLabel(swap, currentUserId) {
  if (!swap || !currentUserId) return SWAP_STATUS_LABELS[swap?.status] || swap?.status;
  const isUserA = swap.user_a_id === currentUserId;
  const myPosted = isUserA ? swap.user_a_posted : swap.user_b_posted;
  const theirPosted = isUserA ? swap.user_b_posted : swap.user_a_posted;
  const myAccepted = isUserA ? swap.user_a_accepted : swap.user_b_accepted;
  const theirAccepted = isUserA ? swap.user_b_accepted : swap.user_a_accepted;

  if (swap.status === 'proposed') {
    if (myAccepted && !theirAccepted) return 'Waiting for them';
    if (!myAccepted && theirAccepted) return 'Your turn to accept';
    if (!myAccepted && !theirAccepted) return 'Awaiting acceptance';
  }
  if (swap.status === 'accepted') {
    if (myPosted && !theirPosted) return 'Waiting for them to post';
    if (!myPosted && theirPosted) return 'You need to post';
    if (!myPosted && !theirPosted) return 'Ready to post';
  }
  return SWAP_STATUS_LABELS[swap.status] || swap.status;
}

const SWAP_STATUS_COLORS = {
  proposed: { bg: 'var(--warning-light)', text: '#92400E' },
  accepted: { bg: 'var(--success-light)', text: '#065F46' },
  posted: { bg: 'var(--success-light)', text: '#065F46' },
  completed: { bg: 'var(--primary)', text: 'white' },
  declined: { bg: 'var(--bg)', text: 'var(--text-muted)' },
  disputed: { bg: 'var(--danger-light)', text: '#991B1B' },
  'Your turn to accept': { bg: '#FEF3C7', text: '#92400E' },
  'Waiting for them': { bg: 'var(--success-light)', text: '#065F46' },
  'You need to post': { bg: '#FEF3C7', text: '#92400E' },
  'Waiting for them to post': { bg: 'var(--success-light)', text: '#065F46' },
};

function MySwapsScreen({ onOpenSwap }) {
  const { token, user, openProfile } = useAuth();
  const { albumId } = useAlbum();
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.getMySwaps(token, albumId)
      .then(setSwaps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, albumId]);

  if (loading) return <Spinner />;

  const SwapCard = ({ s }) => {
    const label = getSwapLabel(s, user?.id);
    const isActionNeeded = label.includes('Your turn') || label.includes('You need');
    const StatusIcon = s.status === 'completed' ? CheckCircle2 : s.status === 'posted' ? Package : Clock;
    return <article className="swap-ticket">
      <div className="swap-ticket-top"><span>SWAP #{s.id}</span><span className={isActionNeeded ? 'swap-ticket-status action' : 'swap-ticket-status'}><StatusIcon size={14} />{label}</span></div>
      <button className="swap-ticket-person" onClick={() => openProfile(s.other_user_id)}>
        <CollectorAvatar person={{ name: s.other_user_name }} size={46} />
        <span><strong>{s.other_user_name}<AmbassadorMark show={s.ambassador_badge} /><FounderBadge show={s.founder_member} /></strong><small>Your swap partner</small></span><ChevronRight size={18} />
      </button>
      <div className="swap-ticket-exchange">
        <div><span className="swap-mini-card"><Layers size={20} /></span><strong>{s.display_give_count ?? 0}</strong><small>You send</small></div>
        <span className="swap-ticket-arrows"><ArrowRightLeft size={23} /></span>
        <div><span className="swap-mini-card receiving"><Layers size={20} /></span><strong>{s.display_get_count ?? 0}</strong><small>You receive</small></div>
      </div>
      <button className="swap-ticket-open" aria-label={`View swap ${s.id}`} onClick={() => onOpenSwap(s.id)}>View swap details<ArrowRight size={18} /></button>
    </article>;
  };

  const groups = [
    {
      key: 'action',
      title: 'Action needed',
      filter: (s) => {
        const label = getSwapLabel(s, user?.id);
        return label === 'Your turn to accept' || label === 'You need to post';
      },
    },
    {
      key: 'waiting',
      title: 'Waiting for them',
      filter: (s) => {
        const label = getSwapLabel(s, user?.id);
        return label === 'Waiting for them' || label === 'Awaiting acceptance' || label === 'Waiting for them to post' || label === 'Ready to post';
      },
    },
    {
      key: 'posted',
      title: 'In the post',
      filter: (s) => s.status === 'posted',
    },
    {
      key: 'completed',
      title: 'Completed',
      filter: (s) => s.status === 'completed',
    },
    {
      key: 'disputed',
      title: 'Disputed',
      filter: (s) => s.status === 'disputed',
    },
  ];

  const hasAny = swaps.length > 0;

  return (
    <div>
      <SectionHeader eyebrow="FROM HELLO TO HAPPY POST" title="Your swaps" /><p className="screen-intro">Know what’s next, every step of the way.</p>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {!hasAny ? (
        <EmptyState text="No swaps yet — propose one from your matches." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(group => {
            const items = swaps.filter(group.filter);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {group.title}
                  <span style={{ background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>{items.length}</span>
                </div>
                <div className="swap-ticket-grid">
                  {items.map(s => <SwapCard key={s.id} s={s} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =================================================================
// SWAP DETAIL SCREEN
// =================================================================
const FB_GROUP = 'https://www.facebook.com/groups/849861075871339/';
const AMBASSADOR_POST = `Just completed another sticker swap using Got One Spare! ⚽
It automatically finds people who need your spares and have the stickers you're missing.
It's completely free and has already helped me complete more swaps.
https://gotonespare.com`;

function AmbassadorCard({ token, swapId }) {
  const [status, setStatus] = useState('loading');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('none'); return; }
    api.getAmbassadorStatus(token)
      .then(d => setStatus(d?.status || 'none'))
      .catch(() => { setStatus('none'); });
  }, [token]);

  if (status === 'loading') return null;
  if (error) return null;

  if (status === 'approved') {
    return (
      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🏅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>Ambassador badge earned!</div>
          <div style={{ fontSize: 12, color: '#065F46' }}>Thanks for spreading the word about Got One Spare?</div>
        </div>
      </div>
    );
  }

  if (status === 'pending' || (submitted && status !== 'approved')) {
    return (
      <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>⏳</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Under review</div>
          <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.4 }}>We'll check within 24 hours and award your Ambassador badge.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🏅</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Become a Got One Spare ambassador</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Share on Facebook to earn your badge</div>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: copied ? 'var(--primary)' : 'var(--text-primary)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>1</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Copy the post text below.
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: '6px 0', fontStyle: 'italic', whiteSpace: 'pre-line' }}>{AMBASSADOR_POST}</div>
            <button
              onClick={() => { navigator.clipboard.writeText(AMBASSADOR_POST).catch(() => {}); setCopied(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              📋 {copied ? 'Copied!' : 'Copy post text'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--navy)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>2</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Open the Facebook group, paste the post and share it.
            <div style={{ marginTop: 8 }}>
              <a
                href={FB_GROUP}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: '#1877F2', color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Open Facebook group
              </a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--navy)', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>3</div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            We'll check within 24 hours and award your badge.
          </div>
        </div>

        <button
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              await api.submitAmbassador(token, swapId);
              setSubmitted(true);
              setStatus('pending');
            } catch(e) {
              setSubmitting(false);
            }
          }}
          style={{ width: '100%', padding: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
        >
          ✓ I've shared it on Facebook
        </button>
      </div>
    </div>
  );
}

function SwapDetailScreen({ swapId, onRated, onBack, onOpenSwap }) {
  const { token, user, openProfile } = useAuth();
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [postagePhoto, setPostagePhoto] = useState(null);
  const [postagePhotoPreview, setPostagePhotoPreview] = useState(null);
  const [stickerPhoto, setStickerPhoto] = useState(null);
  const [stickerPhotoPreview, setStickerPhotoPreview] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null);
  const [disputeFiled, setDisputeFiled] = useState(false);
  const [needsRestored, setNeedsRestored] = useState(false);
  const [restoringNeeds, setRestoringNeeds] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [findingMatch, setFindingMatch] = useState(false);
  const [noMoreMatches, setNoMoreMatches] = useState(false);
  const [nextMatch, setNextMatch] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef(null);
  const shouldScrollChat = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const fresh = await api.getSwap(token, swapId);
      setData(fresh);
    } catch (err) {
      setError(err.message);
    } finally {
      setInitialLoading(false);
    }
  }, [token, swapId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!data || ['completed', 'declined', 'disputed'].includes(data.swap.status)) {
      return;
    }
    const interval = setInterval(() => {
      api.getSwap(token, swapId).then(setData).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.swap?.status, token, swapId]);

  useEffect(() => {
    const loadMessages = () =>
      api.getMessages(token, swapId).then(setMessages).catch(() => {});
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [token, swapId]);

  useEffect(() => {
    if (!shouldScrollChat.current) return;
    shouldScrollChat.current = false;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const sendMessage = async () => {
    const body = messageInput.trim();
    if (!body) return;
    setSendingMessage(true);
    setMessageInput('');
    shouldScrollChat.current = true;
    try {
      const msg = await api.sendMessage(token, swapId, body);
      setMessages((m) => [...m, msg]);
    } catch (err) {
      setMessageInput(body);
      shouldScrollChat.current = false;
      setError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  if (initialLoading) return <Spinner />;
  if (!data) return <ErrorBanner message={error || 'Swap not found'} onDismiss={() => {}} />;

  const { swap, items, otherUserAddress, otherUser } = data;
  const isUserA = swap.user_a_id === user.id;
  const owedItems = items.filter((item) => item.to_user_id === user.id);

  const restoreNeeds = async () => {
    setRestoringNeeds(true);
    try {
      await api.addNeedsBulk(token, owedItems.map((item) => item.sticker_id));
      setNeedsRestored(true);
      setActionConfirm('Added back to your needs list');
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoringNeeds(false);
    }
  };

  const findAnotherMatch = async () => {
    setFindingMatch(true);
    setNoMoreMatches(false);
    setError(null);
    try {
      const matches = await api.getMatches(token, swap.album_id);
      if (!matches.length) {
        setNoMoreMatches(true);
      } else {
        const top = [...matches].sort(
          (a, b) => Math.min(b.a_gives_b_count, b.b_gives_a_count) - Math.min(a.a_gives_b_count, a.b_gives_a_count)
        )[0];
        setNextMatch(top);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setFindingMatch(false);
    }
  };

  const youGive = sortStickersByAlbumOrder(items.filter((i) => i.from_user_id === user.id), swap.album_id);
  const youReceive = sortStickersByAlbumOrder(items.filter((i) => i.to_user_id === user.id), swap.album_id);
  const otherName = otherUser?.name || otherUserAddress?.name || (isUserA ? `User #${swap.user_b_id}` : `User #${swap.user_a_id}`);
  const otherIsAmbassador = Boolean(otherUser?.ambassador_badge);
  const otherIsFounder = Boolean(otherUser?.founder_member);
  const otherUserId = isUserA ? swap.user_b_id : swap.user_a_id;

  const act = async (fn, confirmMsg) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      const fresh = await api.getSwap(token, swapId);
      setData(fresh);
      if (confirmMsg) {
        setActionConfirm(confirmMsg);
        setTimeout(() => setActionConfirm(null), 3000);
      }
    } catch (err) {
      if (err.autoDeclined) {
        try {
          const fresh = await api.getSwap(token, swapId);
          setData(fresh);
        } catch {}
        setActionConfirm('This swap was automatically cancelled as the stickers were no longer available. A fresh match will appear in your Matches tab shortly.');
        setTimeout(() => setActionConfirm(null), 6000);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 swap-detail">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {actionConfirm && (
        <div style={{ background: 'var(--blue-light)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>
          <span style={{ fontSize: 18 }}>✓</span>
          {actionConfirm}
        </div>
      )}

      {onBack && (
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← Back to My Swaps
        </button>
      )}

      {swap.status === 'declined' && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>❌</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#991B1B', marginBottom: 4 }}>This swap was declined</div>
            <div style={{ fontSize: 13, color: '#991B1B' }}>
              {swap.declined_by_id === user.id
                ? `You declined this swap. If you change your mind, you can propose a new swap from the Matches tab.`
                : `${otherName} declined this swap.`
              }
            </div>
            {swap.decline_reason && (() => {
              const reason = swap.decline_reason;
              const friendlyReason = reason === 'Withdrawn by proposer'
                ? `${otherName} withdrew the swap proposal before it was accepted.`
                : reason === 'Withdrawn after acceptance'
                  ? `${otherName} withdrew from this swap after accepting, before either of you posted. Your stickers are available for new matches.`
                  : reason.startsWith('Automatically declined')
                    ? 'This swap was automatically cancelled by the system because sticker availability changed. A fresh match will appear in your Matches tab shortly.'
                    : `"${reason}"`;
              const isInternal = reason === 'Withdrawn by proposer' || reason === 'Withdrawn after acceptance' || reason.startsWith('Automatically declined');
              return (
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(153,27,27,0.08)', borderRadius: 6, fontSize: 13, color: '#7F1D1D', fontStyle: isInternal ? 'normal' : 'italic' }}>
                  {friendlyReason}
                </div>
              );
            })()}
            {!swap.decline_reason && swap.declined_by_id !== user.id && (
              <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 4 }}>No reason was given.</div>
            )}
          </div>
        </div>
      )}

      {swap.status === 'declined' && (
        <div>
          <button
            onClick={findAnotherMatch}
            disabled={findingMatch}
            className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: 'var(--primary-dark)', color: 'var(--surface)', opacity: findingMatch ? 0.7 : 1 }}
          >
            {findingMatch && <Loader2 className="animate-spin" size={14} />} Find another collector
          </button>
          {noMoreMatches && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 8 }}>
              No alternative matches available yet. We'll notify you when another collector joins.
            </div>
          )}
        </div>
      )}

      {showDeclineModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', padding: 24, width: '100%', maxWidth: 480 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Decline this swap?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              You can optionally let {otherName} know why — this helps them understand and improve future swap requests.
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Optional: e.g. I've already found someone for these stickers, or I need more time to decide…"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowDeclineModal(false); setDeclineReason(''); }}
                style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  act(() => api.declineSwap(token, swap.id, declineReason.trim() || undefined));
                  setDeclineReason('');
                }}
                style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-sm)', background: '#EF4444', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'white' }}
              >
                Decline swap
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="swap-partner-card">
        <div className="swap-partner-reference"><ArrowRightLeft size={15} /><span>SWAP #{swap.id}</span></div>
        <button className="swap-partner-profile" onClick={() => openProfile(otherUserId)} aria-label={`View ${otherName}'s profile`}>
          <CollectorAvatar person={{ name: otherName, profile_photo: otherUser?.profile_photo }} size={58} />
          <span className="swap-partner-info"><small>YOUR SWAP PARTNER</small><strong>{otherName}<AmbassadorMark show={otherIsAmbassador} size={16} /><FounderBadge show={otherIsFounder} size={16} /></strong><span className="swap-partner-activity">{otherUser?.last_login_at ? <ActivityIndicator lastLoginAt={otherUser.last_login_at} size={12} /> : 'Activity unavailable'}</span></span>
          <span className="swap-partner-link"><UserRound size={18} /><span>Profile</span><ChevronRight size={15} /></span>
        </button>
      </section>

      <div className="swap-status-banner"><Truck size={28} /><div><h2>{getSwapLabel(swap, user.id)}</h2><p>Swap with {otherName} · {youGive.length} stickers each way</p></div></div>
      {swap.status !== 'declined'  && (() => {
        const myPosted = isUserA ? swap.user_a_posted : swap.user_b_posted;
        const myReceived = isUserA ? swap.user_a_received : swap.user_b_received;
        const bothAccepted = swap.user_a_accepted && swap.user_b_accepted;

        let currentStepIdx;
        if (swap.status === 'completed') currentStepIdx = 5;
        else if (myReceived) currentStepIdx = 4;
        else if (swap.status === 'posted') currentStepIdx = 3;
        else if (myPosted) currentStepIdx = 2;
        else if (bothAccepted) currentStepIdx = 1;
        else currentStepIdx = 0;

        const STEP_LABELS = ['Proposal sent', 'Accepted', 'You posted', 'Both posted', 'You received', 'Completed'];

        return (
          <div className="swap-timeline">
            <div className="timeline-inner">
              {STEP_LABELS.map((label, i) => {
                const isPast = i < currentStepIdx;
                const isCurrent = i === currentStepIdx;
                return (
                  <React.Fragment key={label}>
                    <div className="flex flex-col items-center gap-1" style={{ flexShrink: 0 }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
                        background: isPast ? 'var(--primary-dark)' : isCurrent ? 'var(--warning)' : 'var(--bg)',
                        color: isPast ? 'var(--surface)' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                        border: isCurrent ? '2px solid var(--warning)' : 'none',
                      }}>
                        {isPast ? <CheckCircle2 size={13} /> : isCurrent ? <Clock size={12} /> : i + 1}
                      </div>
                      <span className="text-[9px] font-medium" style={{ color: isPast ? 'var(--primary-dark)' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'normal' }}>
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div className="flex-1 h-0.5 mb-4" style={{ background: isPast ? 'var(--primary-dark)' : 'var(--border)', minWidth: 16 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="swap-item-trays">
        {items.length === 0 && swap.status === 'proposed' ? (
          <div style={{ gridColumn: '1 / -1', padding: '20px', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>
              {swap.predicted_count || '?'} stickers each way
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Sticker list loading…
            </div>
          </div>
        ) : (
          <>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--danger)' }}>You send</div>
              <div className="swap-sticker-grid">
                {youGive.map((s) => (
                  <div key={s.sticker_id}>
                    <StickerCard sticker={s} qtyOverride={1} />
                    {s.also_in_progress && (
                      <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginTop: 2, padding: '0 2px' }}>⚠️ Also part of swap #{s.other_swap_id}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center rotate-90 md:rotate-0" style={{ background: 'var(--warning)' }}>
                <ArrowRightLeft size={18} color="var(--text-primary)" />
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--primary-dark)' }}>You receive</div>
              <div className="swap-sticker-grid">
                {youReceive.map((s) => (
                  <div key={s.sticker_id}>
                    <StickerCard sticker={s} qtyOverride={1} />
                    {s.also_in_progress && (
                      <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginTop: 2, padding: '0 2px' }}>⚠️ {otherName} has also committed this to swap #{s.other_swap_id}</div>
                    )}
                    {s.already_receiving && (
                      <div style={{ fontSize: 11, color: '#3B6FA6', fontWeight: 600, marginTop: 2, padding: '0 2px' }}>You're already receiving this from swap #{s.already_receiving_swap_id}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {items.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          This list was fixed when the swap was proposed, so it won't change even if your needs or duplicates change afterward.
        </p>
      )}

      {swap.status === 'proposed' && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          Proposed {formatSwapAge(swap.created_at)}
        </p>
      )}

      {swap.status === 'proposed' && (() => {
        const myAccepted = isUserA ? swap.user_a_accepted : swap.user_b_accepted;
        const theirAccepted = isUserA ? swap.user_b_accepted : swap.user_a_accepted;

        if (myAccepted) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: 'var(--success-light)', border: '1px solid #A7F3D0', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)' }}>You've accepted ✓</div>
                  <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 2 }}>
                    {theirAccepted
                      ? "You've both accepted — stickers are being confirmed now..."
                      : `Waiting for ${otherName} to also accept — everyone has to confirm before it's locked in, even the person who proposed it. You don't need to do anything else right now.`}
                  </div>
                </div>
              </div>
              {!theirAccepted && (
                <button
                  onClick={async () => {
                    if (await confirmAction(`Withdraw from this swap? ${otherName} will be notified and your stickers will become available for new matches again.`)) {
                      act(() => api.withdrawSwap(token, swap.id));
                    }
                  }}
                  disabled={busy}
                  style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'none', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Withdraw from swap
                </button>
              )}
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="swap-decision-prompt">
              <span className="swap-decision-icon"><Clock size={23} /></span>
              <div><strong>Your turn to decide</strong><p>{theirAccepted
                ? `${otherName} has accepted. Review the swap, then accept or decline.`
                : 'Review the stickers below, then accept or decline this swap.'}</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeclineModal(true)} disabled={busy} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                Decline
              </button>
              <button onClick={() => act(() => api.acceptSwap(token, swap.id), '✓ Swap accepted! Waiting for the other person to accept too.')} disabled={busy} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
                {busy && <Loader2 className="animate-spin" size={14} />} Accept swap
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Sticker photo — share evidence of what you're sending ── */}
      {(swap.status === 'accepted' || swap.status === 'posted') && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Camera size={18} /> Sticker photos
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your stickers</div>
            {(isUserA ? swap.user_a_sticker_photo : swap.user_b_sticker_photo) && !stickerPhotoPreview ? (
              <img
                src={isUserA ? swap.user_a_sticker_photo : swap.user_b_sticker_photo}
                alt="Your stickers"
                onClick={() => setLightboxSrc(isUserA ? swap.user_a_sticker_photo : swap.user_b_sticker_photo)}
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
              />
            ) : stickerPhotoPreview ? (
              <div style={{ position: 'relative' }}>
                <img src={stickerPhotoPreview} alt="Your stickers" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button onClick={() => { setStickerPhoto(null); setStickerPhotoPreview(null); }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                <button onClick={async () => { setBusy(true); try { await api.uploadStickerPhoto(token, swap.id, stickerPhoto); const fresh = await api.getSwap(token, swapId); setData(fresh); setStickerPhoto(null); setStickerPhotoPreview(null); } catch(err) { setError(err.message); } finally { setBusy(false); } }} disabled={busy} style={{ marginTop: 6, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {busy ? 'Uploading...' : '✓ Share this photo'}
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 0' }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const img = new window.Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const MAX = 900;
                      let w = img.width, h = img.height;
                      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                      canvas.width = w; canvas.height = h;
                      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                      setStickerPhoto(dataUrl);
                      setStickerPhotoPreview(dataUrl);
                    };
                    img.src = ev.target.result;
                  };
                  reader.readAsDataURL(file);
                }} />
                <Camera size={23} className="upload-symbol" />
                <span>Add photo of your stickers <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(optional)</span></span>
              </label>
            )}
          </div>

          {(isUserA ? swap.user_b_sticker_photo : swap.user_a_sticker_photo) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{otherName}'s stickers</div>
              <img
                src={isUserA ? swap.user_b_sticker_photo : swap.user_a_sticker_photo}
                alt="Their stickers"
                onClick={() => setLightboxSrc(isUserA ? swap.user_b_sticker_photo : swap.user_a_sticker_photo)}
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>
      )}

      {(swap.status === 'accepted' || swap.status === 'posted') && !(isUserA ? swap.user_a_posted : swap.user_b_posted) && otherUserAddress?.address_line1 && otherUserAddress?.city && (
        <div className="rounded-lg p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} color="var(--primary-dark)" />
            <span className="text-sm font-bold" style={{ color: 'var(--primary-dark)' }}>Post to</span>
          </div>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            {otherUserAddress.name}<br />
            {otherUserAddress.address_line1}<br />
            {otherUserAddress.city}, {otherUserAddress.postcode}
          </div>

          <div style={{ marginTop: 12 }}>
            {postagePhotoPreview ? (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <img src={postagePhotoPreview} alt="Postage proof" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button
                  onClick={() => { setPostagePhoto(null); setPostagePhotoPreview(null); }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Postage proof photo added ✓</div>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 0' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const img = new window.Image();
                      img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX = 800;
                        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                        canvas.width = img.width * ratio;
                        canvas.height = img.height * ratio;
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                        setPostagePhoto(dataUrl);
                        setPostagePhotoPreview(dataUrl);
                      };
                      img.src = ev.target.result;
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <Camera size={23} className="upload-symbol" />
                <span>Add proof of postage photo <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(optional)</span></span>
              </label>
            )}
          </div>

          <button onClick={() => act(() => api.markPosted(token, swap.id, postagePhoto || undefined), '✓ Marked as posted — the other person has been notified!')} disabled={busy} className="yellow-button" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Package size={15} />} Mark as posted
          </button>

          {!swap.user_a_posted && !swap.user_b_posted && (
            <button
              onClick={async () => {
                if (await confirmAction(`Withdraw from this accepted swap? ${otherName} will be notified and your stickers will become available for new matches again.`)) {
                  act(() => api.withdrawSwap(token, swap.id));
                }
              }}
              disabled={busy}
              style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'none', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Withdraw from swap
            </button>
          )}
        </div>
      )}

      {swap.status === 'accepted' && !(otherUserAddress?.address_line1 && otherUserAddress?.city) && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FBF1D9', border: '1px solid #E8D9A8', color: '#5C4711' }}>
          Waiting for {otherName} to add their address before you can post. This page will update automatically.
        </div>
      )}

      {swap.status === 'posted' && !(isUserA ? swap.user_a_received : swap.user_b_received) && (() => {
        const aAt = swap.user_a_posted_at ? new Date(swap.user_a_posted_at) : null;
        const bAt = swap.user_b_posted_at ? new Date(swap.user_b_posted_at) : null;
        const bothPostedAt = (aAt && bAt) ? new Date(Math.max(aAt, bAt)) : new Date(swap.updated_at);
        const daysSince = Math.max(0, Math.floor((Date.now() - bothPostedAt) / 86_400_000));
        const dayLabel = `Day ${daysSince + 1}`;
        const barFilled = Math.min(daysSince + 1, 3);
        const overdue = daysSince >= 7;

        return (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}><Truck size={18} className="inline-symbol" /> Estimated delivery</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>2–3 working days from posting (Royal Mail 2nd class estimate)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 44, fontFamily: 'monospace' }}>{dayLabel}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(barFilled / 3) * 100}%`, background: overdue ? 'var(--warning)' : 'var(--primary)', transition: 'width 0.3s' }} />
              </div>
            </div>
            {overdue && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>
                <strong>Not arrived?</strong> You can message your swap partner using the chat below, or report a problem if it's been a while.
              </div>
            )}
          </div>
        );
      })()}

      {(swap.status === 'accepted' || swap.status === 'posted') && (isUserA ? swap.user_b_posted : swap.user_a_posted) && !(isUserA ? swap.user_a_received : swap.user_b_received) && (
        <button onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.markReceived(token, swap.id);
            const fresh = await api.getSwap(token, swapId);
            setData(fresh);
            // Only open the rating modal once the swap is actually
            // completed (both sides confirmed) — rating is blocked
            // server-side until then, so opening it early just leads
            // to a confusing failed submission.
            if (fresh.swap.status === 'completed') {
              setShowRating(true);
            } else {
              setActionConfirm(`✓ Marked as received! Waiting for ${otherName} to confirm too — you'll be able to rate them once they do.`);
              setTimeout(() => setActionConfirm(null), 5000);
            }
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }} disabled={busy} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--warning)', color: 'var(--text-primary)' }}>
          {busy && <Loader2 className="animate-spin" size={14} />} Mark stickers as received
        </button>
      )}

      {/* Standalone proof of postage upload — shown after posting, per-user (fixed) */}
      {(swap.status === 'accepted' || swap.status === 'posted') && (isUserA ? swap.user_a_posted : swap.user_b_posted) && !(isUserA ? swap.user_a_postage_photo : swap.user_b_postage_photo) && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}><Camera size={18} className="inline-symbol" /> Add proof of postage (optional)</div>
          {postagePhotoPreview ? (
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <img src={postagePhotoPreview} alt="Postage proof" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)' }} />
              <button onClick={() => { setPostagePhoto(null); setPostagePhotoPreview(null); }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <button onClick={() => act(() => api.markPosted(token, swap.id, postagePhoto), '✓ Proof of postage uploaded!')} disabled={busy} style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Upload proof
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const img = new window.Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX = 800;
                    const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
                    canvas.width = img.width * ratio;
                    canvas.height = img.height * ratio;
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                    setPostagePhoto(dataUrl);
                    setPostagePhotoPreview(dataUrl);
                  };
                  img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
              }} />
              <Camera size={23} className="upload-symbol" />
              <span>Tap to add a photo of your proof of postage</span>
            </label>
          )}
        </div>
      )}

      {/* Proof of postage display — per-user, so both sides get their own slot */}
      {(swap.status === 'accepted' || swap.status === 'posted' || swap.status === 'completed') && (swap.user_a_postage_photo || swap.user_b_postage_photo || swap.postage_photo) && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Camera size={18} className="inline-symbol" /> Proof of postage
          </div>

          {(isUserA ? swap.user_a_postage_photo : swap.user_b_postage_photo) && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Yours</div>
              <img
                src={isUserA ? swap.user_a_postage_photo : swap.user_b_postage_photo}
                alt="Your proof of postage"
                onClick={() => setLightboxSrc(isUserA ? swap.user_a_postage_photo : swap.user_b_postage_photo)}
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
              />
            </div>
          )}

          {(isUserA ? swap.user_b_postage_photo : swap.user_a_postage_photo) && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>{otherName}'s</div>
              <img
                src={isUserA ? swap.user_b_postage_photo : swap.user_a_postage_photo}
                alt="Their proof of postage"
                onClick={() => setLightboxSrc(isUserA ? swap.user_b_postage_photo : swap.user_a_postage_photo)}
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
              />
            </div>
          )}

          {!swap.user_a_postage_photo && !swap.user_b_postage_photo && swap.postage_photo && (
            <img
              src={swap.postage_photo}
              alt="Proof of postage"
              onClick={() => setLightboxSrc(swap.postage_photo)}
              style={{ width: '100%', maxHeight: 320, objectFit: 'contain', background: '#F3F4F6', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
            />
          )}
        </div>
      )}

      {swap.status === 'disputed' && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FBEAEA', border: '1px solid #E8B4B4', color: '#9A1F1F' }}>
          This swap has been flagged for review. {disputeFiled ? "We've notified the other person." : 'Check back for updates.'}
        </div>
      )}

      {swap.status === 'disputed' && owedItems.length > 0 && (
        <button
          onClick={restoreNeeds}
          disabled={restoringNeeds || needsRestored}
          className="w-full py-2.5 rounded text-sm font-semibold"
          style={{
            background: needsRestored ? 'var(--border)' : 'var(--primary)',
            color: needsRestored ? 'var(--text-muted)' : '#fff',
            opacity: restoringNeeds ? 0.7 : 1,
          }}
        >
          {needsRestored ? '✓ Added back to your needs list' : 'Not received your stickers? Add them back to your needs list'}
        </button>
      )}

      {swap.status === 'completed' && (
        <button onClick={() => setShowRating(true)} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--warning)', color: 'var(--text-primary)' }}>
          <Star size={15} /> Rate this swap
        </button>
      )}

      {!['proposed', 'declined', 'disputed'].includes(swap.status) && (
        <button onClick={() => setShowDispute(true)} className="w-full text-center text-xs font-medium underline" style={{ color: '#9A1F1F' }}>
          Report a problem with this swap
        </button>
      )}

      {showRating && (
        <RatingModal
          swapId={swap.id}
          otherUserName={otherName}
          onClose={() => setShowRating(false)}
          onSubmitted={onRated}
        />
      )}

      {showDispute && (
        <DisputeModal
          swapId={swap.id}
          otherUserName={otherName}
          onClose={() => setShowDispute(false)}
          onFiled={() => {
            setDisputeFiled(true);
            load();
          }}
        />
      )}

      {nextMatch && (
        <SwapPreviewModal
          match={nextMatch}
          onClose={() => setNextMatch(null)}
          onPropose={(newSwapId) => {
            setNextMatch(null);
            onOpenSwap?.(newSwapId);
          }}
        />
      )}

      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <X size={20} color="white" />
          </button>
          <img src={lightboxSrc} alt="Full size" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
        </div>
      )}

      {/* ---- Chat panel ---- */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowChat((c) => !c)}
          style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={16} color="var(--primary)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: otherIsFounder ? '#B45309' : 'var(--text-primary)' }}>
              Chat with {otherName}<AmbassadorMark show={otherIsAmbassador} size={12} /><FounderBadge show={otherIsFounder} size={12} />
            </span>
            {messages.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({messages.length})</span>
            )}
          </div>
          <span style={{ fontSize: 18, color: 'var(--text-muted)', lineHeight: 1 }}>{showChat ? '−' : '+'}</span>
        </button>

        {showChat && (
          <>
            <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
                  No messages yet. Say hello!
                </p>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user.id;
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '8px 12px',
                        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isMe ? 'var(--primary)' : 'var(--bg)',
                        color: isMe ? 'white' : 'var(--text-primary)',
                        fontSize: 13, lineHeight: 1.4,
                      }}>
                        {m.body}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                        {isMe ? 'You' : m.sender_name} · {formatMessageTimestamp(m.created_at)}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Type a message…"
                rows={1}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  fontSize: 13, resize: 'none', fontFamily: 'inherit',
                  lineHeight: 1.4, maxHeight: 80, overflowY: 'auto',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim() || sendingMessage}
                style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: messageInput.trim() ? 'var(--primary)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: messageInput.trim() ? 'pointer' : 'default', transition: 'background 0.15s',
                }}
              >
                {sendingMessage
                  ? <Loader2 size={14} className="animate-spin" color="var(--text-muted)" />
                  : <Send size={14} color={messageInput.trim() ? 'white' : 'var(--text-muted)'} />
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// MESSAGES SCREEN
// =================================================================
function MessagesScreen({ pendingOpenUserId, onPendingOpened } = {}) {
  const { token, user, openProfile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [reportingId, setReportingId] = useState(null);
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations(token);
      setConversations(data);
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const openConversation = async (convId, otherUser) => {
    setActiveConv({ conversationId: convId, otherUser });
    setError(null);
    try {
      const { messages: msgs, otherUser: freshOtherUser, isBlocked } = await api.getConversationMessages(token, convId);
      setMessages(msgs);
      if (freshOtherUser) setActiveConv({ conversationId: convId, otherUser: freshOtherUser, isBlocked });
      loadConversations();
    } catch (err) { setError(err.message); }
  };

  const toggleBlock = async () => {
    if (!activeConv?.otherUser?.id) return;
    const wasBlocked = activeConv.isBlocked;
    if (!wasBlocked && !await confirmAction(`Block ${activeConv.otherUser.name}? They won't be able to message you, and you won't be able to message them.`)) return;
    try {
      if (wasBlocked) await api.unblockUser(token, activeConv.otherUser.id);
      else await api.blockUser(token, activeConv.otherUser.id);
      setActiveConv(prev => ({ ...prev, isBlocked: !wasBlocked }));
    } catch (err) { setError(err.message); }
  };

  useEffect(() => {
    if (!pendingOpenUserId || loading) return;
    const match = conversations.find(c => c.other_user_id === pendingOpenUserId);
    if (match) {
      openConversation(match.conversation_id, {
        id: match.other_user_id,
        name: match.other_user_name,
        ambassador_badge: match.other_user_ambassador_badge,
        founder_member: match.other_user_founder_member,
        last_login_at: match.other_user_last_login_at,
      });
    }
    onPendingOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpenUserId, loading, conversations]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConv) return;
    setSending(true);
    try {
      const msg = await api.sendDirectMessage(token, activeConv.conversationId, newMessage);
      setMessages(prev => [...prev, { ...msg, sender_name: user.name, sender_id: user.id }]);
      setNewMessage('');
      loadConversations();
    } catch (err) { setError(err.message); }
    finally { setSending(false); }
  };

  const reportMessage = async (messageId) => {
    await api.reportMessage(token, messageId, 'Reported by user').catch(() => {});
    setReportingId(null);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  };

  if (activeConv) {
    return (
      <div className="conversation-screen" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
        <div className="conversation-header" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <button onClick={() => { setActiveConv(null); setMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>← Back</button>
          <CollectorAvatar person={activeConv.otherUser} size={44} /><div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <button onClick={() => openProfile(activeConv.otherUser?.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontWeight: 700, fontSize: 15, color: activeConv.otherUser?.founder_member ? '#B45309' : 'var(--text-primary)' }}>
              {activeConv.otherUser?.name}<AmbassadorMark show={activeConv.otherUser?.ambassador_badge} /><FounderBadge show={activeConv.otherUser?.founder_member} />
            </button>
            <ActivityIndicator lastLoginAt={activeConv.otherUser?.last_login_at} size={11} />
          </div>
          <button onClick={toggleBlock} style={{ fontSize: 11, fontWeight: 600, color: activeConv.isBlocked ? 'var(--primary)' : 'var(--danger)', background: 'none', border: `1px solid ${activeConv.isBlocked ? 'var(--primary)' : 'var(--danger)'}`, borderRadius: 'var(--radius-full)', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {activeConv.isBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>

        {activeConv.isBlocked && (
          <div style={{ background: 'var(--danger-light)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#991B1B', textAlign: 'center' }}>
            You've blocked this user — they can't message you and you can't message them.
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>
          Messages may be reviewed by the admin team for safety. Be kind and respectful.
        </p>

        <div className="conversation-messages" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => {
            const isMe = m.sender_id === user.id;
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div className={`chat-bubble ${isMe ? "sent" : "received"}`} style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: isMe ? 'var(--primary)' : 'var(--surface)', color: isMe ? 'white' : 'var(--text-primary)',
                  border: isMe ? 'none' : '1px solid var(--border)', fontSize: 14, lineHeight: 1.5,
                }}>
                  {m.body}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                  <span>{formatMessageTimestamp(m.created_at)}</span>
                  {!isMe && (
                    <button onClick={() => setReportingId(m.id)} style={{ fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Report</button>
                  )}
                </div>
                {reportingId === m.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={() => reportMessage(m.id)} style={{ fontSize: 11, padding: '3px 8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: 12, cursor: 'pointer' }}>Confirm report</button>
                    <button onClick={() => setReportingId(null)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <div className="conversation-composer" style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={activeConv.isBlocked ? "You've blocked this user" : "Type a message…"}
            disabled={activeConv.isBlocked}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14 }}
          />
          <button aria-label="Send message" onClick={sendMessage} disabled={sending || !newMessage.trim() || activeConv.isBlocked} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: activeConv.isBlocked ? 0.5 : 1 }}>
            <span style={{ color: 'white', fontSize: 18 }}>↑</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-screen">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionHeader eyebrow="GOOD SWAPS START WITH A HELLO" title="Your conversations" />
        <Btn variant="primary" size="sm" onClick={() => setShowNewMessage(true)}>+ New</Btn>
      </div>

      <p className="screen-intro">Make plans, compare lists and keep in touch with your collectors.</p>
      {loading && <Spinner />}
      {!loading && conversations.length === 0 && (
        <EmptyState text="No messages yet. Start a conversation from the Search tab or from a swap." />
      )}
      {conversations.map(c => (
        <button className="conversation-card" key={c.conversation_id} onClick={() => openConversation(c.conversation_id, { id: c.other_user_id, name: c.other_user_name, ambassador_badge: c.other_user_ambassador_badge, founder_member: c.other_user_founder_member, last_login_at: c.other_user_last_login_at })}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, position: 'relative' }}>
            {c.other_user_name?.split(' ').map(p => p[0]).join('')}
            {c.unread_count > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread_count}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: c.unread_count > 0 ? 700 : 600, fontSize: 14, color: c.other_user_founder_member ? '#B45309' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              {c.other_user_name}<AmbassadorMark show={c.other_user_ambassador_badge} /><FounderBadge show={c.other_user_founder_member} />
              <ActivityIndicator lastLoginAt={c.other_user_last_login_at} showText={false} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.last_sender_id === user.id ? 'You: ' : ''}{c.last_message || 'No messages yet'}
            </div>
          </div>
          {c.last_message_at && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              {new Date(c.last_message_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </button>
      ))}

      {showNewMessage && (
        <NewMessageModal
          onClose={() => setShowNewMessage(false)}
          onStarted={(convId, otherUser) => {
            setShowNewMessage(false);
            openConversation(convId, otherUser);
            loadConversations();
          }}
        />
      )}
    </div>
  );
}

function NewMessageModal({ onClose, onStarted }) {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(() => {
      api.searchUsers(token, query).then(setResults).catch(() => {});
    }, 300);
    return () => clearTimeout(h);
  }, [query, token]);

  const send = async () => {
    if (!selected || !body.trim()) return;
    setSending(true);
    try {
      const { conversationId } = await api.startConversation(token, selected.id, body);
      onStarted(conversationId, selected);
    } catch (err) { setError(err.message); setSending(false); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="New message" className="modern-dialog fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="modern-dialog-panel w-full sm:max-w-md sm:rounded-lg rounded-t-lg" style={{ background: 'var(--surface)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>New message</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} color="var(--text-muted)" /></button>
        </div>
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        {!selected ? (
          <>
            <input autoFocus type="text" placeholder="Search for a user…" value={query} onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box', marginBottom: 8 }} />
            {results.map(u => (
              <button key={u.id} onClick={() => setSelected(u)} style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginBottom: 4, fontSize: 14, color: 'var(--text-primary)' }}>
                {u.name}<AmbassadorMark show={u.ambassador_badge} size={11} /><FounderBadge show={u.founder_member} size={11} /> {u.city && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {u.city}</span>}
              </button>
            ))}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>To: {selected.name}<AmbassadorMark show={selected.ambassador_badge} size={11} /><FounderBadge show={selected.founder_member} size={11} /></span>
              <button onClick={() => setSelected(null)} style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Change</button>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message…" rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
            <Btn variant="primary" onClick={send} disabled={sending || !body.trim()} style={{ width: '100%', justifyContent: 'center' }}>
              {sending ? 'Sending…' : 'Send message'}
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// SWAP HISTORY SCREEN
// =================================================================
function SwapHistoryScreen() {
  const { token, user, openProfile } = useAuth();
  const { albumId } = useAlbum();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getSwapHistory(token, albumId)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, albumId]);

  if (loading) return <Spinner />;

  return (
    <div className="history-screen">
      <SectionHeader eyebrow="Your record" title="Your swap story." /><p className="screen-intro">A record of the collections you’ve helped complete.</p>
      {history.length === 0 ? (
        <EmptyState text="No completed or declined swaps yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(s => {
            const isCompleted = s.status === 'completed';
            return (
              <div className="history-card" key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <button
                    onClick={() => openProfile(s.other_user_id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: isCompleted ? 'var(--primary-light)' : 'var(--bg)', color: isCompleted ? 'var(--primary-dark)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {s.other_user_name?.split(' ').map(p => p[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: s.founder_member ? '#B45309' : 'var(--text-primary)' }}>{s.other_user_name}<AmbassadorMark show={s.ambassador_badge} /><FounderBadge show={s.founder_member} /></div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isCompleted && s.you_gave_count > 0 && ` · gave ${s.you_gave_count}, got ${s.you_got_count}`}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <ActivityIndicator lastLoginAt={s.last_login_at} />
                      </div>
                    </div>
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: isCompleted ? 'var(--success-light)' : 'var(--bg)', color: isCompleted ? '#065F46' : 'var(--text-muted)' }}>
                      {isCompleted ? '✓ Completed' : 'Declined'}
                    </span>
                    {s.your_rating && <StarRating value={s.your_rating} size={12} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =================================================================
// USER SEARCH SCREEN
// =================================================================
function UserSearchScreen() {
  const { token, openProfile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const h = setTimeout(() => {
      setLoading(true);
      api.searchUsers(token, query)
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(h);
  }, [query, token]);

  return (
    <div className="collector-search">
      <SectionHeader eyebrow="YOUR NEXT SWAP PARTNER" title="Find your people." /><p className="screen-intro">Look up a collector, see their swapping record and say hello.</p>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          autoFocus
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', padding: '11px 12px 11px 36px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, boxSizing: 'border-box' }}
        />
      </div>

      {loading && <Spinner />}
      {!loading && query.length >= 2 && results.length === 0 && (
        <EmptyState text={`No users found for "${query}"`} />
      )}
      {results.map(u => (
        <button
          className="collector-result" key={u.id}
          onClick={() => openProfile(u.id)}
          style={{ width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, overflow: 'hidden', flexShrink: 0 }}>
              {u.profile_photo ? <img src={u.profile_photo} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.name?.split(' ').map(p => p[0]).join('')}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: u.founder_member ? '#B45309' : 'var(--text-primary)' }}>{u.name}<AmbassadorMark show={u.ambassador_badge} /><FounderBadge show={u.founder_member} /></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {u.city && <span>{u.city}</span>}
                {u.completed_swaps > 0 && <span>· {u.completed_swaps} swaps</span>}
                {u.response_rate && <span>· {u.response_rate}% response rate</span>}
                {u.swap_streak >= 3 && <span>· {u.swap_streak} swap streak</span>}
              </div>
              <div style={{ marginTop: 2 }}>
                <ActivityIndicator lastLoginAt={u.last_login_at} />
              </div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, flexShrink: 0 }}>View →</span>
        </button>
      ))}
    </div>
  );
}

// =================================================================
// RESET PASSWORD SCREEN
// =================================================================
function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const token = new URLSearchParams(window.location.search).get('token');

  const submit = async () => {
    if (!password || !confirm) { setError('Please fill in both fields'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setStatus('loading');
    setError(null);
    try {
      await api.resetPassword(token, password);
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  if (!token) return (
    <>
      <style>{DESIGN_TOKENS}</style>
      <div className="account-status-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div className="account-status-card" style={{ textAlign: 'center' }}><Logo size={90} />
          <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Invalid reset link</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Please request a new password reset.</p>
          <a href="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>Go to Got One Spare?</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{DESIGN_TOKENS}</style>
      <div className="account-status-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
        <div className="account-status-card" style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}><Logo size={90} />
          {status === 'done' ? (
            <>
              <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>✅</div>
              <h2 style={{ fontWeight: 700, fontSize: 20, textAlign: 'center', marginBottom: 8 }}>Password updated!</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>You can now log in with your new password.</p>
              <a href="/" style={{ display: 'block', width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, textAlign: 'center', textDecoration: 'none' }}>
                Go to log in
              </a>
            </>
          ) : (
            <>
              <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Choose a new password</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Must be at least 8 characters.</p>
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box' }} />
                <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box' }} />
                <button onClick={submit} disabled={status === 'loading'}
                  style={{ width: '100%', padding: '13px 0', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                  {status === 'loading' && <Loader2 className="animate-spin" size={14} />}
                  Set new password
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function VerifyEmailScreen() {
  const [status, setStatus] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setErrorMsg('No verification token found in this link.');
      return;
    }

    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || 'Verification failed.');
      });
  }, []);

  return (
    <div className="account-status-screen min-h-screen w-full flex items-center justify-center px-5" style={{ background: 'var(--surface)', fontFamily: 'inherit' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <style>{DESIGN_TOKENS}</style>
      <div className="account-status-card w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center"><Logo size={90} /></div>

        {status === 'verifying' && (
          <>
            <Loader2 className="animate-spin mx-auto mb-4" size={28} color="var(--primary-dark)" />
            <p style={{ color: 'var(--text-secondary)' }}>Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-4" size={36} color="var(--primary-dark)" />
            <h2 className="font-black text-xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Email verified!</h2>
            <p className="mb-5" style={{ color: 'var(--text-secondary)' }}>Your account is fully active. You can head back to Got One Spare? and start swapping.</p>
            <a
              href="/"
              className="inline-block px-6 py-3 rounded font-semibold text-sm"
              style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}
            >
              Go to Got One Spare?
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <X className="mx-auto mb-4" size={36} color="var(--danger)" />
            <h2 className="font-black text-xl mb-2" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Verification failed</h2>
            <p className="mb-5" style={{ color: 'var(--text-secondary)' }}>{errorMsg}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Log in to Got One Spare? and use "Resend verification email" from there if your link expired.
            </p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-3 rounded font-semibold text-sm"
              style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}
            >
              Go to Got One Spare?
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// PROFILE SCREEN
// =================================================================
function resizeImageFile(file, maxDimension = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function ProfileScreen({ onClose, onSaved, onAccountDeleted }) {
  const { token, user } = useAuth();
  const { dark, toggle } = useTheme();
  const { albumId, albums } = useAlbum();
  const [badges, setBadges] = useState([]);
  const [stats, setStats] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [withdrawingReportId, setWithdrawingReportId] = useState(null);
  const [referralCode, setReferralCode] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [matchingPaused, setMatchingPaused] = useState(Boolean(user.matching_paused));
  const [pausingBusy, setPausingBusy] = useState(false);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [form, setForm] = useState({
    name: user.name || '',
    address_line1: user.address_line1 || '',
    address_line2: user.address_line2 || '',
    city: user.city || '',
    postcode: user.postcode || '',
    country: user.country || '',
    profile_photo: user.profile_photo || null,
  });

  useEffect(() => {
    if (user?.id) api.getBadges(token, user.id).then(setBadges).catch(() => {});
    if (user?.id) api.getUserStats(token, user.id).then(setStats).catch(() => {});
    api.getMyReports(token).then(setMyReports).catch(() => {});
    api.getReferral(token).then((d) => setReferralCode(d.code)).catch(() => {});
  }, [token, user?.id]);

  const withdrawReport = async (reportId) => {
    setWithdrawingReportId(reportId);
    try {
      await api.withdrawReport(token, reportId);
      setMyReports((r) => r.filter((x) => x.id !== reportId));
    } catch (err) {
      setError(err.message);
    } finally {
      setWithdrawingReportId(null);
    }
  };

  const toggleMatchingPaused = async () => {
    const next = !matchingPaused;
    setPausingBusy(true);
    try {
      const updated = await api.updateMe(token, { matching_paused: next });
      setMatchingPaused(next);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setPausingBusy(false);
    }
  };

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [clearingBusy, setClearingBusy] = useState(false);
  const [clearResult, setClearResult] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setPhotoProcessing(true);
    setError(null);
    try {
      const resized = await resizeImageFile(file);
      setForm((f) => ({ ...f, profile_photo: resized }));
    } catch {
      setError('Could not process that image — try a different file.');
    } finally {
      setPhotoProcessing(false);
    }
  };

  const hasAddress = Boolean(user.address_line1 && user.city && user.postcode);

  const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][ABD-HJLNP-UW-Z]{2}$/i;

  const submit = async () => {
    if (!form.address_line1 || !form.city || !form.postcode) {
      setError('Address line 1, city, and postcode are required so swap partners can post to you.');
      return;
    }
    if (!UK_POSTCODE_REGEX.test(form.postcode.trim())) {
      setError('Please enter a valid UK postcode (e.g. SW1A 2AA). This platform is for UK-based swaps only.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateMe(token, { ...form, country: 'United Kingdom', postcode: form.postcode.toUpperCase().trim() });
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearEverything = async () => {
    const albumName = albums.find(a => a.id === albumId)?.name || 'this album';
    if (!await confirmAction(`This will remove ALL your spares and needs for ${albumName} — useful if your list hasn't kept up with your actual collection and you'd rather start fresh. It won't affect any swap already in progress, or your lists for any other album. This can't be undone. Continue?`)) {
      return;
    }
    setClearingBusy(true);
    setClearResult(null);
    try {
      const result = await api.clearAllStickers(token, albumId);
      setClearResult(`✓ Cleared ${result.duplicatesCleared} spare${result.duplicatesCleared !== 1 ? 's' : ''} and ${result.needsCleared} need${result.needsCleared !== 1 ? 's' : ''}. Add your list back whenever you're ready.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearingBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!await confirmAction("Delete your account? Your name, email, address, and photo will be permanently removed and you'll be logged out immediately — this can't be undone. Any swaps you've already accepted or posted will be left as-is for your swap partner's records, but proposed swaps will be declined.")) {
      return;
    }
    if (!await confirmAction('Are you absolutely sure? This is your last chance to back out.')) {
      return;
    }
    setDeletingAccount(true);
    try {
      await api.deleteAccount(token);
      onAccountDeleted();
    } catch (err) {
      setError(err.message);
      setDeletingAccount(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Profile and settings" className="settings-overlay modern-dialog fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="settings-panel modern-dialog-panel" style={{ background: 'var(--surface)' }}>
        <header className="settings-header"><div><span className="eyebrow">YOUR COLLECTING CORNER</span><h2>Make yourself at home.</h2><p>Your profile, your preferences, your next swap.</p></div><button className="dialog-close" aria-label="Close settings" onClick={onClose}><X size={20}/></button></header>
        <div className="settings-content">
        {!hasAddress && (
          <div className="rounded p-3 mb-4 text-sm" style={{ background: '#FBF1D9', color: '#5C4711', border: '1px solid #E8D9A8' }}>
            Add your address now so you're ready to accept swaps — without it, swap partners won't know where to post stickers.
          </div>
        )}

        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        {saved && <div className="rounded p-3 mb-4 text-sm" style={{ background: '#E5F1EC', color: 'var(--primary-dark)' }}>Saved!</div>}

        <section className="settings-card identity-card"><div className="settings-section-title"><span><UserRound size={20}/></span><div><h3>Your collector profile</h3><p>A familiar face for your swap partners.</p></div></div><div className="profile-photo-row">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ background: 'var(--primary-dark)' }}
          >
            {form.profile_photo ? (
              <img src={form.profile_photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="font-black text-lg" style={{ color: 'var(--warning)' }}>
                {(form.name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <label
            className="text-sm font-semibold cursor-pointer flex items-center gap-2"
            style={{ color: 'var(--primary-dark)' }}
          >
            {photoProcessing && <Loader2 className="animate-spin" size={14} />}
            {form.profile_photo ? 'Change photo' : 'Add a photo'}
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={photoProcessing} />
          </label>
        </div>

        <div className="profile-fields">
          <label className="profile-field"><span>Display name</span><input
            aria-label="Display name" autoComplete="name"
            placeholder="Name"
            value={form.name}
            onChange={set('name')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          /></label><div className="address-heading"><MapPin size={18}/><div><h4>Where your swaps arrive</h4><p>Your address is shared only after you both accept a swap.</p></div></div>
          <label className="profile-field"><span>Address line 1</span><input
            aria-label="Address line 1" autoComplete="address-line1"
            placeholder="Address line 1"
            value={form.address_line1}
            onChange={set('address_line1')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          /></label>
          <label className="profile-field"><span>Address line 2 (optional)</span><input
            aria-label="Address line 2 (optional)" autoComplete="address-line2"
            placeholder="Address line 2 (optional)"
            value={form.address_line2}
            onChange={set('address_line2')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          /></label>
          <label className="profile-field"><span>Town or city</span><input
            aria-label="Town or city" autoComplete="address-level2"
            placeholder="City"
            value={form.city}
            onChange={set('city')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          /></label>
          <label className="profile-field"><span>Postcode</span><input
            aria-label="Postcode" autoComplete="postal-code"
            placeholder="Postcode (e.g. SW1A 2AA)"
            value={form.postcode}
            onChange={(e) => set('postcode')({ target: { value: e.target.value.toUpperCase() } })}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'monospace', letterSpacing: '0.05em' }}
          /></label>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 0' }}>
            UK postcodes only — this platform is for UK-based collectors.
          </p>
        </div>

        </section>
        <section className="settings-card"><div className="settings-section-title"><span><Settings size={20}/></span><div><h3>Your preferences</h3><p>Collect at your own pace.</p></div></div>
        {/* Founder membership */}
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          {user.founder_member ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#92400E' }}>
              🏆 Founder Member — thank you for supporting Got One Spare
            </div>
          ) : FOUNDER_ENABLED ? (
            <button
              onClick={() => setShowFounderModal(true)}
              style={{ width: '100%', padding: '11px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #D97706, #92400E)', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              🏆 Become a Founder — support Got One Spare
            </button>
          ) : null}
        </div>

        {/* Availability — pause matching */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {matchingPaused ? 'Matching paused' : 'Available for swaps'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {matchingPaused
                ? "You won't receive new matches until you turn this back on."
                : 'Your spares/needs lists stay saved either way — this just pauses new matches.'}
            </div>
          </div>
          <button
            aria-label="Available for swaps" role="switch" aria-checked={!matchingPaused} onClick={toggleMatchingPaused}
            disabled={pausingBusy}
            style={{ width: 48, height: 28, borderRadius: 14, background: matchingPaused ? 'var(--danger)' : 'var(--primary)', border: 'none', cursor: pausingBusy ? 'default' : 'pointer', position: 'relative', transition: 'background 0.2s', opacity: pausingBusy ? 0.6 : 1, flexShrink: 0 }}
          >
            <span style={{ position: 'absolute', top: 3, left: matchingPaused ? 3 : 22, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Dark mode</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Switch to a darker colour scheme</div>
          </div>
          <button
            aria-label="Dark mode" role="switch" aria-checked={dark} onClick={toggle}
            style={{ width: 48, height: 28, borderRadius: 14, background: dark ? 'var(--primary)' : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
          >
            <span style={{ position: 'absolute', top: 3, left: dark ? 22 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        </section><section className="settings-card"><div className="settings-section-title"><span><Trophy size={20}/></span><div><h3>Your collecting journey</h3><p>Every swap brings you closer.</p></div></div>
        {/* Level & XP */}
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}><ShieldCheck size={17} className="inline-symbol" /> Level {user.level || 1}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {user.xp || 0} XP{user.nextLevelXp != null ? ` · ${user.nextLevelXp - (user.xp || 0)} to next level` : ' · max level reached'}
            </div>
          </div>
          {user.nextLevelXp != null && (
            <div style={{ height: 8, background: 'var(--bg)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.round((((user.xp || 0) - (user.currentLevelXp || 0)) / (user.nextLevelXp - (user.currentLevelXp || 0))) * 100))}%`,
                background: 'var(--primary)',
                transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>

        {/* Refer a friend */}
        {referralCode && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}><Users size={17} className="inline-symbol" /> Refer a friend</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Share your link — once they sign up and complete their first swap, you'll earn 30 XP.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {window.location.origin}/?ref={referralCode}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralCode}`).catch(() => {});
                  setReferralCopied(true);
                  setTimeout(() => setReferralCopied(false), 2000);
                }}
                style={{ flexShrink: 0, padding: '8px 12px', borderRadius: 6, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                {referralCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Your swapping stats */}
        {stats && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Your swapping stats</div>
            <StatsGrid stats={stats} />
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Your badges</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {badges.map(b => (
                <span key={b.badge_type} title={b.description} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'var(--primary-light)', color: 'var(--primary-dark)', fontWeight: 600 }}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        )}

        </section><section className="settings-card account-controls"><div className="settings-section-title"><span><ShieldCheck size={20}/></span><div><h3>Account & collection controls</h3><p>Manage reports and reset your lists.</p></div></div>
        {/* Reports you've filed */}
        {myReports.length > 0 && (
          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Reports you've filed</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              If a problem's been sorted out, you can withdraw a report yourself — no need to contact an admin.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {myReports.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-primary)' }}>You reported <strong>{r.reported_name}</strong> on swap #{r.swap_id}</span>
                  <button
                    onClick={() => withdrawReport(r.id)}
                    disabled={withdrawingReportId === r.id}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 12, padding: '4px 8px', cursor: withdrawingReportId === r.id ? 'default' : 'pointer' }}
                  >
                    {withdrawingReportId === r.id ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 4 }}>Danger zone</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            If your list hasn't kept up with your actual collection, you can clear everything and start again rather than deleting items one by one. Won't affect any swap already in progress.
          </div>
          {clearResult && (
            <div style={{ fontSize: 12, color: '#065F46', background: 'var(--success-light)', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>{clearResult}</div>
          )}
          <button
            onClick={clearEverything}
            disabled={clearingBusy}
            style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-light)', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: 13, fontWeight: 600, cursor: clearingBusy ? 'default' : 'pointer', opacity: clearingBusy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {clearingBusy && <Loader2 size={14} className="animate-spin" />} Clear all spares & needs
          </button>

          <button
            onClick={deleteAccount}
            disabled={deletingAccount}
            style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--danger)', border: '1px solid var(--danger)', color: 'white', fontSize: 13, fontWeight: 600, cursor: deletingAccount ? 'default' : 'pointer', opacity: deletingAccount ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {deletingAccount && <Loader2 size={14} className="animate-spin" />} Delete my account
          </button>
        </div>

        </section></div>
        {FOUNDER_ENABLED && showFounderModal && <FounderModal onClose={() => setShowFounderModal(false)} />}

        <div className="settings-footer">
          <button onClick={onClose} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
            Close
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
            {loading && <Loader2 className="animate-spin" size={14} />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

const IOS_APP_URL = 'https://apps.apple.com/app/got-one-spare/id6794436890';

// Simple Apple logo mark, since lucide-react dropped brand icons.
function AppleLogo({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

// =================================================================
// iOS APP LIVE WIDGET
// Web-only floating button (hidden in the native apps). Announces
// that the iOS app is now on the App Store, with a download link.
// Replaced the old Android tester recruitment widget.
// =================================================================
function IOSLiveWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);

  if (Capacitor.isNativePlatform()) return null;

  return (
    <div style={{ position: 'fixed', bottom: 132, right: 16, zIndex: 200 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: 0,
          width: 290, background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>The iOS app is now live!</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Got One Spare is now on the App Store. Download it on your iPhone or iPad for a faster, app-like experience.
          </p>

          <a href={IOS_APP_URL} target="_blank" rel="noopener noreferrer"
            onClick={() => { api.trackAppStoreClick(token, 'widget').catch(() => {}); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 'var(--radius-sm)', background: 'var(--navy)', color: 'white', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <AppleLogo size={15} /> Download on the App Store
          </a>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: '50%',
          background: open ? 'var(--navy)' : 'var(--primary)',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        title="The iOS app is now live"
      >
        <AppleLogo size={18} />
        <span style={{ position: 'absolute', top: -6, right: -8, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid white', lineHeight: 1 }}>
          1
        </span>
      </button>
    </div>
  );
}

// =================================================================
// FEEDBACK WIDGET
// =================================================================
function FeedbackWidget({ inline = false }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle');

  const submit = async () => {
    if (!message.trim()) return;
    setState('sending');
    try {
      await api.submitFeedback(token, message, window.location.pathname);
      setState('sent');
      setMessage('');
      setTimeout(() => { setState('idle'); setOpen(false); }, 2000);
    } catch {
      setState('error');
    }
  };

  if (inline) return <div className="feedback-form"><div className="feedback-intro"><MessageCircle size={25}/><p>Have an idea or need a hand?<br/>We’d love to hear from you.</p></div>{state === 'sent' ? <div className="feedback-success"><CheckCircle2 size={30}/><h3>Thanks for helping us improve.</h3><p>Your feedback has been sent.</p></div> : <><label className="profile-field"><span>Your message</span><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us what’s on your mind…" rows={5}/></label>{state === 'error' && <ErrorBanner message="Could not send your feedback. Please try again." />}<Btn onClick={submit} disabled={!message.trim() || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send feedback'}<ArrowRight size={17}/></Btn></>}</div>;

  return (
    <div style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 200 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: 0,
          width: 280, background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Send feedback</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
          </div>

          {state === 'sent' ? (
            <p style={{ fontSize: 13, color: 'var(--success)', textAlign: 'center', margin: '8px 0' }}>Thanks for your feedback! ✓</p>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What's on your mind? Bug, idea, question — anything goes."
                rows={4}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, resize: 'none', fontFamily: 'inherit', marginBottom: 10, boxSizing: 'border-box' }}
              />
              {state === 'error' && <p style={{ fontSize: 12, color: 'var(--danger)', margin: '0 0 8px' }}>Failed to send — try again</p>}
              <Btn variant="primary" onClick={submit} disabled={!message.trim() || state === 'sending'} style={{ width: '100%', justifyContent: 'center' }}>
                {state === 'sending' ? <><Loader2 size={13} className="animate-spin" /> Sending…</> : 'Send feedback'}
              </Btn>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: open ? 'var(--navy)' : 'var(--primary)',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        title="Send feedback"
      >
        <MessageCircle size={18} />
      </button>
    </div>
  );
}

// =================================================================
// WHAT'S NEW PANEL
// =================================================================
function HamburgerMenu({ user, onProfile, onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Menu"
        style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        <Menu size={18} color="white" />
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 60, left: 12, width: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <button
              onClick={() => { setOpen(false); onProfile(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border)', fontFamily: 'inherit' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', background: user.founder_member ? 'linear-gradient(135deg, #D97706, #92400E)' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: user.founder_member ? '2px solid #FDE68A' : 'none' }}>
                {user.profile_photo ? (
                  <img src={user.profile_photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>{(user.name || '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{user.name || 'Your profile'}</span>
            </button>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#DC2626', fontFamily: 'inherit' }}
            >
              <LogOut size={16} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationPanel() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications(token);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = async () => {
    setOpen((o) => !o);
    if (!open && unreadCount > 0) {
      await api.markAllRead(token).catch(() => {});
      setUnreadCount(0);
      setNotifications((n) => n.map((x) => ({ ...x, is_read: true })));
    }
  };

  const TYPE_ICONS = {
    new_message: MessageCircle,
    swap_proposed: ArrowRightLeft,
    swap_accepted: CheckCircle2,
    swap_posted: Package,
    new_match: Layers,
    new_rating: Star,
    dispute_filed: ShieldCheck,
    announcement: Bell,
    founder_welcome: Trophy,
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
        aria-label="Notifications" aria-expanded={open}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={20} color={open ? 'var(--primary)' : 'var(--text-secondary)'} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: 'var(--danger)', color: 'white',
            fontSize: 10, fontWeight: 700,
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="region" aria-label="Notifications" className="notification-tray" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
          maxHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div className="notification-heading" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Notifications</span>
            {notifications.length > 0 && (
              <button onClick={() => api.markAllRead(token).then(() => { setUnreadCount(0); setNotifications((n) => n.map((x) => ({ ...x, is_read: true }))); })} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Bell size={30} style={{ margin: '0 auto 12px' }} /><strong>You’re all caught up</strong><p>Your swap updates will appear here.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isExpanded = expanded === n.id;
                const NotificationIcon = TYPE_ICONS[n.type] || Bell;
                return (
                  <button className="notification-item" aria-expanded={n.body ? isExpanded : undefined}
                    key={n.id}
                    onClick={() => setExpanded(isExpanded ? null : n.id)}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      background: n.is_read ? 'transparent' : 'var(--primary-light)',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      cursor: n.body ? 'pointer' : 'default',
                    }}
                  >
                    <span className={`notification-symbol ${n.type}`}><NotificationIcon size={20} strokeWidth={1.8} /></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
                      {n.body && (
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          overflow: isExpanded ? 'visible' : 'hidden',
                          textOverflow: isExpanded ? 'unset' : 'ellipsis',
                          lineHeight: 1.5,
                        }}>
                          {n.body}
                        </div>
                      )}
                      {n.body && !isExpanded && n.body.length > 50 && (
                        <div style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2 }}>Tap to read more</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationBanner() {
  const { token } = useAuth();
  const [state, setState] = useState('idle');

  const resend = async () => {
    setState('sending');
    try {
      await api.resendVerification(token);
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--warning-light)', borderBottom: '1px solid #FDE68A', fontSize: 13, color: '#92400E' }}>
      <span>
        {state === 'sent' ? 'Verification email sent — check your inbox (and spam folder).' : 'Please verify your email to start swaps.'}
      </span>
      {state !== 'sent' && (
        <button onClick={resend} disabled={state === 'sending'} style={{ fontWeight: 600, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          {state === 'sending' && <Loader2 className="animate-spin" size={12} />}
          {state === 'error' ? 'Failed — try again' : 'Resend email'}
        </button>
      )}
    </div>
  );
}

// =================================================================
// APP SHELL
// =================================================================
function MoreScreen({ user, onNavigate, onProfile, onLogout, onFeedback }) {
 const { dark, toggle } = useTheme();
 return <section className="more-screen"><SectionHeader eyebrow="YOUR COLLECTING CORNER" title="A little more you." /><button className="profile-feature" onClick={onProfile}><CollectorAvatar person={user} size={60} /><span><strong>{user.name}</strong><small>Profile, address & settings</small></span><ChevronRight /></button><div className="more-list">{[[MessageCircle,'Messages','messages'],[History,'Swap history','history'],[Search,'Find collectors','search'],[Layers,'My albums','dashboard']].map(([Icon,label,id]) => <button key={id} onClick={() => onNavigate(id)}><Icon /><span>{label}</span><ChevronRight size={17} /></button>)}<button onClick={toggle}>{dark ? <Sun /> : <Moon />}<span>{dark ? 'Switch to light mode' : 'Switch to dark mode'}</span><ChevronRight size={17} /></button><button onClick={onFeedback}><HelpCircle /><span>Feedback & support</span><ChevronRight size={17} /></button><button onClick={onLogout}><LogOut /><span>Sign out</span></button></div><div className="more-brand"><Logo size={85} /><p>Same stickers. Bigger connections.</p></div></section>;
}

export default function PaniniSwapApp() {
  const [token, setToken] = useState(() => storage.getItem('authToken') || null);
  const [user, setUser] = useState(null);
  const [tab, setTabState] = useState('home');
  const setTab = next => { setTabState(next); window.scrollTo({ top:0, behavior:'instant' }); };
  const [supportOpen, setSupportOpen] = useState(false);
  const [activeSwapId, setActiveSwapId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);
  const [pendingConversationUserId, setPendingConversationUserId] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [checkingSession, setCheckingSession] = useState(Boolean(storage.getItem('authToken')));
  const [dark, setDark] = useState(() => storage.getItem('theme') === 'dark');
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [founderRedirectMsg, setFounderRedirectMsg] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [albumId, setAlbumIdState] = useState(() => parseInt(storage.getItem('selectedAlbumId') || '1', 10));
  const setAlbumId = (id) => {
    storage.setItem('selectedAlbumId', String(id));
    setAlbumIdState(id);
  };

  useEffect(() => {
    api.getAlbums().then(items => setAlbums(items.map(album => ({
      ...album,
      name: ({ 1: "World Cup Stickers 2026", 2: "Men's Premier League Trading Cards 2026/27" })[album.id] || album.name,
    })))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    const load = () => api.getUnreadMessageCount(token).then(setUnreadMessages).catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Handle the ?founder=success / ?founder=cancelled redirect coming
  // back from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const founderResult = params.get('founder');
    if (founderResult === 'success') {
      setFounderRedirectMsg('🏆 Thank you for becoming a Founder! Your badge may take a few seconds to appear.');
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setFounderRedirectMsg(null), 8000);
    } else if (founderResult === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    if (IS_PREVIEW) return;
    const isStandalone = window.navigator.standalone === true;
    if (isStandalone) api.trackInstall(token).catch(() => {});

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const tryPush = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        let permission = Notification.permission;
        if (permission === 'denied') return;
        if (permission !== 'granted') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') return;

        const res = await fetch(`${API_BASE}/push/vapid-public-key`);
        const { key } = await res.json();
        if (!key) return;

        const urlB64ToUint8Array = (b) => {
          const padding = '='.repeat((4 - b.length % 4) % 4);
          const base64 = (b + padding).replace(/-/g, '+').replace(/_/g, '/');
          return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
        };

        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(key),
        });
        if (!sub) return;

        await fetch(`${API_BASE}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ subscription: sub.toJSON(), isStandalone }),
        });
      } catch (err) {
        console.log('[PWA] Push error:', err.message);
      }
    };

    tryPush();
  }, [token]);

  // Records that this user has actually opened the native app at
  // least once — independent of the push permission flow below, so
  // it still counts someone who declines notifications. The one
  // reliable "installed and opened the native app" signal.
  useEffect(() => {
    if (IS_PREVIEW || !token || !Capacitor.isNativePlatform()) return;
    api.trackNativeAppOpen(token).catch(() => {});
  }, [token]);

  // Native push (APNs via Capacitor) — separate from the web-push
  // effect above, which never actually works inside the native app's
  // WKWebView (it silently no-ops on its own serviceWorker/PushManager
  // checks). This is the real notification path for the iOS app.
  useEffect(() => {
    if (IS_PREVIEW || !token || !Capacitor.isNativePlatform()) return;

    let permGranted = false;
    PushNotifications.checkPermissions()
      .then((res) => {
        if (res.receive === 'granted') return { receive: 'granted' };
        return PushNotifications.requestPermissions();
      })
      .then((res) => {
        permGranted = res.receive === 'granted';
        if (permGranted) return PushNotifications.register();
      })
      .catch((err) => console.log('[Push] permission/register error:', err.message));

    const regListener = PushNotifications.addListener('registration', (tokenResult) => {
      api.registerDeviceToken(token, tokenResult.value).catch((err) => {
        console.log('[Push] failed to save device token:', err.message);
      });
    });
    const regErrListener = PushNotifications.addListener('registrationError', (err) => {
      console.log('[Push] registration error:', JSON.stringify(err));
    });
    // Notification arrived while the app was open — nothing extra to
    // do, iOS already shows the banner; a tap is handled below.
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', () => {});
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', () => {});

    return () => {
      regListener.remove();
      regErrListener.remove();
      receivedListener.remove();
      actionListener.remove();
    };
  }, [token]);

  useEffect(() => {
    if (tab === 'messages') setUnreadMessages(0);
  }, [tab]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    storage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const themeCtx = { dark, toggle: () => setDark(d => !d) };

  if (window.location.pathname === '/verify-email') {
    return <VerifyEmailScreen />;
  }
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordScreen />;
  }

  const handleAuthed = (newToken, newUser) => {
    storage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(newUser);
    if (FOUNDER_ENABLED) configureRevenueCat(newUser.id);
  };

  const logout = () => {
    storage.removeItem('authToken');
    setToken(null);
    setUser(null);
    setTab('home');
  };

  useEffect(() => {
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api.me(token)
      .then((freshUser) => {
        setUser(freshUser);
        if (FOUNDER_ENABLED) configureRevenueCat(freshUser.id);
      })
      .catch(() => {
        storage.removeItem('authToken');
        setToken(null);
        setUser(null);
      })
      .finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <style>{DESIGN_TOKENS}</style>
        <Spinner />
      </div>
    );
  }

  if (!token || !user) {
    return <AuthScreen onAuthed={handleAuthed} />;
  }

  const NAV_ITEMS = [
    { id:'home', label:'Home', Icon:Home }, { id:'dashboard', label:'My Stickers', Icon:Layers }, { id:'matches', label:'Matches', Icon:Users }, { id:'mySwaps', label:'Swaps', Icon:ArrowRightLeft }, { id:'more', label:'More', Icon:MoreHorizontal },
  ];
  return (
    <ThemeContext.Provider value={themeCtx}>
    <AlbumContext.Provider value={{ albumId, albums, setAlbumId }}>
    <AuthContext.Provider value={{
      token,
      user,
      openProfile: (userId) => setViewingProfileUserId(userId),
      openConversationWith: (userId) => {
        setViewingProfileUserId(null);
        setPendingConversationUserId(userId);
        setTab('messages');
      },
    }}>
      <style>{DESIGN_TOKENS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.34.0/dist/tabler-icons.min.css" />

      <div className={`gos-app ${tab === 'dashboard' ? 'album-active' : ''}`}>
        {IS_PREVIEW && <div className="preview-ribbon">{IS_INTEGRATION ? "Integration test · real catalogue, test accounts" : "Isolated preview · fictional data"} <button onClick={() => { storage.removeItem('initialized'); window.location.reload(); }}>Reset</button></div>}
        <header className="app-header"><div className="header-inner"><button className="brand-home" onClick={() => setTab('home')} aria-label="Got One Spare home"><Logo size={53} /></button><div className="desktop-tagline">Same stickers. Bigger connections.</div><div className="header-actions"><NotificationPanel /><button className="profile-button" aria-label="Your profile" onClick={() => setViewingProfileUserId(user.id)}><CollectorAvatar person={user} size={39} /></button></div></div></header>
        {founderRedirectMsg && (
          <div style={{ background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', borderBottom: '1px solid #FDE68A', padding: '10px 16px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#92400E' }}>
            {founderRedirectMsg}
          </div>
        )}

        {!user.email_verified && <VerificationBanner />}
        {user.email_verified && !(user.address_line1 && user.city && user.postcode) && (
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#FEF3C7', borderBottom: '1px solid #FDE68A', fontSize: 13, color: '#92400E', fontWeight: 600 }}>
            <span>Add your address so you're ready to swap.</span>
            <button onClick={() => setShowProfile(true)} style={{ fontWeight: 700, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'underline', fontFamily: 'inherit' }}>
              Add now
            </button>
          </div>
        )}

        {showProfile && (
          <ProfileScreen
            onClose={() => setShowProfile(false)}
            onSaved={(updatedUser) => setUser(updatedUser)}
            onAccountDeleted={logout}
          />
        )}

        {viewingProfileUserId && (
          <UserProfileModal
            userId={viewingProfileUserId}
            onClose={() => setViewingProfileUserId(null)}
            onEditOwnProfile={() => { setViewingProfileUserId(null); setShowProfile(true); }}
          />
        )}

        {FOUNDER_ENABLED && showFounderModal && <FounderModal onClose={() => setShowFounderModal(false)} />}

        <main className={`app-main screen-${tab}`} id="main-content">
          {tab === 'home' && (
            <HomeHubScreen
              onNavigate={setTab}
              onOpenProfile={() => setShowProfile(true)}
              unreadMessages={unreadMessages}
            />
          )}
          {tab === 'dashboard' && (
            <DashboardScreen
              onOpenSwap={(swapId) => {
                setActiveSwapId(swapId);
                setTab('swap');
              }}
            />
          )}
          {tab === 'matches' && (
            <MatchesScreen
              onOpenSwap={(swapId) => {
                setActiveSwapId(swapId);
                setTab('swap');
              }}
            />
          )}
          {tab === 'mySwaps' && (
            <MySwapsScreen
              onOpenSwap={(swapId) => {
                setActiveSwapId(swapId);
                setTab('swap');
              }}
            />
          )}
          {tab === 'history' && <SwapHistoryScreen />}
          {tab === 'more' && <MoreScreen user={user} onNavigate={setTab} onProfile={() => setShowProfile(true)} onLogout={logout} onFeedback={() => setSupportOpen(true)} />}
          {tab === 'messages' && (
            <MessagesScreen
              pendingOpenUserId={pendingConversationUserId}
              onPendingOpened={() => setPendingConversationUserId(null)}
            />
          )}
          {tab === 'search' && <UserSearchScreen />}
          {tab === 'swap' && activeSwapId && (
            <SwapDetailScreen
              swapId={activeSwapId}
              onRated={() => setTab('dashboard')}
              onBack={() => setTab('mySwaps')}
              onOpenSwap={(newSwapId) => setActiveSwapId(newSwapId)}
            />
          )}
          {tab === 'swap' && !activeSwapId && (
            <EmptyState text="No active swap selected. Pick one from your matches." />
          )}
        </main>

        <nav className="app-nav" aria-label="Main navigation"><div className="nav-inner">{NAV_ITEMS.map(({ id, label, Icon }) => { const active = tab === id || (tab === 'swap' && id === 'mySwaps') || (['messages','search','history'].includes(tab) && id === 'more'); return <button key={id} onClick={() => setTab(id)} aria-current={active ? 'page' : undefined}><span className="nav-icon"><Icon size={22} />{id === 'more' && unreadMessages > 0 && <span className="nav-badge">{unreadMessages}</span>}</span><span>{label}</span></button>; })}</div></nav>
        {supportOpen && <div className="gos-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="Feedback and support" className="gos-modal"><SectionHeader title="Here to help" action={<button className="icon-button" aria-label="Close support" onClick={() => setSupportOpen(false)}><X /></button>} /><p>Send feedback using the button below, or read our support guide.</p><a href="/support.html" target="_blank" rel="noreferrer">Support guide</a><div className="support-feedback"><FeedbackWidget inline /></div></section></div>}
        {!IS_PREVIEW && <><IOSLiveWidget /><InstallAndNotifyBanner /></>}
      </div>
    </AuthContext.Provider>
    </AlbumContext.Provider>
    </ThemeContext.Provider>
  );
}
