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
  getFutureCollections: (token) => request('/future-collections/me', { token }),
  voteFutureCollection: (token, key, selected) => request('/future-collections/vote', { method: 'POST', body: { key, selected }, token }),

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

  getMatches: (token) => request('/swaps/matches', { token }),
  getMySwaps: (token) => request('/swaps/mine', { token }),
  getSwapPreview: (token, matchId) => request(`/swaps/preview/${matchId}`, { token }),
  createSwap: (token, matchId) => request('/swaps', { method: 'POST', body: { matchId }, token }),
  getSwap: (token, swapId) => request(`/swaps/${swapId}`, { token }),
  acceptSwap: (token, swapId) => request(`/swaps/${swapId}/accept`, { method: 'POST', token }),
  declineSwap: (token, swapId, reason) => request(`/swaps/${swapId}/decline`, { method: 'POST', body: { reason }, token }),
  withdrawSwap: (token, swapId) => request(`/swaps/${swapId}/withdraw`, { method: 'POST', token }),
  markPosted: (token, swapId, photo) => request(`/swaps/${swapId}/posted`, { method: 'POST', body: { photo }, token }),
  markReceived: (token, swapId) => request(`/swaps/${swapId}/received`, { method: 'POST', token }),

  submitRating: (token, swapId, stars, comment) =>
    request('/ratings', { method: 'POST', body: { swapId, stars, comment }, token }),
  getUserRatings: (token, userId) => request(`/ratings/user/${userId}`, { token }),

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

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{ background: 'var(--danger-light)', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#991B1B' }}>{message}</span>
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
            <img src="data:image/png;base64,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" alt="Got One Spare?" style={{ width: 72, height: 72, objectFit: 'contain', display: 'block', margin: '0 auto 14px' }} />
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
// Official Panini World Cup 2026 album order — verified from the actual checklist.
// Teams appear in exactly the order they appear in the physical album.
// Official FIFA World Cup 2026 groups — verified from FIFA.com and live results.
// Teams are grouped by their actual FIFA group (A-L) so all 4 teams in each
// group appear together in the dropdown, matching the physical album.
const WC2026_GROUP_ORDER = [
  'FWC',
  // Group A
  'Mexico', 'South Africa', 'South Korea', 'Czechia',
  // Group B
  'Canada', 'Switzerland', 'Qatar', 'Bosnia and Herzegovina',
  // Group C
  'Brazil', 'Morocco', 'Haiti', 'Scotland',
  // Group D
  'USA', 'Paraguay', 'Australia', 'Turkiye',
  // Group E
  'Germany', 'Ivory Coast', 'Ecuador', 'Curacao',
  // Group F
  'Netherlands', 'Japan', 'Tunisia', 'Sweden',
  // Group G
  'Belgium', 'Egypt', 'Iran', 'New Zealand',
  // Group H
  'Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay',
  // Group I
  'France', 'Senegal', 'Norway', 'Iraq',
  // Group J
  'Argentina', 'Algeria', 'Austria', 'Jordan',
  // Group K
  'Portugal', 'Uzbekistan', 'Colombia', 'Congo DR',
  // Group L
  'England', 'Croatia', 'Ghana', 'Panama',
  // Special sets
  'Coca-Cola (North America)',
  'Coca-Cola (Europe)',
  'Coca-Cola (Latin America)',
];

// Aliases for any edge cases where name variations might exist
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
  const [pickerTab, setPickerTab] = useState('team'); // 'team' | 'search'
  const [teams, setTeams] = useState([]);
  const [teamSort, setTeamSort] = useState('group');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamStickers, setTeamStickers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSelected, setSearchSelected] = useState(null);
  const [searchQty, setSearchQty] = useState(1);

  // Basket: new stickers selected this session, NOT yet saved to the database
  // sticker_id → { sticker, quantity }
  const [basket, setBasket] = useState({});

  // Existing: stickers already in the user's list, loaded on mount
  // sticker_id → { sticker_id, quantity, sticker_number, description, team_name }
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

  // Search debounce
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

  // Add a single sticker from search directly (saves immediately)
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

  // Toggle a new sticker in/out of the basket (does NOT save)
  const toggleBasket = (sticker) => {
    if (existing[sticker.id]) return;
    setBasket(prev => {
      const next = { ...prev };
      if (next[sticker.id]) { delete next[sticker.id]; }
      else { next[sticker.id] = { sticker, quantity: 1 }; }
      return next;
    });
  };

  // Adjust quantity of a basket item (before saving)
  const setBasketQty = (id, val) => {
    const n = Math.max(1, Math.min(99, parseInt(val) || 1));
    setBasket(prev => ({ ...prev, [id]: { ...prev[id], quantity: n } }));
  };

  // Update/remove an ALREADY-EXISTING sticker — saves immediately
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

  // Save all basket items to the database
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
      // Move from basket into existing so they show greyed out
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

        {/* Tab switcher */}
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

        {/* Search tab */}
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
// Lets either party in a swap flag a problem. Picks from a fixed
// set of reasons (matches backend validation) plus optional details.
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
// USER RATINGS MODAL
// Shows a person's average rating, count, and recent written
// reviews — reachable by tapping their name on a match or swap.
// =================================================================
function UserRatingsModal({ userId, userName, onClose }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getUserRatings(token, userId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-lg p-6 max-h-[80vh] overflow-y-auto" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{userName}'s reviews</h3>
          <button onClick={onClose}><X size={18} color="var(--text-secondary)" /></button>
        </div>

        {loading && <Spinner />}
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {data && (
          <>
            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <StarRating value={data.rating_avg} size={18} />
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {data.rating_avg ? Number(data.rating_avg).toFixed(1) : 'No ratings yet'}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                ({data.rating_count} {data.rating_count === 1 ? 'review' : 'reviews'})
              </span>
            </div>

            {data.recentRatings.length === 0 ? (
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
  const [collections, setCollections] = useState([]);
  const [voted, setVoted] = useState(new Set());
  const [pending, setPending] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getFutureCollections(token).then(data => {
      setCollections(data.collections || []);
      const existing = new Set(data.voted || []);
      setVoted(existing);
      setPending(new Set(existing));
      if (existing.size > 0) setSubmitted(true);
      setLoaded(true);
    }).catch(() => { setLoaded(true); });
  }, [token]);

  const toggle = (key) => {
    setPending(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const submit = async () => {
    // Save all pending votes — add new ones, remove deselected ones
    const toAdd = [...pending].filter(k => !voted.has(k));
    const toRemove = [...voted].filter(k => !pending.has(k));
    await Promise.all([
      ...toAdd.map(k => api.voteFutureCollection(token, k, true)),
      ...toRemove.map(k => api.voteFutureCollection(token, k, false)),
    ]).catch(() => {});
    setVoted(new Set(pending));
    setSubmitted(true);
    setTimeout(() => setOpen(false), 800);
  };

  if (!loaded) return null;

  const hasChanges = [...pending].some(k => !voted.has(k)) || [...voted].some(k => !pending.has(k));

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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Which collections next? Select all that apply.</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}><X size={14} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {collections.map(c => {
              const checked = pending.has(c.key);
              return (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, border: '1px solid ' + (checked ? '#1AAB8A' : 'var(--border)'), background: checked ? 'rgba(26,171,138,0.08)' : 'var(--bg)', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(c.key)} style={{ width: 14, height: 14, accentColor: '#1AAB8A', flexShrink: 0, cursor: 'pointer' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{c.emoji} {c.label}</span>
                </label>
              );
            })}
          </div>

          <button
            onClick={submit}
            disabled={pending.size === 0}
            style={{ width: '100%', padding: '9px 0', background: pending.size === 0 ? 'var(--border)' : '#1AAB8A', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: pending.size === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {submitted && !hasChanges ? '✓ Saved — update selections' : `Submit${pending.size > 0 ? ` (${pending.size} selected)` : ''}`}
          </button>

          <button onClick={() => setOpen(false)} style={{ width: '100%', textAlign: 'center', fontSize: 11, marginTop: 8, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Minimise
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: open ? 'var(--navy)' : '#1AAB8A',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', border: 'none', cursor: 'pointer',
          transition: 'background 0.15s', fontSize: 18,
        }}
        title="Shape our future"
      >
        🚀
      </button>
    </div>
  );
}

function DashboardScreen() {
  const { token } = useAuth();
  const [duplicates, setDuplicates] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState(null); // 'duplicate' | 'need' | null
  const [duplicatesOpen, setDuplicatesOpen] = useState(true);
  const [needsOpen, setNeedsOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dups, needsList] = await Promise.all([api.getMyDuplicates(token), api.getMyNeeds(token)]);
      // Sort by group order then numerically within team — same order as the physical album
      const byGroupOrder = (a, b) => {
        const ai = WC2026_GROUP_ORDER.indexOf(normaliseTeamName(a.team_name));
        const bi = WC2026_GROUP_ORDER.indexOf(normaliseTeamName(b.team_name));
        if (ai !== bi) {
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }
        // Within same team, sort numerically
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
    setDuplicates((d) => d.filter((x) => x.sticker_id !== stickerId)); // optimistic
    try {
      await api.removeDuplicate(token, stickerId);
    } catch (err) {
      setError(err.message);
      load(); // revert by reloading on failure
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
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* ── Stats ticker — one line, left-anchored, not a card ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 14, borderBottom: '2px solid #0B1120', paddingBottom: 10 }}>
        {[
          [980 - totalNeeds, 'collected'],
          [totalSpares, 'spares'],
          [totalNeeds, 'needed'],
          [completionPct + '%', 'complete'],
        ].map(([v, l], i) => (
          <div key={l} style={{ flex: 1, borderRight: i < 3 ? '1px solid #e0e0e0' : 'none', padding: '0 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0B1120', lineHeight: 1 }}>{v}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{l}</div>
          </div>
        ))}
        <div style={{ flex: 1, padding: '0 0 0 12px' }}>
          <div style={{ height: 3, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: completionPct + '%', background: '#1AAB8A', transition: 'width 0.5s' }} />
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>Progress</div>
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

      {duplicates.length + needs.length > 0 && (
        <div style={{ marginTop: 20 }}><DonateButton location="dashboard" variant="full" /></div>
      )}

      {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={() => {
        // Silent refresh — don't set loading state which would cause
        // the modal to flicker or close on Android due to re-render
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
// =================================================================
// SWAP PREVIEW MODAL
// Shows the sticker list for a match WITHOUT creating a swap.
// User can then choose to propose or go back.
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>with {match.other_user_name}</div>
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
                    <div key={s.sticker_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', fontFamily: 'monospace', minWidth: 50 }}>{s.sticker_number}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.description}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.team_name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>You receive ({youGet.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {youGet.map(s => (
                    <div key={s.sticker_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#F0FDF9', borderRadius: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', minWidth: 50 }}>{s.sticker_number}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{s.description}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{s.team_name}</span>
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
  const { token } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewingMatch, setPreviewingMatch] = useState(null);
  const [viewingRatingsFor, setViewingRatingsFor] = useState(null);

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
            const score = Math.min(100, Math.round((swapCount / 10) * 100));
            const initials = m.other_user_name.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase();
            return (
              <div key={m.id} style={{ background: 'white', border: '1px solid #e8e8e4', borderLeft: '3px solid #1AAB8A', borderRadius: 4, overflow: 'hidden' }}>
                {/* Header row — user + score */}
                <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0ec' }}>
                  <button
                    onClick={() => setViewingRatingsFor({ id: m.other_user_id, name: m.other_user_name })}
                    style={{ width: 36, height: 36, borderRadius: 4, background: '#0B1120', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}
                  >{initials}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => setViewingRatingsFor({ id: m.other_user_id, name: m.other_user_name })} style={{ textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0, width: '100%' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#0B1120', letterSpacing: '-0.1px' }}>{m.other_user_name}</div>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <StarRating value={m.rating_avg} size={11} />
                      <span style={{ fontSize: 10, color: '#bbb', fontFamily: 'monospace' }}>({m.rating_count})</span>
                    </div>
                  </div>
                  {/* Match score */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#1AAB8A', lineHeight: 1, fontFamily: 'monospace' }}>{swapCount}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>each way</div>
                  </div>
                </div>
                {/* Swap breakdown bar */}
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

      {viewingRatingsFor && (
        <UserRatingsModal
          userId={viewingRatingsFor.id}
          userName={viewingRatingsFor.name}
          onClose={() => setViewingRatingsFor(null)}
        />
      )}
    </div>
  );
}

// =================================================================
// MY SWAPS SCREEN
// History of every swap the user is part of, any status — lets
// someone revisit a past or completed swap once it's no longer a
// pending match.
// =================================================================
const SWAP_STATUS_LABELS = {
  proposed: 'Awaiting acceptance',
  accepted: 'Ready to post',
  posted: 'Posted',
  completed: 'Completed',
  declined: 'Declined',
  disputed: 'Disputed',
};

// Returns a context-aware label based on the current user's specific state
// within the swap, rather than just the raw status. Fixes the confusing
// "Ready to post" label after a user has already posted their side.
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
  const { token, user } = useAuth();
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

  return (
    <div>
      <SectionHeader eyebrow="History" title="My swaps" />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {swaps.length === 0 ? (
        <EmptyState text="No swaps yet — propose one from your matches." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {swaps.map((s) => {
            const label = getSwapLabel(s, user?.id);
            const colors = SWAP_STATUS_COLORS[label] || SWAP_STATUS_COLORS[s.status] || SWAP_STATUS_COLORS.proposed;
            const isActionNeeded = label.includes('your turn') || label.includes('You need');
            const borderAccent = isActionNeeded ? '#f59e0b' : label.includes('Waiting') || label.includes('Completed') ? '#1AAB8A' : '#0B1120';
            return (
              <button
                key={s.id}
                onClick={() => onOpenSwap(s.id)}
                style={{ width: '100%', background: 'white', border: '1px solid #e8e8e4', borderLeft: '3px solid ' + borderAccent, borderRadius: 4, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 4, background: '#0B1120', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, flexShrink: 0, fontFamily: 'monospace' }}>
                    {s.other_user_name.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: '#0B1120', letterSpacing: '-0.1px' }}>{s.other_user_name}</div>
                    <div style={{ fontSize: 10, color: '#bbb', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, fontFamily: 'monospace' }}>
                      <span>#{s.id}</span>
                    {(s.display_give_count > 0 || s.display_get_count > 0) && (
                        <>
                          <span>·</span>
                          <span style={{ color: '#0B1120', fontWeight: 700 }}>{s.display_give_count}↔{s.display_get_count}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 3, background: colors.bg, color: colors.text, flexShrink: 0, letterSpacing: '0.02em' }}>
                  {label}
                </span>
              </button>
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
function SwapDetailScreen({ swapId, onRated, onBack }) {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true); // only true on first load
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [postagePhoto, setPostagePhoto] = useState(null);
  const [postagePhotoPreview, setPostagePhotoPreview] = useState(null);
  const [actionConfirm, setActionConfirm] = useState(null); // brief success message
  const [disputeFiled, setDisputeFiled] = useState(false);
  const [showOtherRatings, setShowOtherRatings] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef(null);
  const shouldScrollChat = useRef(false); // only scroll when user sends a message

  // Initial load — shows spinner only this once
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

  // Background poll — silently updates data, NEVER sets any loading state
  // or triggers a re-render that resets scroll position.
  useEffect(() => {
    if (!data || ['completed', 'declined', 'disputed'].includes(data.swap.status)) {
      return;
    }
    const interval = setInterval(() => {
      api.getSwap(token, swapId).then(setData).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.swap?.status, token, swapId]);

  // Message poll — load on mount, then every 10 seconds silently
  useEffect(() => {
    const loadMessages = () =>
      api.getMessages(token, swapId).then(setMessages).catch(() => {});
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [token, swapId]);

  // Only scroll chat panel when the user sends a message themselves —
  // NEVER on polling updates, which was causing the whole page to jump.
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
    shouldScrollChat.current = true; // flag that THIS update should scroll
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

  const { swap, items, otherUserAddress } = data;
  const isUserA = swap.user_a_id === user.id;
  const youGive = items.filter((i) => i.from_user_id === user.id);
  const youReceive = items.filter((i) => i.to_user_id === user.id);
  const otherName = otherUserAddress?.name || (isUserA ? `User #${swap.user_b_id}` : `User #${swap.user_a_id}`);
  const otherUserId = isUserA ? swap.user_b_id : swap.user_a_id;

  const steps = ['proposed', 'accepted', 'posted', 'completed'];
  const currentStep = steps.indexOf(swap.status === 'declined' ? 'proposed' : swap.status);

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
        // Swap was auto-declined — refresh to show the declined state cleanly
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

      {/* Action confirmation banner */}
      {actionConfirm && (
        <div style={{ background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#065F46' }}>
          <span style={{ fontSize: 18 }}>✓</span>
          {actionConfirm}
        </div>
      )}

      {/* Back button */}
      {onBack && (
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ← Back to My Swaps
        </button>
      )}

      {/* Declined banner */}
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
              // Translate internal/technical reasons into friendly messages
              const friendlyReason = reason === 'Withdrawn by proposer'
                ? `${otherName} withdrew the swap proposal before it was accepted.`
                : reason.startsWith('Automatically declined')
                  ? 'This swap was automatically cancelled by the system because sticker availability changed. A fresh match will appear in your Matches tab shortly.'
                  : `"${reason}"`;
              const isInternal = reason === 'Withdrawn by proposer' || reason.startsWith('Automatically declined');
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

      {/* Decline reason modal */}
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
            with {otherName}
          </h2>
          <button onClick={() => setShowOtherRatings(true)} className="text-xs font-semibold underline" style={{ color: 'var(--primary-dark)' }}>
            View their ratings
          </button>
        </div>
      </div>

      {swap.status !== 'declined' && (
        <div className="flex items-center">
          {['Proposed', 'Accepted', 'Posted', 'Done'].map((label, i) => {
            // When status is 'accepted' but the current user has already posted,
            // show the Posted step as "in progress" rather than future
            const myPosted = isUserA ? swap.user_a_posted : swap.user_b_posted;
            const effectiveStep = swap.status === 'accepted' && myPosted && i === 2 ? 'current' : null;
            const isPast = i < currentStep;
            const isCurrent = i === currentStep;
            const isEffectiveCurrent = effectiveStep === 'current';
            const stepLabel = (isCurrent && swap.status === 'accepted' && myPosted) ? 'Waiting' : label;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{
                    background: isPast || isEffectiveCurrent ? 'var(--primary-dark)' : isCurrent ? 'var(--primary-dark)' : 'var(--bg)',
                    color: isPast || isCurrent || isEffectiveCurrent ? 'var(--surface)' : 'var(--text-muted)',
                    opacity: isEffectiveCurrent ? 0.6 : 1,
                  }}>
                    {isPast ? <CheckCircle2 size={15} /> : (isCurrent || isEffectiveCurrent) ? <Clock size={14} /> : i + 1}
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: isPast || isCurrent || isEffectiveCurrent ? 'var(--primary-dark)' : 'var(--text-muted)' }}>
                    {stepLabel}
                  </span>
                </div>
                {i < 3 && <div className="flex-1 h-0.5 mb-4" style={{ background: isPast ? 'var(--primary-dark)' : 'var(--border)' }} />}
              </React.Fragment>
            );
          })}
        </div>
      )}

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
                {youGive.map((s) => <StickerCard key={s.sticker_id} sticker={s} qtyOverride={1} />)}
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
                {youReceive.map((s) => <StickerCard key={s.sticker_id} sticker={s} qtyOverride={1} />)}
              </div>
            </div>
          </>
        )}
      </div>

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
              ⏳ {otherName} has accepted — it's your turn to accept or decline
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

      {swap.status === 'accepted' && otherUserAddress?.address_line1 && otherUserAddress?.city && (
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

          {/* Optional postage proof photo */}
          <div style={{ marginTop: 12 }}>
            {postagePhotoPreview ? (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <img src={postagePhotoPreview} alt="Postage proof" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
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
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      // Resize client-side before storing
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
        </div>
      )}

      {/* Donate prompt shown once both sides have accepted — the best moment */}
      {swap.status === 'accepted' && swap.user_a_accepted && swap.user_b_accepted && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>🎉 Swap confirmed!</div>
          <p style={{ fontSize: 13, color: '#78350F', margin: '0 0 12px', lineHeight: 1.5 }}>
            You've been matched with {otherName}. This site is completely free — if it's helped you complete your album, you can support hosting and future development with a small donation.
          </p>
          <DonateButton location="swap_confirmed" variant="compact" />
        </div>
      )}

      {swap.status === 'accepted' && !(otherUserAddress?.address_line1 && otherUserAddress?.city) && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FBF1D9', border: '1px solid #E8D9A8', color: '#5C4711' }}>
          Waiting for {otherName} to add their address before you can post. This page will update automatically.
        </div>
      )}

      {(swap.status === 'accepted' || swap.status === 'posted') && (isUserA ? swap.user_a_posted : swap.user_b_posted) && !(isUserA ? swap.user_a_received : swap.user_b_received) && (
        <button onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api.markReceived(token, swap.id);
            const fresh = await api.getSwap(token, swapId);
            setData(fresh);
            // Show rating prompt immediately — don't wait for the other side
            setShowRating(true);
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }} disabled={busy} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--warning)', color: 'var(--text-primary)' }}>
          {busy && <Loader2 className="animate-spin" size={14} />} Mark stickers as received
        </button>
      )}

      {/* Standalone proof of postage upload — shown after you've posted but haven't added proof yet */}
      {swap.status === 'accepted' && (isUserA ? swap.user_a_posted : swap.user_b_posted) && !swap.postage_photo && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>📷 Add proof of postage (optional)</div>
          {postagePhotoPreview ? (
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <img src={postagePhotoPreview} alt="Postage proof" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
              <button onClick={() => { setPostagePhoto(null); setPostagePhotoPreview(null); }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <button onClick={() => act(() => api.markPosted(token, swap.id, postagePhoto), '✓ Proof of postage uploaded!')} disabled={busy} style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Upload proof
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => {
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

      {/* Show postage proof photo if one was uploaded — visible to both parties */}
      {swap.postage_photo && (swap.status === 'accepted' || swap.status === 'posted' || swap.status === 'completed') && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📷 Proof of postage
          </div>
          <img
            src={swap.postage_photo}
            alt="Proof of postage"
            style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            Uploaded by {isUserA ? (swap.user_b_posted ? otherName : 'you') : (swap.user_a_posted ? otherName : 'you')}
          </div>
        </div>
      )}

      {swap.status === 'disputed' && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FBEAEA', border: '1px solid #E8B4B4', color: '#9A1F1F' }}>
          This swap has been flagged for review. {disputeFiled ? "We've notified the other person." : 'Check back for updates.'}
        </div>
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

      {showOtherRatings && (
        <UserRatingsModal
          userId={otherUserId}
          userName={otherName}
          onClose={() => setShowOtherRatings(false)}
        />
      )}

      {/* ---- Chat panel ---- */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowChat((c) => !c)}
          style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircle size={16} color="var(--primary)" />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              Chat with {otherName}
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
                        {isMe ? 'You' : m.sender_name} · {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
// VERIFY EMAIL SCREEN
// Reached via the link in the verification email:
// /verify-email?token=...
// Standalone — doesn't require an existing session, since the user
// may click this from their email client without being logged in.
// =================================================================
// =================================================================
// MESSAGES SCREEN
// Threaded conversations between users.
// =================================================================
function MessagesScreen() {
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null); // { conversationId, otherUser }
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
      const { messages: msgs } = await api.getConversationMessages(token, convId);
      setMessages(msgs);
      loadConversations(); // refresh unread counts
    } catch (err) { setError(err.message); }
  };

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
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{activeConv.otherUser?.name}</div>
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
                  <span>{new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
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
        <div key={c.conversation_id} onClick={() => openConversation(c.conversation_id, { id: c.other_user_id, name: c.other_user_name })}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0, position: 'relative' }}>
            {c.other_user_name?.split(' ').map(p => p[0]).join('')}
            {c.unread_count > 0 && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread_count}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: c.unread_count > 0 ? 700 : 600, fontSize: 14, color: 'var(--text-primary)' }}>{c.other_user_name}</div>
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
                {u.name} {u.city && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {u.city}</span>}
              </button>
            ))}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>To: {selected.name}</span>
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
  const { token, user } = useAuth();
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: isCompleted ? 'var(--primary-light)' : 'var(--bg)', color: isCompleted ? 'var(--primary-dark)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {s.other_user_name?.split(' ').map(p => p[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{s.other_user_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {isCompleted && s.you_gave_count > 0 && ` · gave ${s.you_gave_count}, got ${s.you_got_count}`}
                      </div>
                    </div>
                  </div>
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
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewingBadgesFor, setViewingBadgesFor] = useState(null);

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
        <div key={u.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
              {u.name?.split(' ').map(p => p[0]).join('')}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{u.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {u.city && <span>{u.city}</span>}
                {u.completed_swaps > 0 && <span>· {u.completed_swaps} swaps</span>}
                {u.response_rate && <span>· {u.response_rate}% response rate</span>}
                {u.swap_streak >= 3 && <span>· 🔥 {u.swap_streak} streak</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => setViewingBadgesFor({ id: u.id, name: u.name })}
            style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View
          </button>
        </div>
      ))}
      {viewingBadgesFor && (
        <UserRatingsModal
          userId={viewingBadgesFor.id}
          userName={viewingBadgesFor.name}
          onClose={() => setViewingBadgesFor(null)}
        />
      )}
    </div>
  );
}

// =================================================================
// VERIFY EMAIL SCREEN
// =================================================================
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
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
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
// Where a user sets their name and postal address. Address fields
// are only ever revealed to the other party in a swap once both
// sides have accepted — see SwapDetailScreen / backend getSwap.
// =================================================================
// =================================================================
// Resizes/compresses an image file client-side before upload, so a
// multi-megabyte phone photo doesn't get sent as-is. Returns a JPEG
// data URL capped at maxDimension on its longest side.
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
  }, [token, user?.id]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoProcessing, setPhotoProcessing] = useState(false);

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
// VERIFICATION BANNER
// Shown below the header whenever the logged-in user's email isn't
// verified yet. Lets them trigger a fresh verification email.
// =================================================================
// =================================================================
// NOTIFICATION PANEL
// Bell icon in the header; clicking it opens a dropdown panel
// showing recent notifications. Polls every 30 seconds for new ones.
// =================================================================
// =================================================================
// DONATE BUTTON
// Reusable across three locations: swap confirmed, dashboard, footer.
// Logs the click location before opening the Stripe payment link.
// =================================================================
const DONATE_URL = import.meta.env.VITE_STRIPE_DONATE_URL || '#';

function DonateButton({ location, variant = 'full' }) {
  const { token } = useAuth();

  const handleClick = async () => {
    await api.logDonationClick(token, location);
    window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
  };

  const buttonStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 20px', borderRadius: 24,
    background: 'var(--primary)', color: 'white',
    fontSize: 14, fontWeight: 700, lineHeight: 1.4,
    cursor: 'pointer', border: 'none', textAlign: 'left',
    boxShadow: '0 2px 8px rgba(26,171,138,0.35)',
    transition: 'background 0.15s, box-shadow 0.15s',
  };

  if (variant === 'link') {
    return (
      <button
        onClick={handleClick}
        style={{ ...buttonStyle, fontSize: 13, padding: '10px 16px' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#16956F'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(26,171,138,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,171,138,0.35)'; }}
      >
        ☕ Buy me a coffee? If this site helped you find a swap, you can support its running costs with a small donation.
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        style={buttonStyle}
        onMouseEnter={e => { e.currentTarget.style.background = '#16956F'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(26,171,138,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,171,138,0.35)'; }}
      >
        ☕ Buy me a coffee? If this site helped you find a swap, you can support its running costs with a small donation.
      </button>
    );
  }

  // Full variant — used on dashboard
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px 18px' }}>
      <button
        onClick={handleClick}
        style={{ ...buttonStyle, width: '100%', justifyContent: 'center' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#16956F'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(26,171,138,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(26,171,138,0.35)'; }}
      >
        ☕ Buy me a coffee? If this site helped you find a swap, you can support its running costs with a small donation.
      </button>
    </div>
  );
}

// =================================================================
// FEEDBACK WIDGET
// Floating button fixed to the bottom-right on every logged-in page.
// Opens a small panel for submitting feedback directly to the admin.
// =================================================================
function FeedbackWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

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
// Shows announcements/changelog. Icon in header with unread dot.
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
  const [expanded, setExpanded] = useState(null); // id of expanded notification
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getNotifications(token);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silently ignore notification fetch failures
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Close panel when clicking outside
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [checkingSession, setCheckingSession] = useState(Boolean(localStorage.getItem('authToken')));
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (!token) return;
    const load = () => api.getUnreadMessageCount(token).then(setUnreadMessages).catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (tab === 'messages') setUnreadMessages(0);
  }, [tab]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const themeCtx = { dark, toggle: () => setDark(d => !d) };

  // Check for the verify-email route before anything else — this
  // page must work even for a logged-out visitor clicking an email link.
  // Placed after hook declarations so hook call order stays consistent
  // across renders (Rules of Hooks).
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

  // On first load, if a token was saved from a previous session,
  // validate it against the server and refresh the user object.
  // This also catches accounts suspended/deactivated since the
  // token was issued — /api/auth/me now rejects those with a 403,
  // which we treat the same as an expired session: log out cleanly.
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
    // Only run this on mount — token changes from login/logout are
    // already handled directly by handleAuthed/logout above.
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

  const tabs = [
    { id: 'dashboard', label: 'My album' },
    { id: 'matches', label: 'Matches' },
    { id: 'mySwaps', label: 'My swaps' },
    { id: 'history', label: 'History' },
    { id: 'messages', label: 'Messages' },
    { id: 'search', label: 'Search' },
  ];

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
    <AuthContext.Provider value={{ token, user }}>
      <style>{DESIGN_TOKENS}</style>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.34.0/dist/tabler-icons.min.css" />

      <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0B1120', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="data:image/png;base64,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" alt="Got One Spare?" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: 'white', letterSpacing: '-0.3px' }}>Got One Spare?</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <WhatsNewPanel />
              <NotificationPanel />
              <button
                onClick={() => setShowProfile(true)}
                title="Your profile"
                style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#1AAB8A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' }}
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

        {/* Status line — mobile only */}

        <main style={{ maxWidth: 640, margin: '0 auto', padding: '14px 14px 90px' }}>
          {tab === 'dashboard' && <DashboardScreen />}
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
          {tab === 'messages' && <MessagesScreen />}
          {tab === 'search' && <UserSearchScreen />}
          {tab === 'swap' && activeSwapId && (
            <SwapDetailScreen
              swapId={activeSwapId}
              onRated={() => setTab('dashboard')}
              onBack={() => setTab('mySwaps')}
            />
          )}
          {tab === 'swap' && !activeSwapId && (
            <EmptyState text="No active swap selected. Pick one from your matches." />
          )}
        </main>

        {/* ── Bottom nav ─────────────────────────────────────────── */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0B1120', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
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

        <div style={{ textAlign: 'center', padding: '4px 16px 4px', marginBottom: 4 }}>
          <DonateButton location="footer" variant="link" />
        </div>
      </div>
    </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
