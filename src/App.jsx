import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Search, Plus, X, Star, ArrowRightLeft, Package, CheckCircle2, Clock, MapPin, LogOut, Loader2, Bell, MessageCircle, Send } from 'lucide-react';

// =================================================================
// API CLIENT
// Point API_BASE at your deployed backend. Every call goes through
// `request()`, which attaches the auth token and normalizes errors.
// =================================================================
const API_BASE = 'https://panini-swap-production-69ef.up.railway.app/api';

const AuthContext = createContext(null);
const ThemeContext = createContext({ dark: false, toggle: () => {} });

function useAuth() {
  return useContext(AuthContext);
}

function useTheme() {
  return useContext(ThemeContext);
}

async function request(path, { method = 'GET', body, token } = {}) {
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
  signup: (name, email, password, inviteCode) => request('/auth/signup', { method: 'POST', body: { name, email, password, inviteCode } }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/auth/me', { token }),
  updateMe: (token, fields) => request('/auth/me', { method: 'PUT', body: fields, token }),
  verifyEmail: (verificationToken) => request('/auth/verify-email', { method: 'POST', body: { token: verificationToken } }),
  resendVerification: (token) => request('/auth/resend-verification', { method: 'POST', token }),
  getStats: () => request('/stats'),
  getActivity: () => request('/activity'),
  getUnreadMessageCount: (token) => request('/messages', { token }).then(convos => convos.reduce((sum, c) => sum + (parseInt(c.unread_count) || 0), 0)).catch(() => 0),
  getAppSurvey: (token) => request('/app-survey/me', { token }),
  submitAppSurvey: (token, wantsApp, phoneOs) => request('/app-survey/submit', { method: 'POST', body: { wantsApp, phoneOs }, token }),
  getVapidKey: () => request('/push/vapid-public-key'),
  subscribePush: (token, subscription, isStandalone) => request('/push/subscribe', { method: 'POST', body: { subscription, isStandalone }, token }),
  trackInstall: (token) => request('/push/track-install', { method: 'POST', token }),

  searchStickers: (token, { search, team } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (team) params.set('team', team);
    return request(`/stickers?${params.toString()}`, { token });
  },
  getTeams: (token) => request('/stickers/teams', { token }),
  getMyDuplicates: (token) => request('/stickers/me/duplicates', { token }),
  addDuplicate: (token, stickerId, quantity) =>
    request('/stickers/me/duplicates', { method: 'POST', body: { stickerId, quantity }, token }),
  updateDuplicateQty: (token, stickerId, quantity) =>
    request('/stickers/me/duplicates', { method: 'POST', body: { stickerId, quantity }, token }),
  addDuplicatesBulk: (token, stickerIds) =>
    request('/stickers/me/duplicates/bulk', { method: 'POST', body: { stickerIds }, token }),
  removeDuplicate: (token, stickerId) =>
    request(`/stickers/me/duplicates/${stickerId}`, { method: 'DELETE', token }),
  getMyNeeds: (token) => request('/stickers/me/needs', { token }),
  addNeed: (token, stickerId) => request('/stickers/me/needs', { method: 'POST', body: { stickerId }, token }),
  addNeedsBulk: (token, stickerIds) =>
    request('/stickers/me/needs/bulk', { method: 'POST', body: { stickerIds }, token }),
  removeNeed: (token, stickerId) => request(`/stickers/me/needs/${stickerId}`, { method: 'DELETE', token }),
  clearAllStickers: (token) => request('/stickers/me/all', { method: 'DELETE', token }),

  getMatches: (token) => request('/swaps/matches', { token }),
  getMySwaps: (token) => request('/swaps/mine', { token }),
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
  getPL2026Status: (token) => request('/pl2026/status', { token }),
  notifyPL2026: (token) => request('/pl2026/notify', { method: 'POST', token }),

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
  getAnnouncements: (token) => request('/announcements', { token }),
  markAnnouncementsRead: (token) => request('/announcements/read', { method: 'POST', token }),
  getConversations: (token) => request('/messages', { token }),
  startConversation: (token, recipientId, body) => request('/messages', { method: 'POST', body: { recipientId, body }, token }),
  getConversationMessages: (token, conversationId) => request(`/messages/${conversationId}`, { token }),
  sendDirectMessage: (token, conversationId, body) => request(`/messages/${conversationId}/send`, { method: 'POST', body: { body }, token }),
  reportMessage: (token, messageId, reason) => request(`/messages/${messageId}/report`, { method: 'POST', body: { reason }, token }),
  getSwapHistory: (token) => request('/swaps/history', { token }),
  getBadges: (token, userId) => request(`/badges/${userId}`, { token }),
  searchUsers: (token, q) => request(`/auth/search?q=${encodeURIComponent(q)}`, { token }),
  reportNoShow: (token, swapId, notes) =>
    request('/reports', { method: 'POST', body: { swapId, notes }, token }),
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
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
  :root {
    --primary: #1AAB8A;
    --primary-light: #C8F0E5;
    --primary-dark: #0E7A63;
    --blue: #5B9BD5;
    --blue-light: #D6E8F7;
    --navy: #0B1120;
    --bg: #f4f4f2;
    --surface: #FFFFFF;
    --border: #e8e8e4;
    --text-primary: #0B1120;
    --text-secondary: #555550;
    --text-muted: #9CA3AF;
    --danger: #EF4444;
    --danger-light: #FEE2E2;
    --warning: #F59E0B;
    --warning-light: #FEF3C7;
    --success: #10B981;
    --success-light: #D1FAE5;
    --gold: #B8860B;
    --gold-light: #FFF8E1;
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 10px;
    --radius-full: 9999px;
  }
  [data-theme="dark"] {
    --bg: #0F1117;
    --surface: #1A1F2E;
    --border: rgba(255,255,255,0.08);
    --text-primary: #F3F4F6;
    --text-secondary: #9CA3AF;
    --text-muted: #6B7280;
    --navy: #1A1F36;
    --blue-light: #1E3A5F;
    --primary-light: #0A3D2E;
    --danger-light: #3B1010;
    --warning-light: #3B2A00;
    --success-light: #0A2E1E;
    --gold-light: #2B2408;
  }
  body { background: var(--bg); color: var(--text-primary); font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
  * { box-sizing: border-box; }
  button { cursor: pointer; border: none; background: none; padding: 0; font: inherit; }
  input, textarea, select { font: inherit; }
  input:focus, textarea:focus, select:focus { outline: 2px solid #1AAB8A; outline-offset: 1px; }
`;

// =================================================================
// LOGO — square rounded mark with two overlapping stickers
// =================================================================
function Logo({ size = 32 }) {
  return (
    <img
      src="data:image/png;base64,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"
      alt="Got One Spare? logo"
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, marginRight: 2 }}
    />
  );
}

// =================================================================
// Shared UI pieces
// =================================================================
function StickerCard({ sticker, onAdd, onRemove, onUpdateQty, qtyOverride, mode = 'duplicate' }) {
  const qty = qtyOverride ?? sticker.quantity;
  const isDuplicate = mode === 'duplicate' || sticker.quantity !== undefined;
  const accentColor = isDuplicate ? '#1AAB8A' : '#0B1120';
  const isNeed = mode === 'need';

  return (
    <div
      className="relative group"
      style={{
        background: isNeed ? '#fafaf8' : 'white',
        border: '1px solid #e8e8e4',
        borderLeft: '3px solid ' + accentColor,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: onAdd ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Sticker number — monospaced, top left */}
      <div style={{ padding: '8px 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'monospace', fontSize: 10, fontWeight: 800,
          color: accentColor, letterSpacing: '0.05em',
        }}>
          {sticker.sticker_number}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!onUpdateQty && qty > 1 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'white', background: '#0B1120', borderRadius: 3, padding: '1px 5px' }}>×{qty}</span>
          )}
          {onRemove && (
            <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#ccc', display: 'flex', alignItems: 'center' }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Team name */}
      <div style={{ padding: '4px 10px 2px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {sticker.team_name}
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '0 10px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0B1120', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }} title={sticker.description}>
          {sticker.description?.split(' - ')[0] || sticker.description}
        </div>
      </div>

      {/* Quantity controls */}
      {onUpdateQty && qty !== undefined && (
        <div style={{ borderTop: '1px solid #f0f0ec', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, background: '#fafaf8' }}>
          <button
            onClick={(e) => { e.stopPropagation(); if (qty <= 1) onRemove?.(); else onUpdateQty(qty - 1); }}
            style={{ width: 18, height: 18, borderRadius: 3, background: qty <= 1 ? '#fee2e2' : '#f0f0ec', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: qty <= 1 ? '#dc2626' : '#666', fontWeight: 700, lineHeight: 1 }}
          >
            {qty <= 1 ? <X size={9} /> : '−'}
          </button>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#0B1120', minWidth: 14, textAlign: 'center', fontFamily: 'monospace' }}>{qty}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateQty(qty + 1); }}
            style={{ width: 18, height: 18, borderRadius: 3, background: '#1AAB8A', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, lineHeight: 1 }}
          >+</button>
        </div>
      )}

      {/* Add overlay */}
      {onAdd && (
        <button onClick={onAdd} style={{ position: 'absolute', inset: 0, background: 'rgba(26,171,138,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: 4, background: '#1AAB8A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={14} color="white" />
          </div>
        </button>
      )}
    </div>
  );
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
    <div style={{ background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 32 }}>
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
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches;

    const dismissedAt = parseInt(localStorage.getItem('install_banner_dismissed_at') || '0', 10);
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
    localStorage.setItem('install_banner_dismissed_at', String(Date.now()));
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
  const wrapStyle = { position: 'fixed', bottom: 90, left: 12, right: 70, zIndex: 300, background: '#0B1120', borderRadius: 12, padding: '14px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'flex-start', gap: 12 };
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
    <div style={{ background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      {[
        ['👥', stats.collectors, 'collectors'],
        ['📦', stats.stickersExchanged, 'stickers exchanged'],
        ['🔥', stats.matches, 'matches waiting'],
        ['⭐', stats.activeThisWeek, 'active this week'],
      ].map(([emoji, val, label], i) => (
        <span key={label} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ color: 'rgba(255,255,255,0.15)', margin: '0 2px' }}>·</span>}
          <span>{emoji}</span>
          <span style={{ fontWeight: 800, color: '#1AAB8A', fontFamily: 'monospace' }}>{val?.toLocaleString()}</span>
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
    { key: 'currentStreak', label: 'Current streak', format: (v) => (v ? `🔥 ${v}` : '0') },
    {
      key: 'memberSince',
      label: 'Member since',
      format: (v) => (v ? new Date(v).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—'),
    },
  ];

  const visible = compact ? STAT_DEFS.slice(0, 4) : STAT_DEFS;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
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

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 10, borderBottom: '2px solid #0B1120' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 900, color: '#0B1120', margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{title}</h2>
        {eyebrow && <span style={{ fontSize: 10, fontWeight: 700, color: '#1AAB8A', fontFamily: 'monospace' }}>{eyebrow}</span>}
      </div>
      {action}
    </div>
  );
}

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
      <button onClick={onDismiss} style={{ color: '#991B1B', flexShrink: 0 }}><X size={16} /></button>
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

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 14, background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
      {text}
    </div>
  );
}

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
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...extraStyle }}>
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

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
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
        : await api.signup(name, email, password, inviteCode);
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
    <div style={{ minHeight: '100vh', width: '100%', background: '#0B1120', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', sans-serif" }}>
      <style>{DESIGN_TOKENS}</style>

      {/* Forgot / reset modes */}
      {(mode === 'forgot' || mode === 'forgot_sent') && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 360, background: 'white', borderRadius: 12, padding: 32 }}>
            <img src="data:image/png;base64,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" alt="Got One Spare?" style={{ width: 48, height: 48, objectFit: 'contain', display: 'block', margin: '0 auto 20px' }} />
            {mode === 'forgot_sent' ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0B1120', textAlign: 'center', marginBottom: 8 }}>Check your inbox</div>
                <p style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 }}>If an account exists for {email}, we've sent a reset link.</p>
                <button onClick={() => setMode('login')} style={{ width: '100%', padding: 12, background: '#0B1120', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← Back to login</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0B1120', textAlign: 'center', marginBottom: 20 }}>Reset your password</div>
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
                <input type="email" placeholder="Your email address" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }} autoFocus />
                <button onClick={async () => { if (!email.trim()) { setError('Please enter your email'); return; } setLoading(true); setError(null); try { await api.forgotPassword(email.trim()); setMode('forgot_sent'); } catch(err) { setError(err.message); } finally { setLoading(false); } }} disabled={loading} style={{ width: '100%', padding: 12, background: '#1AAB8A', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <button onClick={() => setMode('login')} style={{ width: '100%', textAlign: 'center', fontSize: 13, marginTop: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>← Back to login</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Login / signup */}
      {(mode === 'login' || mode === 'signup') && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>

          {/* Logo + brand */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <Logo size={72} />
            <div style={{ fontSize: 24, fontWeight: 900, color: 'white', letterSpacing: '-0.5px' }}>Got One Spare?</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>World Cup 2026 sticker swaps</div>
          </div>

          {/* Form card */}
          <div style={{ width: '100%', maxWidth: 380, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>

            {/* Tab strip */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
              <button
                onClick={() => { setMode('login'); setError(null); setInviteRequired(false); }}
                style={{ flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', borderBottom: mode === 'login' ? '2px solid #1AAB8A' : '2px solid transparent', color: mode === 'login' ? '#1AAB8A' : '#aaa', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}
              >Log in</button>
              <button
                onClick={() => { setMode('signup'); setError(null); setInviteRequired(false); }}
                style={{ flex: 1, padding: '14px 0', fontSize: 14, fontWeight: 700, background: 'none', border: 'none', borderBottom: mode === 'signup' ? '2px solid #1AAB8A' : '2px solid transparent', color: mode === 'signup' ? '#1AAB8A' : '#aaa', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1 }}
              >Sign up</button>
            </div>

            {/* Form */}
            <div style={{ padding: '24px 24px 28px' }}>
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mode === 'signup' && (
                  <>
                    <input type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required style={inputStyle} />
                    {inviteRequired && (
                      <input type="text" placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                    )}
                  </>
                )}
                <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
                <button type="submit" disabled={loading} style={{ width: '100%', padding: 13, background: '#1AAB8A', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', marginTop: 2 }}>
                  {loading && <Loader2 className="animate-spin" size={15} />}
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </button>
              </form>

              {mode === 'login' && (
                <button onClick={() => setMode('forgot')} style={{ width: '100%', textAlign: 'center', fontSize: 12, marginTop: 14, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Forgot your password?
                </button>
              )}
            </div>

            {/* Bottom stats strip */}
            <div style={{ background: '#fafaf8', borderTop: '1px solid #f0f0f0', padding: '10px 24px', display: 'flex', justifyContent: 'space-around' }}>
              {stats ? [
                [stats.collectors, 'collectors'],
                [stats.activeThisWeek, 'active this week'],
              ].map(([val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#0B1120', fontFamily: 'monospace' }}>{val.toLocaleString()}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#ccc', marginTop: 1 }}>{label}</div>
                </div>
              )) : (
                ['980 stickers', 'UK collectors', 'Post by post'].map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#ccc' }}>{t}</span>
                ))
              )}
            </div>
          </div>

          {/* 4 steps */}
          <div style={{ display: 'flex', gap: 16, marginTop: 28, maxWidth: 380, width: '100%' }}>
            {[['1','List spares'],['2','Add needs'],['3','Get matched'],['4','Swap by post']].map(([n, t]) => (
              <div key={n} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1AAB8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', margin: '0 auto 5px' }}>{n}</div>
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

function normaliseTeamName(name) {
  return TEAM_NAME_ALIASES[name] || name;
}

function sortTeamsByGroup(teams) {
  return [...teams].sort((a, b) => {
    const an = normaliseTeamName(a.team_name);
    const bn = normaliseTeamName(b.team_name);
    const ai = WC2026_GROUP_ORDER.indexOf(an);
    const bi = WC2026_GROUP_ORDER.indexOf(bn);
    if (ai === -1 && bi === -1) return a.team_name.localeCompare(b.team_name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function StickerPickerModal({ mode, onClose, onPicked }) {
  const { token } = useAuth();
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
    api.getTeams(token).then(setTeams).catch(() => {});
    const getter = mode === 'duplicate' ? api.getMyDuplicates : api.getMyNeeds;
    getter(token).then(items => {
      const map = {};
      items.forEach(s => { map[s.sticker_id] = s; });
      setExisting(map);
    }).catch(() => {});
  }, [token, mode]);

  useEffect(() => {
    if (!selectedTeam) { setTeamStickers([]); return; }
    setTeamLoading(true);
    api.searchStickers(token, { team: selectedTeam })
      .then(setTeamStickers).catch(() => {}).finally(() => setTeamLoading(false));
  }, [selectedTeam, token]);

  useEffect(() => {
    if (pickerTab !== 'search') return;
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const handle = setTimeout(() => {
      setSearchLoading(true);
      api.searchStickers(token, { search: searchQuery })
        .then(setSearchResults).catch(() => {}).finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, token, pickerTab]);

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col" style={{ background: 'var(--surface)' }}>

        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>
              {mode === 'duplicate' ? 'Add duplicates' : 'Add needs'}
            </h3>
            {basketItems.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2 }}>
                {basketItems.length} new sticker{basketItems.length !== 1 ? 's' : ''} selected — tap Add to save
              </div>
            )}
          </div>
          <button onClick={onClose}><X size={18} color="var(--text-secondary)" /></button>
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
                              <button onClick={() => setSearchQty(q => Math.max(1, q - 1))} style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700 }}>−</button>
                              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{searchQty}</span>
                              <button onClick={() => setSearchQty(q => q + 1)} style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700 }}>+</button>
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
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, color: selectedTeam ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            <option value="">Select a team…</option>
            {(teamSort === 'group' ? sortTeamsByGroup(teams) : [...teams].sort((a, b) => a.team_name.localeCompare(b.team_name))).map((t) => {
              const existingCount = Object.values(existing).filter(s => s.team_name === t.team_name).length;
              const codeRange = t.first_number === t.last_number ? t.first_number : `${t.first_number}–${t.last_number}`;
              return <option key={t.team_name} value={t.team_name}>{t.team_name} ({codeRange}){existingCount > 0 ? ` · ${existingCount} already added` : ''}</option>;
            })}
          </select>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Greyed stickers are already in your list — adjust quantity or tap ✕ to remove. Tick new ones then tap Add.
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
                        <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: '#9CA3AF', border: '2px solid #9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            style={{ width: 22, height: 22, borderRadius: 4, background: existingQty <= 1 ? '#FEE2E2' : '#E5E7EB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: existingQty <= 1 ? '#DC2626' : '#374151' }}>
                            {existingQty <= 1 ? <X size={10} /> : '−'}
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center', color: '#6B7280' }}>{existingQty}</span>
                          <button onClick={() => updateExistingQty(s.id, existingQty + 1)}
                            style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => updateExistingQty(s.id, 0)}
                          style={{ marginRight: 12, width: 22, height: 22, borderRadius: 4, background: '#FEE2E2', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', background: isInBasket ? 'var(--primary-light)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                    <button onClick={() => toggleBasket(s)}
                      style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: isInBasket ? 'var(--primary)' : 'transparent', border: `2px solid ${isInBasket ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                          style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center', color: 'var(--text-primary)' }}>{basket[s.id]?.quantity || 1}</span>
                        <button onClick={() => setBasketQty(s.id, (basket[s.id]?.quantity || 1) + 1)}
                          style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
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
            Select a team above to start adding stickers
          </div>
        )}

        {basketItems.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            <Btn variant="primary" onClick={confirmAll} disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : `Add ${totalCount} sticker${totalCount > 1 ? 's' : ''}`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-lg p-6" style={{ background: 'var(--surface)' }}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-lg p-6" style={{ background: 'var(--surface)' }}>
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
                {loading ? 'Redirecting to checkout…' : 'Become a Founder — £14.99'}
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
    const dismissedAt = parseInt(localStorage.getItem('founder_banner_dismissed_at') || '0', 10);
    const cooledDown = Date.now() - dismissedAt > 21 * 24 * 60 * 60 * 1000; // 3 weeks
    if (cooledDown) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('founder_banner_dismissed_at', String(Date.now()));
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

// =================================================================
// TOPPS PREMIER LEAGUE 2026 — COMING SOON TEASER
// Dismissing the banner (localStorage, like the others) is entirely
// separate from registering interest (server-side, so a launch
// announcement can reach people regardless of device).
// =================================================================
function PL2026Banner({ onOpen }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pl2026_banner_dismissed') === 'true';
    if (!dismissed) setShow(true);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('pl2026_banner_dismissed', 'true');
  };

  if (!show) return null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>👕</span>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
        <strong>Topps Premier League 2026</strong> — coming soon.
      </div>
      <button onClick={onOpen} style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 6, background: 'var(--primary)', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        View
      </button>
      <button onClick={dismiss} style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
        <X size={15} />
      </button>
    </div>
  );
}

function PL2026Modal({ onClose }) {
  const { token } = useAuth();
  const [notified, setNotified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.getPL2026Status(token)
      .then((d) => setNotified(Boolean(d.notified)))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [token]);

  const registerInterest = async () => {
    setLoading(true);
    try {
      await api.notifyPL2026(token);
      setNotified(true);
    } catch {
      // fails quietly — nothing critical is lost if this one click doesn't register
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-sm rounded-lg overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div style={{ background: 'var(--primary-dark)', padding: '24px 24px 20px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} color="white" />
          </button>
          <div style={{ fontSize: 32, marginBottom: 6 }}>👕</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'white', marginBottom: 4 }}>Topps Premier League 2026</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Coming soon</div>
        </div>

        <div style={{ padding: 22 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            A brand new sticker collection for the Premier League 2026 season is on the way. Once it launches, you'll be able to list spares and needs just like you do now, and get matched with other collectors.
          </p>

          {checking ? (
            <Spinner />
          ) : notified ? (
            <div style={{ background: 'var(--success-light)', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#065F46" />
              <span style={{ fontSize: 13, color: '#065F46', fontWeight: 600 }}>We'll notify you when it's live</span>
            </div>
          ) : (
            <button
              onClick={registerInterest}
              disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 8, background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <Bell size={15} /> Notify me when it launches
            </button>
          )}
        </div>
      </div>
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getUserRatings(token, userId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    api.getUserStats(token, userId).then((res) => { if (!cancelled) setStats(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token, userId]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-lg p-6 max-h-[85vh] overflow-y-auto" style={{ background: 'var(--surface)', border: stats?.isFounder ? '2px solid #D97706' : 'none' }}>

        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Profile</span>
          <button onClick={onClose}><X size={18} color="var(--text-secondary)" /></button>
        </div>

        {loading && <Spinner />}
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {stats && (
          <>
            <div className="flex items-center gap-3 mb-4">
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

            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
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
                  ✏️ Edit your profile
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

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Reliability</div>
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
// DASHBOARD (duplicates + needs), now backed by real API state
// =================================================================
function FutureCollectionsWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [wantsApp, setWantsApp] = useState(null);
  const [phoneOs, setPhoneOs] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasOpened, setHasOpened] = useState(() => {
    try { return localStorage.getItem('appSurveyOpened') === '1'; } catch { return false; }
  });

  useEffect(() => {
    api.getAppSurvey(token).then(data => {
      if (data.answered) {
        setWantsApp(data.wantsApp);
        setPhoneOs(data.phoneOs);
        setSubmitted(true);
      }
      setLoaded(true);
    }).catch(() => { setLoaded(true); });
  }, [token]);

  const submit = async () => {
    if (wantsApp === null || !phoneOs) return;
    setSaving(true);
    try {
      await api.submitAppSurvey(token, wantsApp, phoneOs);
      setSubmitted(true);
      setTimeout(() => setOpen(false), 800);
    } catch {
      // leave the form open so they can try again
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const canSubmit = wantsApp !== null && !!phoneOs;
  const optionStyle = (active) => ({ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + (active ? '#1AAB8A' : 'var(--border)'), background: active ? 'rgba(26,171,138,0.08)' : 'var(--bg)', transition: 'all 0.15s' });

  return (
    <div style={{ position: 'fixed', bottom: 128, right: 16, zIndex: 200 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 48, right: 0,
          width: 300, background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 16,
          maxHeight: '70vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>🚀 Shape our future</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Two quick questions to help us plan ahead.</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}><X size={14} /></button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              We're exploring building a Got One Spare app. Would that be useful to you?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[{ v: true, label: "👍 Yes, I'd use an app" }, { v: false, label: '👎 No, the website is fine' }].map(opt => (
                <label key={String(opt.v)} style={optionStyle(wantsApp === opt.v)}>
                  <input type="radio" name="wantsApp" checked={wantsApp === opt.v} onChange={() => setWantsApp(opt.v)} style={{ width: 14, height: 14, accentColor: '#1AAB8A', flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              If we did, which would you use it on?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[{ v: 'ios', label: '🍎 iPhone (iOS)' }, { v: 'android', label: '🤖 Android' }, { v: 'neither', label: '🤷 Neither' }].map(opt => (
                <label key={opt.v} style={optionStyle(phoneOs === opt.v)}>
                  <input type="radio" name="phoneOs" checked={phoneOs === opt.v} onChange={() => setPhoneOs(opt.v)} style={{ width: 14, height: 14, accentColor: '#1AAB8A', flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit || saving}
            style={{ width: '100%', padding: '9px 0', background: !canSubmit ? 'var(--border)' : '#1AAB8A', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !canSubmit ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {submitted ? '✓ Saved — update answers' : 'Submit'}
          </button>

          <button onClick={() => setOpen(false)} style={{ width: '100%', textAlign: 'center', fontSize: 11, marginTop: 8, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Minimise
          </button>
        </div>
      )}

      <button
        onClick={() => {
          setOpen(o => !o);
          if (!hasOpened) {
            setHasOpened(true);
            try { localStorage.setItem('appSurveyOpened', '1'); } catch {}
          }
        }}
        style={{
          position: 'relative',
          width: 40, height: 40, borderRadius: '50%',
          background: open ? 'var(--navy)' : '#1AAB8A',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s', fontSize: 18,
        }}
        title="Shape our future"
      >
        📱
        {!submitted && !hasOpened && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: 'var(--danger)', color: 'white',
            fontSize: 10, fontWeight: 700,
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, border: '2px solid var(--surface)',
          }}>
            1
          </span>
        )}
      </button>
    </div>
  );
}

function DashboardScreen({ onOpenSwap }) {
  const { token, user } = useAuth();
  const [duplicates, setDuplicates] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorSwapId, setErrorSwapId] = useState(null);
  const [picker, setPicker] = useState(null); // 'duplicate' | 'need' | null
  const [duplicatesOpen, setDuplicatesOpen] = useState(true);
  const [needsOpen, setNeedsOpen] = useState(true);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [showPL2026Modal, setShowPL2026Modal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dups, needsList] = await Promise.all([api.getMyDuplicates(token), api.getMyNeeds(token)]);
      const byGroupOrder = (a, b) => {
        const ai = WC2026_GROUP_ORDER.indexOf(normaliseTeamName(a.team_name));
        const bi = WC2026_GROUP_ORDER.indexOf(normaliseTeamName(b.team_name));
        if (ai !== bi) {
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }
        const an = parseInt(a.sticker_number.replace(/[^0-9]/g, '')) || 0;
        const bn = parseInt(b.sticker_number.replace(/[^0-9]/g, '')) || 0;
        return an - bn;
      };
      setDuplicates([...dups].sort(byGroupOrder));
      setNeeds([...needsList].sort(byGroupOrder));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const removeDuplicate = async (stickerId) => {
    setDuplicates((d) => d.filter((x) => x.sticker_id !== stickerId));
    try {
      await api.removeDuplicate(token, stickerId);
      setErrorSwapId(null);
    } catch (err) {
      setError(err.message);
      setErrorSwapId(err.swapId || null);
      load();
    }
  };

  const removeNeed = async (stickerId) => {
    setNeeds((n) => n.filter((x) => x.sticker_id !== stickerId));
    try {
      await api.removeNeed(token, stickerId);
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  const [activeTeam, setActiveTeam] = useState('All');

  if (loading) return <Spinner />;

  const totalSpares = duplicates.reduce((s, d) => s + d.quantity, 0);
  const totalNeeds = needs.length;
  const totalStickers = 980;
  const completionPct = Math.round(((totalStickers - totalNeeds) / totalStickers) * 100);

  const teamGroups = ['All', 'FWC', 'England', 'Argentina', 'France', 'Brazil', 'Germany', 'Spain', 'Portugal', 'Netherlands'];
  const filteredDuplicates = activeTeam === 'All' ? duplicates : duplicates.filter(s => normaliseTeamName(s.team_name) === activeTeam || s.team_name === activeTeam);
  const filteredNeeds = activeTeam === 'All' ? needs : needs.filter(s => normaliseTeamName(s.team_name) === activeTeam || s.team_name === activeTeam);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <ErrorBanner
        message={error}
        onDismiss={() => { setError(null); setErrorSwapId(null); }}
        action={errorSwapId && onOpenSwap ? { label: `View swap #${errorSwapId} →`, onClick: () => onOpenSwap(errorSwapId) } : null}
      />

      {user?.matching_paused && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#92400E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔴 Matching paused — you won't receive new matches until you turn this off in your profile.
        </div>
      )}

      {!user?.founder_member && <FounderBanner onOpen={() => setShowFounderModal(true)} />}
      <PL2026Banner onOpen={() => setShowPL2026Modal(true)} />

      {/* ── Stats ticker — one line, left-anchored, not a card ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14, borderBottom: '2px solid var(--text-primary)', paddingBottom: 10 }}>
        {[
          [980 - totalNeeds, 'collected'],
          [totalSpares, 'spares'],
          [totalNeeds, 'needed'],
          [completionPct + '%', 'complete'],
        ].map(([v, l], i) => (
          <div key={l} style={{ flex: 1, borderRight: i < 3 ? '1px solid var(--border)' : 'none', padding: '0 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{l}</div>
          </div>
        ))}
        <div style={{ flex: 1, padding: '0 0 0 12px' }}>
          <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: completionPct + '%', background: '#1AAB8A', transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Progress</div>
        </div>
      </div>

      {/* ── Team filter chips — horizontal scroll rail ─────── */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 16, scrollbarWidth: 'none' }}>
        {teamGroups.map(t => (
          <button key={t} onClick={() => setActiveTeam(t)} style={{
            padding: '5px 12px', borderRadius: 3, border: activeTeam === t ? '1.5px solid #0B1120' : '1.5px solid #e0e0e0',
            background: activeTeam === t ? '#0B1120' : 'white', color: activeTeam === t ? 'white' : '#666',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            letterSpacing: '0.03em',
          }}>{t}</button>
        ))}
      </div>

      {/* ── Spares section ─────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setDuplicatesOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#999', fontSize: 11 }}>
              {duplicatesOpen ? '▾' : '▸'}
            </button>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#0B1120', letterSpacing: '-0.2px', textTransform: 'uppercase' }}>Spares</span>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#1AAB8A', color: 'white', borderRadius: 3, padding: '1px 6px' }}>{filteredDuplicates.length}</span>
          </div>
          <Btn variant="navy" size="sm" onClick={() => setPicker('duplicate')}><Plus size={13} /> Add spare</Btn>
        </div>
        {duplicatesOpen && (
          filteredDuplicates.length === 0
            ? <EmptyState text={activeTeam === 'All' ? 'No spares listed yet. Add duplicates to start matching.' : `No spares for ${activeTeam} yet.`} />
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {filteredDuplicates.map(s => <StickerCard key={s.sticker_id} sticker={s} mode="duplicate" onRemove={() => removeDuplicate(s.sticker_id)} onUpdateQty={async (newQty) => {
                  await api.updateDuplicateQty(token, s.sticker_id, newQty);
                  setDuplicates(d => d.map(x => x.sticker_id === s.sticker_id ? { ...x, quantity: newQty } : x));
                }} />)}
              </div>
        )}
      </div>

      {/* ── Needs section ──────────────────────────────────── */}
      <div style={{ marginBottom: 20, borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setNeedsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: '#999', fontSize: 11 }}>
              {needsOpen ? '▾' : '▸'}
            </button>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#0B1120', letterSpacing: '-0.2px', textTransform: 'uppercase' }}>Needs</span>
            <span style={{ fontSize: 10, fontWeight: 800, background: '#0B1120', color: 'white', borderRadius: 3, padding: '1px 6px' }}>{filteredNeeds.length}</span>
          </div>
          <Btn variant="outline" size="sm" onClick={() => setPicker('need')}><Plus size={13} /> Add need</Btn>
        </div>
        {needsOpen && (
          filteredNeeds.length === 0
            ? <EmptyState text={activeTeam === 'All' ? 'No needs listed. Add what you are missing to get matched.' : `No needs for ${activeTeam}.`} />
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {filteredNeeds.map(s => <StickerCard key={s.sticker_id} sticker={s} mode="need" onRemove={() => removeNeed(s.sticker_id)} />)}
              </div>
        )}
      </div>

      {/* ── Per-team progress (collapsible) ─────────────────── */}
      {needs.length > 0 && (() => {
        const teamNeeds = {};
        needs.forEach(s => { if (!teamNeeds[s.team_name]) teamNeeds[s.team_name] = 0; teamNeeds[s.team_name]++; });
        const teamsWithNeeds = Object.entries(teamNeeds)
          .map(([team, needCount]) => {
            const total = team === 'FWC' ? 19 : team.startsWith('Coca-Cola') ? 12 : 20;
            const have = total - needCount;
            return { team, have, total, needCount, pct: Math.round((have / total) * 100) };
          })
          .sort((a, b) => b.pct - a.pct);
        return (
          <details style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            <summary style={{ fontSize: 11, fontWeight: 800, color: '#0B1120', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <span>▸</span> Team progress
            </summary>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teamsWithNeeds.map(({ team, have, total, pct }) => (
                <div key={team} style={{ display: 'grid', gridTemplateColumns: '1fr 40px 80px', gap: 8, alignItems: 'center' }}>
                  <div style={{ height: 4, background: '#e8e8e8', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? '#1AAB8A' : '#0B1120', borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#0B1120', textAlign: 'right' }}>{have}/{total}</span>
                  <span style={{ fontSize: 10, color: '#999', fontWeight: 600 }}>{team}</span>
                </div>
              ))}
            </div>
          </details>
        );
      })()}

      {showFounderModal && <FounderModal onClose={() => setShowFounderModal(false)} />}
      {showPL2026Modal && <PL2026Modal onClose={() => setShowPL2026Modal(false)} />}

      {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={() => {
        Promise.all([api.getMyDuplicates(token), api.getMyNeeds(token)])
          .then(([dups, needsList]) => {
            const byGroupOrder = (a, b) => {
              const ai = WC2026_GROUP_ORDER.indexOf(normaliseTeamName(a.team_name));
              const bi = WC2026_GROUP_ORDER.indexOf(normaliseTeamName(b.team_name));
              if (ai !== bi) { if (ai === -1) return 1; if (bi === -1) return -1; return ai - bi; }
              const an = parseInt(a.sticker_number.replace(/[^0-9]/g, '')) || 0;
              const bn = parseInt(b.sticker_number.replace(/[^0-9]/g, '')) || 0;
              return an - bn;
            };
            setDuplicates([...dups].sort(byGroupOrder));
            setNeeds([...needsList].sort(byGroupOrder));
          })
          .catch(() => {});
      }} />}
    </div>
  );
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col" style={{ background: 'var(--surface)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>Swap preview</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>with {match.other_user_name}<AmbassadorMark show={match.ambassador_badge} size={11} /><FounderBadge show={match.founder_member} size={11} /></div>
          </div>
          <button onClick={onClose}><X size={18} color="var(--text-secondary)" /></button>
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
                        <div style={{ fontSize: 11, color: '#3B6FA6', fontWeight: 600 }}>ℹ️ You're already receiving this from swap #{s.already_receiving_swap_id}</div>
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
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewingMatch, setPreviewingMatch] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMatches(await api.getMatches(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader eyebrow="Found for you" title="Matches" />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {matches.length === 0 ? (
        <EmptyState text="No matches yet — list more duplicates and needs to improve your chances." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...matches].sort((a, b) => Math.min(b.a_gives_b_count, b.b_gives_a_count) - Math.min(a.a_gives_b_count, a.b_gives_a_count)).map((m, idx) => {
            const swapCount = Math.min(m.a_gives_b_count, m.b_gives_a_count);
            const initials = m.other_user_name.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase();
            return (
              <div key={m.id} style={{ background: 'white', border: '1px solid #e8e8e4', borderLeft: '3px solid #1AAB8A', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0ec' }}>
                  <button
                    onClick={() => openProfile(m.other_user_id)}
                    style={{ width: 36, height: 36, borderRadius: 4, background: '#0B1120', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}
                  >{initials}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => openProfile(m.other_user_id)} style={{ textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: m.founder_member ? '#B45309' : '#0B1120', letterSpacing: '-0.1px' }}>{m.other_user_name}<AmbassadorMark show={m.ambassador_badge} /><FounderBadge show={m.founder_member} /></div>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <StarRating value={m.rating_avg} size={11} />
                      <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace' }}>({m.rating_count})</span>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <ActivityIndicator lastLoginAt={m.last_login_at} />
                    </div>
                    {m.distance_miles != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>
                        <MapPin size={10} />
                        ~{m.distance_miles} mi away
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#1AAB8A', lineHeight: 1, fontFamily: 'monospace' }}>{swapCount}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>each way</div>
                  </div>
                </div>
                <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: '#fafaf8' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0B1120' }}>{swapCount} stickers</div>
                    <div style={{ fontSize: 10, color: '#bbb', fontWeight: 600, marginTop: 2 }}>you give</div>
                  </div>
                  <div style={{ fontSize: 16, color: '#1AAB8A', fontWeight: 900 }}>↔</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#1AAB8A' }}>{swapCount} stickers</div>
                    <div style={{ fontSize: 10, color: '#bbb', fontWeight: 600, marginTop: 2 }}>you get</div>
                  </div>
                  <button
                    onClick={() => setPreviewingMatch(m)}
                    style={{ padding: '7px 14px', background: '#0B1120', color: 'white', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.2px', flexShrink: 0 }}
                  >Preview →</button>
                </div>
                {m.has_conflict && (
                  <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderTop: '1px solid #FDE68A' }}>
                    ⚠️ Some of this may already be committed to another swap — check the preview before proposing.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {previewingMatch && (
        <SwapPreviewModal
          match={previewingMatch}
          onClose={() => setPreviewingMatch(null)}
          onPropose={(swapId) => {
            setPreviewingMatch(null);
            onOpenSwap(swapId);
          }}
        />
      )}
    </div>
  );
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
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMySwaps(token)
      .then(setSwaps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spinner />;

  const SwapCard = ({ s }) => {
    const label = getSwapLabel(s, user?.id);
    const colors = SWAP_STATUS_COLORS[label] || SWAP_STATUS_COLORS[s.status] || SWAP_STATUS_COLORS.proposed;
    const isActionNeeded = label.includes('Your turn') || label.includes('You need');
    const borderAccent = isActionNeeded ? '#f59e0b' : ['Waiting for them', 'Waiting for them to post', 'Completed', 'completed'].some(l => label.includes(l)) ? '#1AAB8A' : '#0B1120';
    return (
      <div
        key={s.id}
        onClick={() => onOpenSwap(s.id)}
        style={{ width: '100%', background: 'white', border: '1px solid #e8e8e4', borderLeft: '3px solid ' + borderAccent, borderRadius: 4, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', textAlign: 'left' }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); openProfile(s.other_user_id); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 4, background: '#0B1120', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, fontFamily: 'monospace', overflow: 'hidden' }}>
            {s.other_user_name.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: s.founder_member ? '#B45309' : '#0B1120', letterSpacing: '-0.1px' }}>{s.other_user_name}<AmbassadorMark show={s.ambassador_badge} /><FounderBadge show={s.founder_member} /></div>
            <div style={{ fontSize: 10, color: '#bbb', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontFamily: 'monospace' }}>
              <span>#{s.id}</span>
              {(s.display_give_count > 0 || s.display_get_count > 0) && (
                <><span>·</span><span style={{ color: '#0B1120', fontWeight: 700 }}>{s.display_give_count}↔{s.display_get_count}</span></>
              )}
              {s.status === 'proposed' && (
                <><span>·</span><span>proposed {formatSwapAge(s.created_at)}</span></>
              )}
            </div>
            <div style={{ marginTop: 2 }}>
              <ActivityIndicator lastLoginAt={s.last_login_at} />
            </div>
          </div>
        </button>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, background: colors.bg, color: colors.text, flexShrink: 0, letterSpacing: '0.02em' }}>
          {label}
        </span>
      </div>
    );
  };

  const groups = [
    {
      key: 'action',
      title: '👋 Action needed',
      filter: (s) => {
        const label = getSwapLabel(s, user?.id);
        return label === 'Your turn to accept' || label === 'You need to post';
      },
    },
    {
      key: 'waiting',
      title: '⏳ Waiting for them',
      filter: (s) => {
        const label = getSwapLabel(s, user?.id);
        return label === 'Waiting for them' || label === 'Awaiting acceptance' || label === 'Waiting for them to post' || label === 'Ready to post';
      },
    },
    {
      key: 'posted',
      title: '📬 In the post',
      filter: (s) => s.status === 'posted',
    },
    {
      key: 'completed',
      title: '✅ Completed',
      filter: (s) => s.status === 'completed',
    },
    {
      key: 'disputed',
      title: '⚠️ Disputed',
      filter: (s) => s.status === 'disputed',
    },
  ];

  const hasAny = swaps.length > 0;

  return (
    <div>
      <SectionHeader eyebrow="History" title="My swaps" />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ background: '#0B1120', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🏅</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Become a Got One Spare ambassador</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Share on Facebook to earn your badge</div>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: copied ? '#1AAB8A' : '#0B1120', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>1</div>
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
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0B1120', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>2</div>
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
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0B1120', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>3</div>
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
          style={{ width: '100%', padding: '11px', borderRadius: 'var(--radius-sm)', background: '#1AAB8A', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.6 : 1 }}
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
      const matches = await api.getMatches(token);
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

  const sortByAlbumOrder = (arr) => [...arr].sort((a, b) => {
    const an = normaliseTeamName(a.team_name);
    const bn = normaliseTeamName(b.team_name);
    const ai = WC2026_GROUP_ORDER.indexOf(an);
    const bi = WC2026_GROUP_ORDER.indexOf(bn);
    if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return (a.sticker_number || '').localeCompare(b.sticker_number || '', undefined, { numeric: true });
  });

  const youGive = sortByAlbumOrder(items.filter((i) => i.from_user_id === user.id));
  const youReceive = sortByAlbumOrder(items.filter((i) => i.to_user_id === user.id));
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
    <div className="space-y-6">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {actionConfirm && (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#065F46' }}>
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

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: 'var(--primary-dark)', fontFamily: 'monospace' }}>
            Swap #{swap.id}
          </div>
          <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            with{' '}
            <button onClick={() => openProfile(otherUserId)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', color: otherIsFounder ? '#B45309' : 'inherit', textDecoration: 'underline' }}>
              {otherName}
            </button>
            <AmbassadorMark show={otherIsAmbassador} size={16} /><FounderBadge show={otherIsFounder} size={16} />
          </h2>
          <button onClick={() => openProfile(otherUserId)} className="text-xs font-semibold underline" style={{ color: 'var(--primary-dark)' }}>
            View their profile
          </button>
          <div style={{ marginTop: 4 }}>
            <ActivityIndicator lastLoginAt={otherUser?.last_login_at} size={12} />
          </div>
        </div>
      </div>

      {swap.status !== 'declined' && (() => {
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
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div className="flex items-center" style={{ minWidth: 460 }}>
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
                      <span className="text-[9px] font-medium" style={{ color: isPast ? 'var(--primary-dark)' : isCurrent ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
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

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
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
              <div className="grid grid-cols-1 gap-2">
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
              <div className="grid grid-cols-1 gap-2">
                {youReceive.map((s) => (
                  <div key={s.sticker_id}>
                    <StickerCard sticker={s} qtyOverride={1} />
                    {s.also_in_progress && (
                      <div style={{ fontSize: 11, color: '#92400E', fontWeight: 600, marginTop: 2, padding: '0 2px' }}>⚠️ {otherName} has also committed this to swap #{s.other_swap_id}</div>
                    )}
                    {s.already_receiving && (
                      <div style={{ fontSize: 11, color: '#3B6FA6', fontWeight: 600, marginTop: 2, padding: '0 2px' }}>ℹ️ You're already receiving this from swap #{s.already_receiving_swap_id}</div>
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
          ℹ️ This list was fixed when the swap was proposed, so it won't change even if your needs or duplicates change afterward.
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
                <CheckCircle2 size={20} color="#065F46" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>You've accepted ✓</div>
                  <div style={{ fontSize: 13, color: '#065F46', marginTop: 2 }}>
                    {theirAccepted
                      ? "You've both accepted — stickers are being confirmed now..."
                      : `Waiting for ${otherName} to accept. You don't need to do anything else right now.`}
                  </div>
                </div>
              </div>
              {!theirAccepted && (
                <button
                  onClick={() => {
                    if (window.confirm(`Withdraw from this swap? ${otherName} will be notified and your stickers will become available for new matches again.`)) {
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
            <div style={{ background: 'var(--warning-light)', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: '#92400E', fontWeight: 600 }}>
              {theirAccepted
                ? `⏳ ${otherName} has accepted — it's your turn to accept or decline`
                : '⏳ Review the stickers below and accept or decline this swap'}
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
            📸 Sticker photos
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
                <span style={{ fontSize: 18 }}>📷</span>
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
                <span style={{ fontSize: 18 }}>📷</span>
                <span>Add proof of postage photo <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(optional)</span></span>
              </label>
            )}
          </div>

          <button onClick={() => act(() => api.markPosted(token, swap.id, postagePhoto || undefined), '✓ Marked as posted — the other person has been notified!')} disabled={busy} className="mt-1 w-full py-2 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Package size={15} />} Mark as posted
          </button>

          {!swap.user_a_posted && !swap.user_b_posted && (
            <button
              onClick={() => {
                if (window.confirm(`Withdraw from this accepted swap? ${otherName} will be notified and your stickers will become available for new matches again.`)) {
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

      {(swap.status === 'accepted' || swap.status === 'posted') && swap.user_a_accepted && swap.user_b_accepted && (isUserA ? swap.user_a_posted : swap.user_b_posted) && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 4px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🎁 Bonus — optional</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <AmbassadorCard token={token} swapId={swap.id} />
        </>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>📬 Estimated delivery</div>
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
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>📷 Add proof of postage (optional)</div>
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
              <span style={{ fontSize: 18 }}>📷</span>
              <span>Tap to add a photo of your proof of postage</span>
            </label>
          )}
        </div>
      )}

      {/* Proof of postage display — per-user, so both sides get their own slot */}
      {(swap.status === 'accepted' || swap.status === 'posted' || swap.status === 'completed') && (swap.user_a_postage_photo || swap.user_b_postage_photo || swap.postage_photo) && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📷 Proof of postage
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
      const { messages: msgs, otherUser: freshOtherUser } = await api.getConversationMessages(token, convId);
      setMessages(msgs);
      if (freshOtherUser) setActiveConv({ conversationId: convId, otherUser: freshOtherUser });
      loadConversations();
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
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          <button onClick={() => { setActiveConv(null); setMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>← Back</button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => openProfile(activeConv.otherUser?.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontWeight: 700, fontSize: 15, color: activeConv.otherUser?.founder_member ? '#B45309' : 'var(--text-primary)' }}>
              {activeConv.otherUser?.name}<AmbassadorMark show={activeConv.otherUser?.ambassador_badge} /><FounderBadge show={activeConv.otherUser?.founder_member} />
            </button>
            <ActivityIndicator lastLoginAt={activeConv.otherUser?.last_login_at} size={11} />
          </div>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>
          Messages may be reviewed by the admin team for safety. Be kind and respectful.
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => {
            const isMe = m.sender_id === user.id;
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
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
                    <button onClick={() => reportMessage(m.id)} style={{ fontSize: 11, padding: '3px 8px', background: '#EF4444', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Confirm report</button>
                    <button onClick={() => setReportingId(null)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type a message…"
            style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14 }}
          />
          <button onClick={sendMessage} disabled={sending || !newMessage.trim()} style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white', fontSize: 18 }}>↑</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionHeader eyebrow="Stay connected" title="Messages" />
        <Btn variant="primary" size="sm" onClick={() => setShowNewMessage(true)}>+ New</Btn>
      </div>

      {loading && <Spinner />}
      {!loading && conversations.length === 0 && (
        <EmptyState text="No messages yet. Start a conversation from the Search tab or from a swap." />
      )}
      {conversations.map(c => (
        <div key={c.conversation_id} onClick={() => openConversation(c.conversation_id, { id: c.other_user_id, name: c.other_user_name, ambassador_badge: c.other_user_ambassador_badge, founder_member: c.other_user_founder_member, last_login_at: c.other_user_last_login_at })}
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
        </div>
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:max-w-md sm:rounded-lg rounded-t-lg" style={{ background: 'var(--surface)', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>New message</h3>
          <button onClick={onClose}><X size={18} color="var(--text-muted)" /></button>
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
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNoShowModal, setShowNoShowModal] = useState(null);

  useEffect(() => {
    api.getSwapHistory(token)
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader eyebrow="Your record" title="Swap history" />
      {history.length === 0 ? (
        <EmptyState text="No completed or declined swaps yet." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(s => {
            const isCompleted = s.status === 'completed';
            return (
              <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
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
                {isCompleted && (
                  <button
                    onClick={() => setShowNoShowModal(s)}
                    style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Report a problem with this swap
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showNoShowModal && (
        <NoShowReportModal
          swap={showNoShowModal}
          onClose={() => setShowNoShowModal(null)}
        />
      )}
    </div>
  );
}

// =================================================================
// NO-SHOW REPORT MODAL
// =================================================================
function NoShowReportModal({ swap, onClose }) {
  const { token } = useAuth();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSaving(true);
    try {
      await api.reportNoShow(token, swap.id, notes);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:max-w-md sm:rounded-lg rounded-t-lg" style={{ background: 'var(--surface)', padding: 24 }}>
        {done ? (
          <>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>✅</div>
            <h3 style={{ textAlign: 'center', fontWeight: 700, marginBottom: 8 }}>Report submitted</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 16 }}>Thanks for letting us know. The admin team will look into it.</p>
            <button onClick={onClose} style={{ width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14 }}>Close</button>
          </>
        ) : (
          <>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Report a problem</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Was there an issue with your swap with {swap.other_user_name}? Let us know what happened.
            </p>
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. They marked as posted but stickers never arrived…"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', resize: 'none', marginBottom: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 11, borderRadius: 'var(--radius-sm)', background: 'var(--bg)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submit} disabled={saving} style={{ flex: 1, padding: 11, borderRadius: 'var(--radius-sm)', background: '#EF4444', border: 'none', color: 'white', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {saving ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
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
    <div>
      <SectionHeader eyebrow="Find collectors" title="Search users" />
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
          key={u.id}
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
                {u.swap_streak >= 3 && <span>· 🔥 {u.swap_streak} streak</span>}
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Invalid reset link</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Please request a new password reset.</p>
        <a href="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>Go to Got One Spare?</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
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
                style={{ width: '100%', padding: '13px 0', borderRadius: 'var(--radius-sm)', background: '#1AAB8A', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                {status === 'loading' && <Loader2 className="animate-spin" size={14} />}
                Set new password
              </button>
            </div>
          </>
        )}
      </div>
    </div>
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
    <div className="min-h-screen w-full flex items-center justify-center px-5" style={{ background: 'var(--surface)', fontFamily: 'inherit' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div className="w-full max-w-sm text-center">
        <div className="mb-5 flex justify-center"><Logo size={48} /></div>

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

function ProfileScreen({ onClose, onSaved }) {
  const { token, user } = useAuth();
  const { dark, toggle } = useTheme();
  const [badges, setBadges] = useState([]);
  const [stats, setStats] = useState(null);
  const [myReports, setMyReports] = useState([]);
  const [withdrawingReportId, setWithdrawingReportId] = useState(null);
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
    if (!window.confirm("This will remove ALL your spares and needs from your lists — useful if your list hasn't kept up with your actual collection and you'd rather start fresh. It won't affect any swap already in progress. This can't be undone. Continue?")) {
      return;
    }
    setClearingBusy(true);
    setClearResult(null);
    try {
      const result = await api.clearAllStickers(token);
      setClearResult(`✓ Cleared ${result.duplicatesCleared} spare${result.duplicatesCleared !== 1 ? 's' : ''} and ${result.needsCleared} need${result.needsCleared !== 1 ? 's' : ''}. Add your list back whenever you're ready.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setClearingBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-lg p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
        <h3 className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Your details</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Your address is only shown to a swap partner after you've both accepted a swap.
        </p>

        {!hasAddress && (
          <div className="rounded p-3 mb-4 text-sm" style={{ background: '#FBF1D9', color: '#5C4711', border: '1px solid #E8D9A8' }}>
            Add your address now so you're ready to accept swaps — without it, swap partners won't know where to post stickers.
          </div>
        )}

        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        {saved && <div className="rounded p-3 mb-4 text-sm" style={{ background: '#E5F1EC', color: 'var(--primary-dark)' }}>Saved!</div>}

        <div className="flex items-center gap-4 mb-4">
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

        <div className="space-y-3 mb-4">
          <input
            placeholder="Name"
            value={form.name}
            onChange={set('name')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          <input
            placeholder="Address line 1"
            value={form.address_line1}
            onChange={set('address_line1')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          <input
            placeholder="Address line 2 (optional)"
            value={form.address_line2}
            onChange={set('address_line2')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          <input
            placeholder="City"
            value={form.city}
            onChange={set('city')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          <input
            placeholder="Postcode (e.g. SW1A 2AA)"
            value={form.postcode}
            onChange={(e) => set('postcode')({ target: { value: e.target.value.toUpperCase() } })}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'monospace', letterSpacing: '0.05em' }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 0' }}>
            UK postcodes only — this platform is for UK-based collectors.
          </p>
        </div>

        {/* Founder membership */}
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          {user.founder_member ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#92400E' }}>
              🏆 Founder Member — thank you for supporting Got One Spare
            </div>
          ) : (
            <button
              onClick={() => setShowFounderModal(true)}
              style={{ width: '100%', padding: '11px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, #D97706, #92400E)', border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              🏆 Become a Founder — support Got One Spare
            </button>
          )}
        </div>

        {/* Availability — pause matching */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {matchingPaused ? '🔴 Matching paused' : '🟢 Available for swaps'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {matchingPaused
                ? "You won't receive new matches until you turn this back on."
                : 'Your spares/needs lists stay saved either way — this just pauses new matches.'}
            </div>
          </div>
          <button
            onClick={toggleMatchingPaused}
            disabled={pausingBusy}
            style={{ width: 48, height: 28, borderRadius: 14, background: matchingPaused ? 'var(--danger)' : 'var(--primary)', border: 'none', cursor: pausingBusy ? 'default' : 'pointer', position: 'relative', transition: 'background 0.2s', opacity: pausingBusy ? 0.6 : 1, flexShrink: 0 }}
          >
            <span style={{ position: 'absolute', top: 3, left: matchingPaused ? 3 : 22, width: 22, height: 22, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Dark mode</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Switch to a darker colour scheme</div>
          </div>
          <button
            onClick={toggle}
            style={{ width: 48, height: 28, borderRadius: 14, background: dark ? 'var(--primary)' : 'var(--border)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
          >
            <span style={{ position: 'absolute', top: 3, left: dark ? 22 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </button>
        </div>

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
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 8px', cursor: withdrawingReportId === r.id ? 'default' : 'pointer' }}
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
        </div>

        {showFounderModal && <FounderModal onClose={() => setShowFounderModal(false)} />}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
            Close
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
            {loading && <Loader2 className="animate-spin" size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// FEEDBACK WIDGET
// =================================================================
function FeedbackWidget() {
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
function WhatsNewPanel() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { announcements: items, unreadCount: count } = await api.getAnnouncements(token);
      setAnnouncements(items);
      setUnreadCount(count);
    } catch {}
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async () => {
    setOpen(true);
    if (unreadCount > 0) {
      await api.markAnnouncementsRead(token).catch(() => {});
      setUnreadCount(0);
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        title="What's new"
      >
        <span style={{ fontSize: 15 }}>📋</span>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: '#1AAB8A', border: '2px solid #0B1120' }} />
        )}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '60px 12px 0' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 340, maxHeight: '75vh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>What's new</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latest updates & bug fixes</div>
              </div>
              <button onClick={() => setOpen(false)}><X size={16} color="var(--text-muted)" /></button>
            </div>

            {announcements.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No announcements yet.</div>
            ) : (
              announcements.map((a, i) => (
                <div key={a.id} style={{ padding: '14px 16px', borderBottom: i < announcements.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.body}</div>
                </div>
              ))
            )}
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
    new_message: '💬',
    swap_proposed: '🤝',
    swap_accepted: '✅',
    swap_posted: '📬',
    new_match: '⚡',
    new_rating: '⭐',
    dispute_filed: '⚠️',
    announcement: '📢',
    founder_welcome: '🏆',
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={handleOpen}
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
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100,
          maxHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => {
                const isExpanded = expanded === n.id;
                return (
                  <div
                    key={n.id}
                    onClick={() => setExpanded(isExpanded ? null : n.id)}
                    style={{
                      padding: '12px 16px', borderBottom: '1px solid var(--border)',
                      background: n.is_read ? 'transparent' : 'var(--primary-light)',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      cursor: n.body ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
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
                  </div>
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
export default function PaniniSwapApp() {
  const [token, setToken] = useState(() => localStorage.getItem('authToken') || null);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [activeSwapId, setActiveSwapId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);
  const [pendingConversationUserId, setPendingConversationUserId] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [checkingSession, setCheckingSession] = useState(Boolean(localStorage.getItem('authToken')));
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [founderRedirectMsg, setFounderRedirectMsg] = useState(null);

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

  useEffect(() => {
    if (tab === 'messages') setUnreadMessages(0);
  }, [tab]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const themeCtx = { dark, toggle: () => setDark(d => !d) };

  if (window.location.pathname === '/verify-email') {
    return <VerifyEmailScreen />;
  }
  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordScreen />;
  }

  const handleAuthed = (newToken, newUser) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    setTab('dashboard');
  };

  useEffect(() => {
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api.me(token)
      .then((freshUser) => setUser(freshUser))
      .catch(() => {
        localStorage.removeItem('authToken');
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
    { id: 'dashboard', label: 'My Album', icon: 'ti-book' },
    { id: 'matches', label: 'Matches', icon: 'ti-stars' },
    { id: 'mySwaps', label: 'Swaps', icon: 'ti-arrows-exchange' },
    { id: 'history', label: 'History', icon: 'ti-clock' },
    { id: 'messages', label: 'Messages', icon: 'ti-message-circle' },
    { id: 'search', label: 'Search', icon: 'ti-search' },
  ];

  return (
    <ThemeContext.Provider value={themeCtx}>
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

      <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingTop: 'env(safe-area-inset-top)' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Logo size={28} />
              <span style={{ fontSize: 15, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>Got One Spare?</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <WhatsNewPanel />
              <NotificationPanel />
              <button
                onClick={() => setViewingProfileUserId(user.id)}
                title="Your profile"
                style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: user.founder_member ? 'linear-gradient(135deg, #D97706, #92400E)' : '#1AAB8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: user.founder_member ? '2px solid #FDE68A' : 'none', cursor: 'pointer' }}
              >
                {user.profile_photo ? (
                  <img src={user.profile_photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>
                    {(user.name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              <button
                onClick={logout}
                title="Sign out"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', opacity: 0.5 }}
              >
                <LogOut size={16} color="white" />
              </button>
            </div>
          </div>
        </header>

        <CommunityBanner />
        <ActivityTicker />

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
          />
        )}

        {viewingProfileUserId && (
          <UserProfileModal
            userId={viewingProfileUserId}
            onClose={() => setViewingProfileUserId(null)}
            onEditOwnProfile={() => { setViewingProfileUserId(null); setShowProfile(true); }}
          />
        )}

        {showFounderModal && <FounderModal onClose={() => setShowFounderModal(false)} />}

        <main style={{ maxWidth: 640, margin: '0 auto', padding: '14px 14px 90px' }}>
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

        {/* ── Bottom nav ─────────────────────────────────────────── */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0B1120', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', zIndex: 10, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div style={{ display: 'flex', width: '100%', maxWidth: 640 }}>
            {NAV_ITEMS.map((t) => {
              const active = tab === t.id || (tab === 'swap' && t.id === 'mySwaps');
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '10px 0 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderTop: active ? '2px solid #1AAB8A' : '2px solid transparent',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <i className={`ti ${t.icon}`} style={{ fontSize: 18, color: active ? '#1AAB8A' : 'rgba(255,255,255,0.35)' }} aria-hidden="true" />
                    {t.id === 'messages' && unreadMessages > 0 && (
                      <span style={{ position: 'absolute', top: -4, right: -6, background: '#EF4444', color: 'white', fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #0B1120', lineHeight: 1 }}>
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#1AAB8A' : 'rgba(255,255,255,0.35)', letterSpacing: '0.03em' }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <FutureCollectionsWidget />
        <FeedbackWidget />
        <InstallAndNotifyBanner />

        <div style={{ textAlign: 'center', padding: '4px 16px 4px', marginBottom: 4 }}>
          <button
            onClick={() => setShowFounderModal(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#92400E' }}
          >
            🏆 Support Got One Spare — Become a Founder
          </button>
        </div>
      </div>
    </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
