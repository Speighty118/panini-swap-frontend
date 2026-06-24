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
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
  :root {
    --primary: #1AAB8A;
    --primary-light: #C8F0E5;
    --primary-dark: #0E7A63;
    --blue: #5B9BD5;
    --blue-light: #D6E8F7;
    --navy: #1A1F36;
    --bg: #F5F6FA;
    --surface: #FFFFFF;
    --border: rgba(0,0,0,0.08);
    --text-primary: #1A1F36;
    --text-secondary: #6B7280;
    --text-muted: #9CA3AF;
    --danger: #EF4444;
    --danger-light: #FEE2E2;
    --warning: #F59E0B;
    --warning-light: #FEF3C7;
    --success: #10B981;
    --success-light: #D1FAE5;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
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
  body { background: var(--bg); color: var(--text-primary); font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  * { box-sizing: border-box; }
  button { cursor: pointer; border: none; background: none; padding: 0; font: inherit; }
  input, textarea, select { font: inherit; }
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
  const bgColor = isDuplicate ? 'var(--blue-light)' : 'var(--primary-light)';
  const badgeColor = isDuplicate ? 'var(--blue)' : 'var(--primary)';

  return (
    <div
      className="relative group"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: onRemove ? 'default' : 'pointer',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{ background: bgColor, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isDuplicate ? (
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ opacity: 0.35 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={i} x1={i * 12 - 20} y1={0} x2={i * 12 + 40} y2={60} stroke={badgeColor} strokeWidth="6" />
              ))}
            </svg>
          ) : (
            <Plus size={20} color={badgeColor} style={{ opacity: 0.5 }} />
          )}
        </div>
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: badgeColor, color: 'white',
          fontSize: 11, fontWeight: 600, padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
        }}>
          {sticker.sticker_number}
        </div>

        {/* Top-right: remove button */}
        {onRemove && (
          <button
            onClick={onRemove}
            style={{
              position: 'absolute', top: 8, right: 8,
              background: 'var(--danger)', color: 'white',
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <X size={11} />
          </button>
        )}

        {/* Quantity controls — shown on duplicate cards when onUpdateQty is provided */}
        {onUpdateQty && qty !== undefined && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            display: 'flex', alignItems: 'center', gap: 3,
            background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '2px 4px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); if (qty <= 1) onRemove?.(); else onUpdateQty(qty - 1); }}
              style={{ width: 18, height: 18, borderRadius: '50%', background: qty <= 1 ? 'var(--danger)' : 'var(--border)', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: qty <= 1 ? 'white' : 'var(--text-primary)', fontWeight: 700, lineHeight: 1 }}
            >
              {qty <= 1 ? <X size={9} /> : '−'}
            </button>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', minWidth: 14, textAlign: 'center' }}>{qty}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onUpdateQty(qty + 1); }}
              style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, lineHeight: 1 }}
            >
              +
            </button>
          </div>
        )}

        {/* Quantity badge — shown when no controls (e.g. swap detail view) */}
        {!onUpdateQty && qty > 1 && (
          <div style={{
            position: 'absolute', top: 8, right: onRemove ? 30 : 8,
            background: 'var(--navy)', color: 'white',
            fontSize: 11, fontWeight: 700, padding: '2px 7px',
            borderRadius: 'var(--radius-full)',
          }}>
            ×{qty}
          </div>
        )}
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              position: 'absolute', inset: 0, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="white" />
            </div>
          </button>
        )}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sticker.description}>
          {sticker.description?.split(' - ')[0] || sticker.description}
        </div>
      </div>
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'inline' }}>{title}</h2>
        {eyebrow && <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>{eyebrow}</span>}
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

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'var(--bg)',
    fontSize: 14, color: 'var(--text-primary)', outline: 'none',
  };

  // Forgot password form
  if (mode === 'forgot' || mode === 'forgot_sent') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 380, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {mode === 'forgot_sent' ? (
            <>
              <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>📬</div>
              <h2 style={{ fontWeight: 700, fontSize: 20, textAlign: 'center', marginBottom: 8 }}>Check your email</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 20 }}>
                If an account exists for {email}, we've sent a password reset link. Check your inbox and spam folder.
              </p>
              <button onClick={() => setMode('login')} style={{ width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                Back to log in
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Forgot password?</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Enter your email and we'll send you a reset link.</p>
              <ErrorBanner message={error} onDismiss={() => setError(null)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
                <button
                  onClick={async () => {
                    if (!email.trim()) { setError('Please enter your email address'); return; }
                    setLoading(true);
                    setError(null);
                    try {
                      await api.forgotPassword(email.trim());
                      setMode('forgot_sent');
                    } catch (err) {
                      setError(err.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  style={{ width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  {loading && <Loader2 className="animate-spin" size={14} />}
                  Send reset link
                </button>
                <button onClick={() => setMode('login')} style={{ fontSize: 13, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  ← Back to log in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

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
    <div style={{ minHeight: '100vh', background: 'var(--bg)', overflowY: 'auto' }}>
      <style>{DESIGN_TOKENS}</style>

      {/* Header */}
      <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
        <Logo size={40} />
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Got One Spare?</span>
      </div>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '32px 24px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', lineHeight: 1.2 }}>
          Swap stickers with<br />collectors near you
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
          List your spares, tell us what you need, and we'll match you with the perfect swap partner.
        </p>
      </div>

      {/* How it works */}
      <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
        <img
          src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGiEcFxgfGRQUHScdHyIjJSUlFhwpLCgkKyEkJST/2wBDAQYGBgkICREJCREkGBQYJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCT/wAARCAIVAyADASIAAhEBAxEB/8QAHAAAAAcBAQAAAAAAAAAAAAAAAAECAwQFBgcI/8QAXxAAAQMDAgIGBAYNCQUFBQcFAQIDBAAFEQYhEjEHEyJBUWEUcYGRIzJCUqGxCBUWFzNicpOUwdHS0yRDU1VzgpKisjRFVmPCJTVGg7M2dISVoyYnRFR1w+HwZoXi8f/EABsBAAMBAQEBAQAAAAAAAAAAAAABAgMEBQYH/8QANxEAAgIBAwIDBgUCBwEBAQAAAAECEQMEEiExQRNRYQUicbHR8BQygZGhweEGFSNCQ1LxkjNT/9oADAMBAAIRAxEAPwDyqKFAUKABQoUVAB0fdRUfdQAVA0KBoAFChQFAANGKBoAUCDSKUBQSKWBSEGmlpG9EkUtI3oEGBSgKAFLAoEGlNOJFJSKdQNqQgwmnEpokppwCgQbaadxRNjanMUiWKaTTqE0TSacQmkSL4eVPNppHDT7aalksUhPap9KdqbQntU+E7VDIYpA3p5Kd6bQN6fSN6lkMcQmn200hCdqfbTtUshi0p5U8hNISmnkpqGQxaRyp9IpoJp9KalkMNIpwCiSmlhNIlhpFHigkUrFIQO6jAo8bUYFAhPfR42o8b0eNqAEYoYpWKLFABYoYpQFDFAhOKMilYoFNACAN6BFLA3oiKACxtSQN6cxtRY3pAJIosUspouHagQgjeiIpZTvQUmkA1jY0k05w7USk0ANKppYp8pppaaBojrFMKFSnE0wpO9UUiK4KYWnapTiaZUnaqRaIS09qmHE1LWntUw4mrRaIyk7UypOTUkp2ppSapGiI6k0wU1LUnamCmqRaIyk00tNSSmm1iqKRFUmmXE7VKUmmXRtVItEZQ2ppSakKG1NKG9UUhhSaQRTyhtSCKZQyRSCN6dIpJFAxoiiIpZFERimMbAoiKWKSaBiSKRjc04qkUxjaqBG1GqiPxRQMR30R50ffRHnTKBRUfdRUxgoChQoAFA0KBoAAoUBQoAFChQoAFH3UXfRnlQAQod9AUffQAKAod1GKBAIowKFKApCDQKWBRJFLAoEKSmlJG9AClpG9AgwKWE0EinEppCAlNOITQSmnkJ2oEElNOBFKSinEopCCbTTvDSm0U4EcqRLCbTTqEUppunUIzQIIJ5U82negEcqeQipZLAhO9PBO1EhG9PBORUkMCEb08hG9EhG9PpRvUshiko2qQ2nakoRtUhpG1QyGBKKeQijS3T7beazZk2ICOVPhFGlvlTwbqWyGxCUUoJp1LeeVJ4kJO60D1qFTZNhJTvR8NGFtf0iP8QodY3/So/xCgVh42oAUOsax+Fb/AMQoB5r+kR/iFAWHw70OHah1rX9Ij/EKMOtY/CI/xCgLE8NDhow41/SI/wAQo+saP84j/EKAsIJoBNH1rX9Kj/EKHWtD+db/AMQoCwcNApo+ta/pEf4hR9Y1/SI/xCgLEBNAppQca/pEf4hQ6xr+kR/iFAWFw7UQTvTnWNY/CI/xCiC28/hEf4hSFYkpouGnCtvP4RH+IUXG3j8Ij/EKQrG+HeiKacKm8/hG/wDEKBU3/SI/xCgVjXBRFFPJKCPwiP8AEKHBnlRY7I5RTS0VMKKbW3RYWQlophSN6nrbphTdNMtMgOIplSNhU9xumVN7VaZaZWrb3plaKnqa3plbRq0zREAo2ppSKnFqmlN1SZaIRb2NMKbqwU1saYU1VJlpkBTdNrbqaWqacbqkykQVN0w63tVgpumHW9qpMtMgKRTKkb1OU3TC0bmmWiItNNlNSVo2ppSdqoZHKaQRT6k02oUyhoikkU4RSSKBjeKSRTmOdJIpjGiKTjnThpHjQMbUKJXxRRqolfFFMBA50k86V30k86ZSB3UVH3UVMoBoUDQoAFA0KFAAFCgKFAAoUKFAA76PuoqPuoAAod9ACjI3pCDxtQFGBtRpFAgEcqUBR8NKAoEGgUsCggUsJoEGkUtCd6NKacQjekICU706lNBCN6eSigAko2p5CNqNLe1Pob2pCEpRmnUt0tDdPJaoJYhCKdDfKnG2qeDXKkJjTaKcQinm2qWhqgkQEcqdQmnA1sKdbb3qRDaUb08EbUYbOaeS3tSJY2hPaqQlO9BDZ4qfDZqGQxTaezUhpNJbQeGn20VDMpCkpp9CaSE06gVmzKQpI5VJjRXpb7cdhIU4vOMqCQABkkk7AAAkk7AAmmB3Vnukq+uWTSrcGOsok3pa0OLHNMVsjiT6luEA+TZHI1MY7pJEwhvlRH1F0q26zuKiadix7m+jsruMxsqZz/yWduIfjuZz3JFZU9MGuAfg7840nuQ1HZQkeoBGBWNJJ7zRV6McUY9j0Y44x6I2f349ef8AEkn801+5Q+/Jr0f+JJP5pr9ys1b7FdLrDuE2DAkSI1uaD8t5tOUsIKgkFR9Z5c+Z5A1vOhjoXm9LMyer0oQ7dBSEuPc1KdWDwJT6sFR8h50NRXNGlLyKg9Mmvv8AiST+aa/coffk19jH3SyfzTX7lZe8WmZYrpLtc9osy4jqmXUHuUD9VQ6pQi+wUjZ/fk16P/Ekn801+5R/fl17j/2kk/mmv3KTH6LLy/0ZyekMyoLVqZkejBlalde6rjSjsjhxjKvH5Jpx7olvjPRtA18qTCVAuEkRI0RBWqS4srUgAJ4cc0KOM5wKNkfIrZ6Cfvy69/4kk/mmv3KL78mvf+JJP5pr9ytzB+xJ15LtiH3Jtii3BbPXptb0lXpHD4HCSkHO3PAO2axb/RBqGL0fzdbyVxGIkGcbe/DWVekodDgbI4cY2UfHuo2x8g2eg39+XX3/ABJJ/NNfuUB0za+H/iST+Za/cqy1F0Dau0zP0pbpghqnaoVwRo7a1FTC+xlLuU7YCwTjOMHwqh1L0eXPTOvDolcqHOufXsxuKKpRb6xzhwnJAORxDO1GyPkLZ6Ez782vf+JZP5pr9ygemXXv/Esr801+5WyifYsavmX+52VF3sCXbaGA66t5wIWt1JUEJ7GSQnhJ2+UMZqv6QPsdNS9HGm5N+u93sTjLC20dTHeWp1alqCQACgeOefIGjZEez0M79+XXx/8AEkn801+5Q+/Jr3/iST+aa/cpuR0X3mP0aROkH0iGu2y5ZhojoKi+F8S05IxjGUHv7xVxdegLV9o1RpnTL/oRuOomutZShaiI2N1h3s7FI3OM+WaNkQ2ehV/fk17/AMSSfzTX7lD78mvef3SSfzTX7laGx/Y5atvt+vVuZm2hmDZHzFl3Z51SIvWhIKkJyniUU5wdgB47iqzW3QfqvQup7RYZoiSTenUMwZcZalMvLUpKcbjII4kk7cjkZo2R8hbPQg/fk17/AMSyfzTX7lH9+XXv/Ekn801+5W1vn2JevrPbpM1iVZbmuMguORokhXXEAZ2CkgE4GcZGe6sYroh1GrQ9j1cwY8li+zBBgwWeNUl1wlYHZ4cY+DV30bIj2egn78uvf+JJP5pr9ygOmTXv/Ekn801+5VzePsftT2i+WnTYn2iZqK5gL+1UV5SnIrfCVKceVw8CUjGOZz3ZqZrD7G3VGj9Nz785d9PXFi2gGa1DlKLkfcDBCkgE78sg0tkfIWz0M4npj13ntaifUPBTDKgfWCir2y9MRecS1qO1RX21bGXbmhHkI8+AfBr9RCSfnCuW99LSTUywxfVGM8cX1R6OShp2MxMiyG5cKUjrI8loEJdSDgjB3SoHZSTuD7CW1IzWG6Gr6tx2fpp9RW1LbVMign8HIaQVKx+W2FJPiUo8K3yQFDOc15uWGyVHm5YbJURVoplSKnLRTRb2qLJTK9bdMrb2qxU1vTa2dqtMtMq1Nb0ytrerRTNMrY3qky0ysU1tTRaqyUxtTZZqky0ytU1saYU1VqpnnTC2apMtMqyyd6ZcaqzUyd6ZcY8qpMtMrVNVHda2q0UzTDzO3KqTLTKtbVRlt71aLZ2qK41vVJlplctG1MqTtU5xramFt7VZaISk00pO9S1o3plaN6YyORSCKfUmkFNMoZxzpBFOlJ3pCk0DGTSacUKbxuaYxtVEfiijUKJXxRTGN99JPOl99JUN6Y0EeVFR91FTKBQoGhQAKBoUKAAKFAUKABQoUYoAKlY7NFjel47NITYSRyoyO1RoHKlEdqgkAG1GkUoDsmjSKAARypaU0fDypYTQICBSwmjbRTgTSEGlOwp1Cd6CU7CnkIoACEb1IQ3RNo3qShFIQSG9qfQ3tSkN5qQ23tQIQhqn0NU421UhDVAhltqng1T7bO1OhrltSJGG2qcS1UhtmnEM0CGOq5U4hrepHU8qcQzSERg1vTyWtqfDO/KnUsnHKkSyMhveng3vTyWjxcqcDdS0S0IQjs08hFLS3tTiUVDRm0EE04lNGE4pQFZNGMkIO1c+6ZeL06wHB6s2vY93F6Q9xfqrohRmqDXmnXNS6aBjNqcuFoLkhttPxnoysF1KR3qQQHAPAr8KrE6mrKwOpnFTRUop8KLFegegdC6P+mHUGg9MXOxQrLZ7napb3XSE3CIp1IJSEkKwoApISNleyu+9BXTvpe52O4w7zH07pKVBUZKkRUJix5DRG6kpzusYAIySdsd4HnjSXS3d9IaGv+j4cC3vRL2Fh195Ki43xICDjBwdhtkbHesNw78qhwsq6Oo9OPSbG6S7mqZbNOx4lsYkKS3czE4JEtXDjC1juxghBJPecchy4YzWiGvtQp0UrRaZiBZFSPSVMBlPEV5B3XjixkA48qzuNsVUU1wJnq5u7aK0H9jpoiDrmxyrxDuajLREjucKitRW6FntJ2AWNs94rYXBem2Lx0PacjQU2y1PuPXWLb3V56pxEcqZSrJPa43ieZ7Sa8eag1tqLVNvttuvN1fmw7W31UNlYSEso4QnAwB3JSN88qc1BrzU2qZNvl3i8yZL9tQG4bnZbUwAQRwlAGCCAc89hTovcj0pp7TWr532VN21RdoUyJZ7Z1/8sfSURzG6koaSlZ7JzniIB2wonBq96OXbX0n6X1K8l5hu0N61dubxd+K5HbU28n/EUpJ8ia8xX7pk6QdT2lVpu2q7jJgrTwOM5SgOJ8FlIBUPIk5qrs+vdT6fsNw0/arzJiWu5cXpUZvhw7xJCTkkZGUgA4I2ooNyPZMe+2/V1m0/0yXLq2bfYId3kNM78RKnA22fXwNqH5SxXm7oLRJ130/Wq5XI9Y+7MfushR37aUqcH+bhA9lYk9IGqjpEaP8At3K+0AP+wDhCPj8eM4zji3xnGai6W1ZfNFXT7a6fuDtvmhtTXXNpSo8KsZGFAjuFFBuR2GwuDXf2XSpOetaavLzqVE/IjIUEH1ZbTWA6dLsL30varlhSVBM9UcFPLDQDY/0VQaf1nqDS19XfrNc3YlzcCwqSlKVKPGcq+MCNz5VVTJT9wlvzJTqnpEhxTrriua1qJKifMkk00hOXB6v6B7PE1d0IWlu5yG2IFg1Eu4P9YMhbbOXeE+XEsE+QNbCTqSKvT8HpsuCY/BC0496PHwch95xPCPLOAj+8a8eWnpB1TY9NzdM229SYtnnlZkxWwnhc40hKskjIyAAcGjk9IOqpmk2dJP3uU5YmOHq4RCeBPCriAzjiIB3wTSoe5HetdQ9RX/7HDRkTTMGbdftxJ9KuioiC6t15alrVxhPcXick7ApAOK2Llp4NVdC+hpq23LnYoarhOQFcRZ6phKUb+bgwPya8vaU6Vtb6IgLt+ntRzYENaissJ4VoCjzKQsHhJ78YzUa09ImrLJqORqWDfpqLzJQpt6atQdccScZBKwfmj3Cig3o9Xanu1m0VZ9d9K2mFzdRXS4PG1yMqCWYCmj1W6diUpISc7k5TjAJNX+j5umtHWzo10jc0hu+SLWowVqSPgHOpSXTvsFqKiBtv2h37+MLZr/VNntd1tMG9SWYN4K1TmBwlL5UMKJyDgkHBIx9FC96/1TqO5W653S9y5M62JSmG+eFK2AlXEnhKQNwRnPOig3o6ro629J+gembUd4iWGVqydalLTc1KWAuSw8eJDiCTnKggKTwhWMYxV50uaG0pd+iu4dIsHTd40TdlykB2BMJQJylOAH4PJHyioHCd0nbvrkCemPpARf3L+jVVxRcnGkMOPJKQHEJzwpUgJ4VY4jjI7zVbqzpB1XrpbR1Jfp1zS0eJtt1YDaDjGQhICQcd+M0BuVGepaaSBTiEE8qGZNm46GUqV0i2dQGQhx1a/wAgMuFX0A11qOn4JH5I+qsT0Naedgw5+ppTakB5tdvt+duNStn3B5JR2M/Oc8jW+bb2rzNTK5cHm6p3KhlSMgUktbVMLVDqq5zBEAtb02prarHqd6QpnaqKRWFmmls1aFim1MU0ykyrUxTRYq0Ux5U2Y9UmWmVSmKYWxVuqP5UyuP5VSZaZUFjntTLjHlVuY/Pamlx/KqTLTKdbHlUd5jblVyuP5VHeY25VSZaZSOM47qiOs78qunGN+VQnWdzVpmiZUOtbVGW3tVq8ztUVbW3KqTLRVuN78qZWip7reFcqjuI8qotEJSKbUmpSkU0tNUMi8POm1CpJTzppSaY0R1Cm8b0+pNN43NBRHUKJXxRS1DeiUOyKYxnG9JUN6cx2qQob0xiSNqTSz8Wk0xhGhQNAUxgoGhQNAAoUYFCgQKAFGRtRpFILABvS8dmgBvTmOxQTYlA5UojtUpA5Uop7VIQEp2NKSmlJT2TSkJoAIp5UtKKWUbinAigQTaKdSjypTaKeSjlSAJDflTyGs91ONo5U823vyoEJba8qkts+VLbbqU03QIQ2yccqlNMbU421tyqU01QIZbYqS2x5U82zvUptnyoER22PKnhH8qlNMeVSAx5UAQm49OIYqahnxFOIZ8qBUQ+o5UtLFTeppxLNIVEIMb8qcDFSw1Sw3RQqIYZ3pYZ3qUGxSuDypUJojhralhunwjahw4qXElxGeClBFOYobVDiZuA3wUWXGnUPMrU062oLQtBwpKhuCD407sfCiPsrNwMnAzGoujeyakcXLhvt2O4udpaS2TCfV3nCRxMk9+ApGeQTWNldD+qI68Nx4EtB+K5GuMdST/iWkj2gV1gikltJ5gGtYzkjRZJI5CeifVo/3U3+nRv4lD70+rsf91N/p0b+JXXC2k/JHuoi0n5o91X4sivFl5HI/vUat/qpv9OjfxKP70+rv6qb/To38Sut9Uj5o91Dq0fNT7qPFkPxZeRyT702rj/upv8ATo38Sh96bVw2+1SP06N/ErrnVI58KfdRhpHzU+6jxZB40vI5F96fV39VI/TY38SgeibV39VN/p0b+JXXerR81Puow0nHxU+6jxZB4svI5EOibVx/3Uj9OjfxaL70+rh/upv9OjfxK68GUfNHuoi0j5o91HiyF4svI5F96fV39VI/To38Wj+9Nq7+qkfp0b+JXXAyg/JHupQZR80e6l4sg8WXkchHRNq7vtKP06N/Eox0S6uP+6Ufp0b+JXYAwg/JHup1EdB+SPdSeaQnnfkca+9Jq7+qU/psb+JRjoj1f/VCf02N/ErtKYiPmj3U4mGjPxR7ql6iRL1D8jif3otYf1Qn9NjfxKMdEWrz/ugfpsb+JXbxET8we6liGn5o91T+JkR+KfkcO+9BrD+px+mRv4lD70Or/wCp8/8Axkf+JXcxETy4R7qV6GkDASPdS/EyF+KfkcNR0QatUsJNqQjPeubHAHt6ytdp/oZgQHEv6kmpmKSciBbnCUq8nH8AAeIbBP4w510YRUj5P0UsMeVRLUSZL1En0IxQXigdW2000gNMstJ4G2WxyQhPcB+0nJJNOoYx3VKQ1inEt+qufqc93yyGWKPqPKpnV+qj4PVQMg9RvypJY2qw6vekqboHZXFim1MeVWRb7sCkFv1UWFlYqP5U2Y/lVoprfupBZ8qdlKRVqjeVMqjeVXBY8qQqP5U7KUilMXyppcXyq7MbypCoue41SkNTM+5F8qivxtuVaNyL5GoMmLtyqkzSMzOOR9+VQX2O0dq0Tsbc7d1VshjCjtWiZtGRRPM9moa2sCrqQzhPKoLjW3KrTNUyneb7XKorjZ8KtHm+1yqI63Vplorlt+VMrRU5aKYcRTLIRRzppSallOxphaaoaIq001w7mpK001w7mmURVp3pJT2RTy07mkqHZFMZH4d6Sob07jtUhQ3NMY2R2aQBTxHZpAFADZFDFKUN6IDamMTQNHQNMYYFDFGkZowKRICNhRpFHw7ClJFAgAb05js0kDencdikIJA5UsjtUbY5Usp7VABpT2TS0JpSB2DSkJoEGU7inUoocG4p5KKQBtIp5KOVE0jNSEo5UCFNI5VIbRvQaRyp9tG9AhTaKltI35UltupjLe9ACm29uVTGm9uVE03tyqYy3tyoEBprflUxpnblQaa8qmtNbcqYhppmpsKAua+GW1No7JWtx1XC20hIypa1fJSkAkmiaZWtSW221LWshKUJGVKJ2AA7yTWU6UtVotkd7RlsdQt0qH25ktnIW4k5EVJHNCDus/KWMckb1GNlJE+R0i6EZfW00rU8tKCUh9uNHQh3HykhTnEAeYzg451ZaU1TpHVeoINjiI1Gy/NWUJceaj8CMJKiThecAJJrh2Dn171vehNn/wC2Uidt/ILTOkDPcot9Ukjzy6K1ljSVlKjoSUhSQRyIzSwjypSEcIA8NqVjyrGiKCZjuSH0MsNLddcUEobQnKlE8gB31VXrWGltMOKZmzX7rOQeFyJaSgoaPelchWUcQ8EBfrqL0k6je0vpuLb4DhauF9Q6p59BwtqElXBwJPd1qwsKPPhRjko1ySz2iZf7rDtFuZ62XMdSww3kJBUeWTyAHMnuANaRgurKSOjL6YrPxq6vSEooJ2K7yQrHsYxVpaukjR91WlmQq52J1WwclcMqNn8ZbYStA8+BXnVP95y2pbLa9aMmSBupu1uqjcX9pxhRT5hHsrBaisE7S17lWe4JbEmMpIUWlhaFhSQpK0qHNKkqSQfA1SjF9AaO9SozsN1KHerKXEJcbdbWFtutq+KtChspJ7iKrdS6p01pN6DDuab29Lkw0TFeiIZ6tCVqWEp7agScJz7az/RNeXLhpm82KQrjFqCLlCJ5toW4G3kD8UlTa8dygT3ms900L/8AvDnRgTiHGhxMHuKIzeR7yahQ5pi2o29h1zpDUF9t1njsanQ9PktRUKU3G4UlagnJwvOBnPsqxuc60WCyybzdXbiqMiciCyiG22pbilJcXxHjIAASj6a5p0MRw70lWmQtOUQEyJ6t8Y6phxQP+LhrQdLLxj6M01C5GTNmS1b8whDTScj1lePbQ4K6HtXkSfvoaK7o+qva1F/fq7s96sWqLRNn2b7btrhPsMuonIaAIdS4QUlCjyLRG/jXBa6X0MSOKLqqDxc4caYE9xLcgJJ9YD2Paac8UUuCdifY2ilgDNQtR6t0vpK7u2W5fbyTcIqUCV6EhjqmnSkKLYK1AkpyAfMEd1T41wZsUOdqKWhDjFnZ9IS0vk9IJ4WGv7zhBP4qVVwKTJfmyXpUp5T8h9xTrrqty4tRJUo+skmphjT6ijBJWzsETpH0dMlMxmouqOsecS0jKI2MqUEj5XiRWl1S7ZNHRp0u5P3ORHZuZtrPoaGuNaglaio8ZAx2By8a5B0Uwk3DpK0yysEoRcWn14GcJaPWq9mEVq+l+YpemdOtrGFzJs+4r33OeqbH08f003jjdFbI+RJPSdovH+zap/wRf36H3zdFHmzqpP8A5UU//uCuSx47suQ1GYQVuvOJabQOalKIAHvIrdXHoT1NCEhMaTZbrJj8QXEgTeN8lOeIJQtKeMjB2Tk7bA1TxwQti8jX2vV2kb26I8K9SIMlRwhu8R0sIcPgHkLWhJ/L4R51cPRZEWSqK+y40+hXCW1pwoE8vrFeeduexBHvrvXQxOd1RZrXHmu9Yuz3ViD1iySr0RYLiEk+CC26B4AgcgKmWJLlC8NMi6j1to/Tl/uVlfGo5D1vkLjLcYbjcClIOCU5XnGQam6avun9WQru7bEXtldtYadKpiGQhRW6EBPYJOfjH+6a4deLgq7XefcVkFUyU9IJHIlbilfrrqPRJF9H0PfJmADMucaKk55paZW4rb1uo99EsaSsrZHyNKDgc6dbMJiDc7lcXJKYdtiKlOCOlJcV20pCU8WBklYppCciq7Wz/ofRtfV8QBlyIUID5wLinVfQyKzUFZlGCsrx0naLSTmPqk/+XF/fovvo6MH/AOG1R+bjfv1x9RCUlR5AEmt4roX1U3hL7lgjuEJUWnrwwlacgEBQzscEVq8cF1NNi8jTp6UtGZ3jao9jcX9+tnFXAuNitN5twmoYuLTjqW5fBxpCXVNg9jbfgJ5muUI6GNTAgmTpz/50x+2uuwoCrTYbFaFuR3V262sx1rYcDiC52lrwobHtLIyPCsMsYpcGWWEVHoBCNhUhTceHEE+4ykQ4hUUoWUlbjyhzS2gbrI7zskd5FSLbDRLmMsurLbSiS6sc0NpBUs+xIJrC3q8O365OT3E9WhYCWGR8VhkfEbT5Ac/Eknma83NPaePqs/hK+7NA9rW2M5TCsTr4HJydLKSf7jQAH+I0393aT/4ctg9UiQD7+OoFg0w5emXJbstuFCaX1ReU2XFLcxngQgEZIBBJJAGR3nFSrvo0wLc7cIVxROYj8JfQpksutAqCQrh4lBSckAkHIyMjG9c+7I1u+hweJqZR3rp8F/6W9tv9mu7iI5D1qlLPCj0h0OR1k8h1mAUZ8VAjxIqxlOJsluukuZA652GlDaWHVKQA6pxKAFcJB2HEfZXNMA7EZHIg99dImW+7ag6MrY/DgzJ0qQ6028WUFalIYL6QpXsDYz5Cqxzck/M10+olkjJVylf2viZ/7vB/w7bP0iT+/Q+7sf8AD1t/SJH79V7ujdSMNLdd0/dm20AqUtUZQCQOZJqnFZuc11+RyS1GeP5uP0X0NUNe/wD9vWz9Ikfv1Zab1Wi8X2Fb3bDb0NPucLikPyOJKQkqJGV4zhJrJ23Tt6vDCpFutE+aylZbU5HZK0hQAOMjvwR761mg9I3yHqJEm4Wi4QmG47oDr7BQnjWnq0jJ7/hCfZVQc215fA30+TUTnHji/Lt+weotVtWO8ybaxZIT6YwbQp1594KUvq0qVslQA7SjVb98A/8AD1s/SJH79U+qJSZ+pbvKSSUOzXyn8kLIH0AUVksE2/uPoiGMkR20uOrkPBpCQVcI3PeT3eVJzk5NRM56nLLI4w83XC+hcjpAP/D1s/SJH79WOntVpvd+t9tcsMBtuVIS2taJEjKU81EZX3AGqn7392//ADVl/wDmTdW+lNJybFeU3ObLtfBGYfUhLMxLi1OFtSUgAeaqqPibla4+Btiepc1uXF88L6D2ob3H0+zbkt2uPMcltOSFqfedTwJ6wpQAEKHck71Tfd2n/h22/pMj9+mtfupVe48ZOCIkCO0fWQXD/wCpVFboD91uEa3xggvynUst8ZwniUcbnuFTOct1Izz6nIsrhD4dEaE66aPxtOwf7st8H6SalQ9WWSWsNzIc22Z269t0SW0/lJKUrx+Tk+RqCNAXN4cMObaZzx+KwxJUHHD4JC0JBPlnJrNbjIIIIOCCMEHwNJznHqKWo1GOt/yX9DpEmIqMtIKm3EOJDjTrSuJt1B5LSrvB/aDgikSjCtkduVdZRjNOjiZabR1j8gZxlCMgBOduJRA8M1X6JuTBsV1YuOXI1pSLi2nJypKjwLZB7gtfVeolR76yVxuMq7Tnp01zrJDxysjYDGwSkdyQNgO4CtJZEkmu505NWowUorlmif1pBQrEWwhaQdlTJiySPyWwkD3mm0a2Rn4bT1sWknfq3n2zjyPGfqqDp/TDt8belOSm4UFhYbW+tBcKnCMhCEAgqONzkgAczvVjP0OlqE/Jt91EtUZpTzjDsYsrKE7qKDxKBwN8Eg4G2alPI1f0MFk1UlvXT9PkS4l6sV4cQwevtEhZ4U+kupdjqPh1gCVI9akkeJFJuMByI64w82pt1tRStChukjurGFPMYyOR863rbrk/TtmlvqKniwthSjzUlp1TaCfPhCR/dFaYsjlwzp0epllbjLqjPvM4Jqqktdo1opDW5qpktdo10xZ6sGUUhrs1Ada2q6kt7VXutbVombxZTPt71Cdbxnard9vBqC83zq0zVFWtFMOoqetveo7rdVZZAKdjUdaanKRsajuIp2NEJxNNY3NS3EUzwbmmUQ1p50Sh2RTq0bmiUjsCmMi47VIUN6kcHaptad6Yxojs03inyns03w0wG1CkgU6pNJCdqYxoigoUsiiWmgBSU0AKWlO9AJoIBjYUpIoynYUpCaBACd6c4ezRAb07jsUgCbTypZT2qJtO4pwp7VAC0J7JpaE70EDsmloTQIXw7in0ppGNxT6U0BYppNSEJ5U2ympCE5xQIfaTUhtG/Km2k8tqktpoEOtoqayjyqO0nyqaynflQBIaRtU1lFMNJ25VNZTtTESGm6loGBTDQqTKnQtPWZ+/3VrrojCurYik4M6QRlLIPMJA7S1DkkeKhVJDSsr9WapOhbKlyM5w3+5tEQsHtQo5ylUk+C1bpb8BxL7k1zLQ+kHNXXZTClrj22G0ZM6SkZLLQOAE+Li1YQkd5OeQNRH373r7VBWUuXG83aQEpQgY41nZKUjklIAAA5JSnwFd40tpqFYXrNpSD/KGROaXOlpScTpBUApY2/BoTxJQD3ZVzUa1/KizkHS6YrfSPeYcGO3GiW9TUBmO38VlLTSEcA8cKCt+/n31oehWN1dt1XciD+BiQEnG2XHi4rf1Mjbzrn+ormb1qK63M8WZk1+R2jk4W4pQ39RFdU6LYi4/Ry68G1Ezr04cgE5SywhI/wAzqvdTlxEO5pEeqj7+VEAU7EEesYo1kJTk4A8ayJOedNbDxutjm8KjEetLTDKu7jaWsOp8iFKBI8Fg99YO1XWZYrnFulufMeZDdS8y6ACULScg4Ox8wdiCRXeXzbbjAdtV2jMT7c6rrCyp3gW04BgONLG6F42zuCNlAisJdehx6QVu6WvEW5pz2YMtaY0weQyeqcP5KgT82tIyVUyiztnSzp67I4b7bZVnlK+NJtqQ/GJ8SwohaPUlSh4Cr/UWhtHa+uEnVUC9XibDLbDS125MdaWQ20hoFxCyHGieDOFpAyeZriN3sl0sEr0O722ZbpHc1KZU0pXmMjceYzSbVd59iuLVxtcx+FMaOUPsr4VDy8x4g5B7xT290F+Z3PSukdP6acmt2l68yZN0abgZmdSEISXm1kgIGScoA9tcm6S54ufSHqaWlRUhy5yAg/ipWUJ+hIrs3Rxf2dZpt99cjMRpMG4Nt3NhhOG1FKC8l5CPkhaW1goGwUg42OB55lS3LhJemunickuKfWfErUVH6TSh1BnQOhVgJn6kuCgCI1mW0knuU+800P8ALx030zyf+1bDbwRiJZ2lkd4U8446c/3VIqz6I4ym9I6nlpTlcqXCgo8dg66R7+Cs10vS0y+ki+IRu3EeTARvnssNoa28soUfbTXMh9jHgEgkJJA5kDYd2/hW56G3gnVM6KpfD6XZ5rYHzilsOpHvaz7KkdGWmRf9J9IjxwVxLIhbScZJcD3WjHnhhXvrP9Hmo4ukta2q+TGi9DiuLL7aU8RcaU2tCkgeYVj203zaEka/piu5gxbXpNpWHEhN0uI7+ucThls/kNHix4unwrnM22vwGILr+Emax6ShONw2VqSkn8rgUR5Y8av9P26b0na7Kri6sKnPuTri+j+aaB4nCPZhCfMpFSOmCbFl9JF7ZgsCNBt7qbZGYTyaajoDQSPahXvz30R44BomdC0cHVc2eQD9r7RMfBJxhS0BlP0vU70zv4utgt+U5iWZpSgDuFPOuO7/AN1SPYam9DsdTdg1hcAEgluFCSTzyt1bpA9jIz7KpOmR0K6SLuwlSVJhCPBHD3dUw2gj2KChS/3B2IXRhCFw6RtNsrB6tNwaecweSGz1qj7Ag12bTUpLupo9zlL6pmK8bnLdPJlps9atRPdyx6yB31wGxX2fpm7R7tbHG25ccq6tTjSXU9pBQrKVAg5Sojcd9W1+6R9T6kt6rbOnMtwVlKnI0KI1FbeI3TxhtI48HcA5A8KJRbYGelSDLlPSCgILzineEfJ4lFWPprr/AEHurtWi9c3kudUlhkKbWBk9Y3FkqB9hcRXHm2nH3UNNNrdccUEIQhJUpaicAADcknkO+u5TLWvQXQxe7I6oC4KYSZ3AoENypLzSepz38DLXCrHyirwon0oI+ZwpKShKUn5IA91du0HH9C6NrMkpAMyZNmHHeApDKc/mlVxLPayfGu/QGfQtLaVhcIBaszDisfOeUt4+3DgzRk6C7EgDIrM9LcgR9CWiKCnimXd58jv4WWEoB9WXlVpRyrEdNknhb0pbwU/BwH5agBuFPSFAE+tLKfdWcVyTFHN4jLUmXHYkPIYZddQ246v4raCoBSj5AEn2V6Cvt903crzOlMay0v1LshamuKcoEIzhORwfNArzxncYBz5Uv4X5rvuNaSjZXaj0TaXLXdpaYdu1Lp6bKUhSksMTSpaglJUrAKBySkn2VYsDsJPiK5R0IR1q1ZNlqQ4fRLTLWlRBwlSwloZ9jiq602MGuXKq4OfMklwWFtaXIceitY62VFkRmsnGXFsrSkZ81ED21zLBGyklJGxSoYII5g+YO1dFSpPIkD20i7Wy06gcU/OWuJPUO1NYAUHT4utkgKP4ySCe/NeZnhu6Hi6zA8qW3qjMaf1OuysuQ34jc2C451paKy242vASVIWM4JAAIIIOBWugX/S1yiTYj06VETMYMdTcxIawCpJ2eSFoz2flAeyszJ0Hd0E/a9UW7oG49Dd+EI/sl4X7gaz7iHGHVsutradbPCttaSlSD4EHce2sFKUOGjhjmzYElNcev1OhP6J0/GCFPRb2EujibcTOZU24PFK0tEKHqNTVmMxb4duhtPIiw0LSjrnAtaitZWokgAczjlyFYSwalm6fWpDOJEFxWX4Lh+Ce8wPkL8FjBHfkbVuJQZHVuxlqciyGkSI61c1NqGRnzG4PmDWkJRfRHXgyY5JvGq8yl1Q/1Vncb/pXEox5c/1Vi60ur3sojNealfUKzWQnc929YZXcjztXK8h0OxNhjSNoRgZeXKknzy7wA+5urayOpZuTL6visBT5yduwhS/+moSGjGtdnjbZZtsfOPnLBcP/AKlE+51NlvT/ACLdueSCfFeGx/rrpXFen9D1o+4l6JfwjmaFKUhKlHKlAEnzO5rWaLvVottvuca4yZEZyU6wpCmopeBQgLyDgjG6x7qyh2OB3UXngnzANckJOLtHiYsjxy3LlnRPuh0x/W8//wCWL/fqayuBcrY5Ltk56SEvpjKQ7FUyQpSSoYyTnl9Ncu4h5+410vQEYCzWnjB4ZV0dfUMYyhsNp/6V1vjm5umj09LnllntcV/P1MfrR4P6vvC0nKUylNJ9SAGwP8lP6CbP3TsyMEiGxIleopaUE/5lJqhfkKmSHZSySp9anSTzJUSr9dS7Re5thkOyIC2UuOtKYX1rCHQUEgkYUCN+EVjGS37mcEMq8bxJdLs31ujLl3GMw18cuJOc/FCSCVE9wABJPdiufXeW3Ou8+WyctPynnWzjGUqcUUnHqIqZcNXXm5xFw35TbcZzZxqNHbYS6PBfAAVDyJx5VUtoW6tDbaFuOOKCEIQMqWo7BIHeSeQqpzUlSNNRnjkSjA1ejbM/d7FqZuOfh3mGIzDZ/nnQ4XurHmUtYHmRWTByMiulRIQ07aY1oCx6U26ZUxxC9hIIACEkdzaQE5HyuI1HutstN/dVIm8cOcs5XLihJDp+c40cAq8VJKSe/JqpY+Eu6N8mkuEUvzJf3/izKaf1LIsJea6hqXDkFJeiuqKQVDYLSoboWASMjO2xBrXWzU+mpC1cbyonWtLZXGuaFFlaVp4SOua5DB5kJrOyNB3XdVuciXZI34YjmHcf2S+FR/u5rPvNOxnlsvNuMvIOFNuJKFpPmDuKSlOHVGUcubT0pLj1+p0mRYrHHbbeOlrapl3dp5uXIW05+StLpB99MTXWVMR48aGzDjx0FDbLSlKAyoqJyok5JUe+sXZL/NsDylRSlbDv4eI5uzIHgodx8FDtDuNbKWGFIZkxFLXDltJfYK/jcByOFX4ySFJPmnzrWE1Lojv0+aGRXFU/gisfGc1VSEdo1bviq2Qnc1umd8Cpko2qudRtVrIT2agOp2rRM6YlU8jeoD6KtXk71BfTzqkzVFY4iozyasHEVGdRnuqrNEQCnY1FcTVgUc9qjOIpplIguJ8qZCdzU1xFMcO5qkyiE4nc0lSewKkOJ3NIWn4MVVjIvD2qaWntGpPD2qaWntGmMZKexTfDvUgp7FN8NOwGVppIFOrTvSQNqYDRFBYpZFEtNADiU0AnenUpogneizKxJTtSkJpwp2FGhNFisSE707w9igE9qneHsUgsQ2ncU5w9ulNJ5bU4U9uiwsCEdk042iloT2TS0J3pWKwcG4p9KKHBuKeSmiwsNlFSEopLKKkITRYrHG0bCpDaaJpPKn20707FY40iprKaYaTUxpO9FhZJaTtUtpNR2xtUtobVSCyS0O6sp00PrRE0nCJHAIUqXwj5zkgpz7UtJ91a1rYipN0i6evwhKu+mo056HFTEQ6qZIbJQlSlckLAzlSjy76uLp2XFnBLdcp9olomW2bKgykAhL8Z1TTiQRggKSQRkbVbnpE1oUlP3Yaj4TsR9sn9/wDNXVvuW0V3aLh//MZf8SoWpNJaRa0ZqG4xtLR4ciFESph5E6SspdW822nZSyD8YnBHdWu5PsUji4GKtrVq7UlkjeiWrUN4gR+Mr6mLNdaRxHmeFKgMnxqrCTxYCTzrtWltG6SGitOTJ+mGZtwnRFyX3nZshBV8O4lBCULAHZQKqTS6iRd2mbcZ2idKv3WZMmzHoT0hb0t5Trig5Ic4e0ok44UJx66kxJLsFu4z46ELkQrZNlMpWgLHWIYWpJ4SCDggHBHdRyHWVoisRorcSLEjtxWGG1KUG20DAGVEk953PfS7dNNtnMy0tId6s9ppfxXEEEKQfJSSR7axC+Tj6umTXfESNQuJ824sdP1N10fR1+uGv9IMekS13a7wZUj0pooSXksqCC2sISAVI2UMgHBznGRXNte9HMrSjjtxtyXZunFrxHmhOeoB5NP4/BuJ5b7KxkE5wMixIejPNyYzrrLzZ4m3mllKkHxSobj2VrSa4HdHo99hTGn5w1NHWNNIjul5M9BS3xdWrgDPHuHirh4er3zz2zXmtIISkK+NgZ9eN6lz7pcbu6l64zps5xPJcp9bqh6ionFWOk9HXXWU0s25pKY7RBkznspjRU/OcXyHkkZUrkBQlt6h1OidEzirR0W9IN5dBQ31IaYXxY4nQw6jbzBkt++uQYAHCOQ2rumskQdPdEVztFsC/QEPRIDKnRhyQ4t0vuvKHcpXUA4+SkAd1cNCTtsfdRDuwZ3XoagJTpXTzTnDw3HUTshf9m0GW9/c5XErvPXdrrOuKyCuXJdkEjkStalfrrvOm86f6PbNKGyrfpqbdMpG4cdLykH15W37q89hJQkIweyMe6lDq2DO2/Y/Rkiy3RLiVhN4uke08QPNBjvcXuLyfeK4kWVxyWXBhbZ6tQ8FJ2P0iu6dHCF2bo+0/JaSEvPXGXcUk9/AttpBPtZVT7+nNHyZDj7ujbepbi1OKxMlDckk7BzxNJOm2D8hHQfZ2rLZodxkoAkX6clZUR8SBFXxK9i3EKPqaFcNmTXLnMkT3fwkp1chXrWoqP116JlXBuHartPjRkQ49osEhuKw0VKSwkNdU2BxEk9p3JJOckmvOKWynCADgYSPqpw5dg+h2/oftRe0bbYpCgbxqI5yNi20hpv27uL9xrkmrLp9u9V3q6cXEJk+Q+DjGQpxRH0Yru2gAbHpDS0hwFIhWideV43IKi+4k+5Ddec0JVwJBBJ4Rn143oh1sbNp0e6Ht+rI93nXWdOiRbf6O2BDabWtxx1S8DtkAABtRrVo6KtGDtKueqHk/NDUVsn25Vj3Gl9Fkf0fo8uDxAzNvSEeeGY+frerRJT2dqlt2S3QzYrZZdKL6zTtqMSWUlBuMp8yJYBGDwKwlLWR3oSFedUvSi+IvR6yyCAZ14TtncpZYUfreH0VogghXKsZ01PcFt0rBBBJamTVJHMcbqW0/QyfdQuoJ2crcyW1gcykivUl/wBOXFV3cREhqeisIajMuIW3wqQ22lAI7X4teXME8wfdSeob/oUf4BVyjYHpxGmb0chNtdUdzhKkE7DPIKrknTbI4tdGGD2bfboUQDwIZDih/idNF0GW30npDjvNtJSqJCmSAQgDtdSptPq7TifbVX0ozTcukbUshPEUfbF5pGR8hs9Wn6ECpiqkOklwXXQPDck9IjL7JSHYMGZKaysJPWBkoRgk8+JwV2xoa1QADPvBxt/tx/fryepAXspAUPMZoejtj+ZR/gH7KcoWw7HrN8apfiuomO3R+OlJW4lyQXEgJ3yRxHYc81WtHJrlfQRCSm76huAbCfRrQpoEJA7Tzzbf+njrqSDXNljXBzZkI1NqS66ectka2vMMtPQRIWVQ2XFKWp10HtLQTsEgYqkd17qdSTw3dxGMHDLDKPYMIFX98szupbVGRDBcudvC0tMZ3ksqPEUIyd1pVkhPygogbgVgiFJWppaFJcQeFaFJIUk+BB3B9deRnc4y68Hzutnmx5LUnT6HXJ8Vy5yHbhbmFzIMpxTzD0ZsrRwqJIHZHZUORScEEVQa+WW7PDjXH/vQSOJpLm77cfgPFx94SVFHCFeBIAFYZiQ9GKzHeeYKxhRacUji9eCM+2kEhIUtRwCcqUTzPiSaiWW01Rnl1qnBrbyxXI10aI2WNOWFleeMQA4Qe4OOuOJH+FQ99ZjT2knbl1U+5oci2jPEVK7K5YHNDQ5nPIr+Kkd5OBWtmylzZLkhaUpKzngQMJQAMBIHcAAAPIVWKDSbZejwyinOXcyGqzmSxv8AIO3tqhLanQWk/GX2E48TsPpNXeqnOK4IQB8RsfSSaa0nE9M1VZo6knhVNaKvyUq4z9CTWMlc6OTJHfm2+bOh3tKRd5TaD2WV9SnHggBA/wBNVGoXOo0fceQMiRFj7944lOHH5sVLdfMh1bxzlxRWfWTn9dVOt3S1p+2MAH+UTHnyMcw22hA+lxVdE+jZ6md+5OXo/wCeP6mJA3ArrWnWrvF0lY27Y9JQhcdchz0d/hBW46tW+43CeGuS4PgfdTZjtKUSphsnxKAa58c9js8vTZ/BbdXf6HbAvVI//FXL9K//ANqjzX7jEZnTrmqStyNbZLjannOIjKCkYOT8pYrjforP/wCWa/Nj9la6BcGhoe8R2WihTbUaKo4AB6x7iOMeTZrZZb/9O/HrVO1T6N9fLnyMoE8ICfAYrSae0rEu9oeuUy4SIwTK9FbQywlziIbCyTlQ2GQNqzm/PB91dAsaep0da0EEdc/Kk+sFaWwf/pmscUbbs4dHjjOT3K0l/YiN6LsSRl663dwg/FbitIyPWVn6qtbe1bbGSbNBMd5Q4TMfc62Tg8wlWAGwe/gAPnTWaGd810KKXRHqwxwhzFURdVajudgdtsW3GIyy5BQ+VKhtOLWtTjgV2lpJ24QMeVUh6QdTBCii4NBWNuGFHTv7G6v71ZVamgx24xQLlCCksIWoJElpR4i2CdgsKyU52PEoc8Vgn2nYshcaQ04xIbOFsupKVpPmk7issjmnw+Di1c80J2pNJ+p1WZHcvry7pbY65kOUrrkLjt8YTncpUE/EUk5BBxyql1251Wn2odyWDcUyUKitOnifZaCVdZn5SUElACTzIyBtmsG24tlZW0pbazsVIUUk+sik7JBVgAE5J8fMmh5bT4Jya3dFquWCt5bwU6SsaVAhSkSnB+QqQvhPtwazmntLyr8PSlrMO1oVh2ctO3mlofzjngBsOZIFaq4PoecT1LXUR2kJZYZBz1TSBhKc9+BzPeST308MWuWa6DFKNzfcgPVXP8zU901Be5mt0z14Fc+ns1AdTtVk+OzUFwbVdnTErHk71DeRVk6neojqN6pM2SKxxFR3W6sFoqO63mq3GiRXqb57VFcbqyUjnUZ1FNSKSK9xHlTHBuasHW/KmOr3NUmVRXOI3NIWjsCpTqNzSFo7AqkyqIPB2qaWjtGpnB2qZcR2jVWFEcp7FN8NSinsU1w07AjuJ3pAG1PuJ3pATsaqwGCnegsb04U8qC00WA+hFEE71IQ3QDe9FnNY2UdkUaEU8pvYUptvelYrGwntcqd4OxSg32qd4BwcqLFY02jcU6UdqltN7iner7dKwsJCBwHaloQM8qdQ32DTjbdFi3CSjcbU8hFL6vcbU8lulYtwTSKfSgbbUppunUt0WLcLbRT7aR4UTaKfQinYtwtsCpTWKZQnyqQ2Kdj3ElHKpLRGKioqQg7VSYbiWhQp9KhUNKqeSutEPcSUKFS2ZrSIUuDIgQJ8WYEdazMZ6xCuBXEnbI5Heq5K6MuiqRSnQ8Lfpz/g3Svst5/fqXIlpfTHbRHjRWYzKY7LEZvgbbQCSABk96ifbVeHRRh4eNMe9slFYo+IVEL3nR9cPGiidxYQ7hJt75eiSHGFqTwqKDstPzVA7KHkQRUOZbNOXFSl3DSOnpDit1OtxlRlk+OWVoGfZTYeGaBdppFKYmNY9JwlBcfRlh4knIMhL0nHsccIPtFWEu5SZrbTDjiURmfwMZltLTLX5LaAEg+eM+dQOtFF1ozzp0G8sFSY71tVbZ1rtlyil8SQ3NYLoS4ElIUO0O4ke2oht2nV/wDg3S3st5H/AF02XRQDoxRQb2Wy7oHUvNuW+2uRXYiIJhqj/ABhHDwoCOLYDgT31Wm36dB/9jdK/wDy8/v0gOjxoF0ZoofiMmyJLTrEWMxDhwo0RotMsRGurbQkrKzgZO5UonPnTAIprrBRdYKKJ3k2PKbZYlR3ocObHltBl5mW11iFpCgrGMjvSk+yovoGnif/AGM0p/8ALz+/SC4KLrBRQ1MtheAVKBt9tMdUP7X+iej/AAAY4QngCM8sDxqrVbdOf8G6W/QD+/SetFAuijaPey0h3GLAiNw4tgsDEZpa3UNNwyEpWoAKVjj5kJTzzyFRozqIzyXDHYfCf5t9JUhW3eAR9dRA6KHWjNFC32XQvLQGftJYv0RX79Rbm/bb0qOq46Z05LMZrqGi7CJKG+JSuEdvllSj7TUDrRjnQDoo2j3sUbbpzP8A7G6W/QD+/Ri2adPLRmlf0A/v0jrBSkuDFFBvZYWiRAsMhyRaNPWC3POoS2tyPDKVKSFpXwnKjsVITn1VHkwbFLkOyJGkdMOvPLU444qCSVKJySe33kmmEu4pRd5Utob2KFo02T/7G6W/QT+/Q+0+nO/R2lv0E/v0Euih1wpULeyfC9AtsWRGtlltFrblFBfMKOW1O8BJSCSo7AkmnULAquDwpxL48aiUTKbb6lmlwE1KkTEXEAXOJEuYSMJMxkOLSPAL2Xj+9VMmQM86cEkeNc88dnPKNktNr05xcR05F9XpckD3dZUuMq2QF9bb7FaIjo5OhguuJ9RdKsHzAqq9KHjShKHjWXhV0RisaXRL9kWkiW7LeU/IdcedVzW4oqJ9pporBqD6UPGj9JHjScAcSwe+1slzrHrDZnnCACtyOoqVgY37VOwnYFukCTDsdnjSEhQQ60woKRxJKSRlR3wTVUJI8aUJA8ajZzZNU7onAgAAd1PPyIsuPHYmWq2TUxwoNGSyVqTxHJ34hzNVvpA8aHpA8anaT0JgYs//AA5Yf0U/vUYYs/fpyw/oh/eqEJA8aPrx41O0ml5E0sWf/hyxfoh/epYdt6IjkRNgsgYcWlxaBFOFKSCEk9rmApXvNV/X+dJL9Kg6EzqrOP8Aw5Ys/wDuqv36XJmJfQw2hiPHZjthpplhHAhCclWAMnvUT7ar+v8AOiL3nSEuOhK6wUOsGe6ofXCh12/Ogdk3jB2wKlOXFctlLM9qNcWUDCW5rKXgkfik9pPsIqp67zo+upWG4kOW7TrpBXpuED/yZEhoe4OYpyMizwd4mnrQ2scnHm1yFj1dapQ+iofXUlT1TZCSTtJfsiwm3GTPdDsp9by0jhSVHZI8AOQHkMVBdWMU0XabW5kUWaJ27YTixUN05Jp5as1HXzp2dMCM98Wobg2qY7yqMtO1PcdcEQHU71GdRvU9xG9R3Eb09x0RRXrQPCo7jYqxW3TLjVG81UStU3zqK635VaKa2NRnWqpSKUStdb8qY6vc7VYutUx1e5q1IdFW63uabcb+DFTnW9zTTjfwYq1IdFdwdqmXUdo1O4O1TDqO0atMKIqk9imgjlUtSPg6a4OVUmFEV1G9NhOxqU6jemwjY1ViojFPKgsCnSigtFOwJqG/AUQb3qW23vRJb3NKzz9wyprsilNt71IU32RtSm2t+VKydwwGu1yp7quxTob7dOlr4PlSsNww01uKd6rt8qdZb3FOlrt8qW4TkIQ0eA0ttrlUhDXYO1ONtb0txO8aLW42qQlvypzqtxtT6WuW1TuJcxppvyp1LflT7TXlTqWvKjeTvG0N8qdQinUtYxTiWqe8XiDaUU+lNGlunAiqUw8QNI2p1HKkpTSwK0UilMWlWKWF03R1tFlKQSZrZkuR8qDjaA4cjYpOdx7qjovMVyEiYlThbWsISOHtFRVwgY9dQL/1rPVPspUVuIXFPD+OOzn2im1R1s3luG2k9SgiWk424gjgA/xAGuhJD3F+XCPH11GduKGpDbCuLiWhbgIGwCcZ+us9bCpT8M8SEy+Ml/Zwuq58QXnYDw7uWKmzz/2pHG+fRX+71UUg3FvHmiTGakJCgh1AWkK54IzvRLnBEluOUr4nEKWD3DGNvpqoC327G23H4+vTDSpKUjfkOXnzqCfQVrWICXOrMR4L2XjiwPH5Xj7KKQtxqw6fOkOzENcBcXw8aw2nzUeQrNPOMNSkOEiQ7hkJYUFpdScD8GrkR3keupt9bYKYy5DaVNNyU8aiCQlBzn2cqfA9zLRmel9x5tAVllYQrI5nAO3vp4Ok8s1l5UdlTF3kBJ42lJU0oZ7HYSQU0U8uKlykvqQh0pT6OtaVlQHDzb4ds5zmmG5mjm3FEJgvOBRTxJRhPPKlAD66fDh5b88VTXpKjagl0kqLjIUU5yTxpyajSSiA5cm245UwWWyWklQGSognbcbc8b7UBuZoeuO3OjDqlKAGfCsetSUN3FEdTYbUw2pIjNqQji48ZTnv5ZIqfKZhxZzSJiOGH1Z6oEKKOtKu0Tj5RGMH10Kg3MvYM9MxjrUBYTxKRhXPKSQfqqRxmqewICrWELCiguOAhYwSkqPOq1t52MhuSsOFNpWGCAN1JJUFevslFFIW41XW+ukl7AJ8OdZ5MdqKqIm6pywWFLPGCW+vUriVxY78HbPnTbERUl2C2+245HKZCkpcz8TiHBxZ8sc/Kih7mX0ecJCngjiHUuqaVnxGM+zeluS0NBJWsJ4lhCc96jyFZ1KC3PdekpKoSJqxw79hwhOFqHenuHhnNTL8wyphhx9sKQ3IQXFYJ4UZ7XLu5U6HuZch1RGwNF1xrLSzEMiYZRdLvCkwigL2Rwdnq8d+edWF0602J7riQ71KSvh5hW2cY86KQbmXXWqxyNAOk9xNZh62xUy57RaIaTFDiU5VjrMK7X5Ww3pt99t5qMiSlHH6GhQW91iuMkckJT8vPfzooNzNV6Ugu9SFfCcBXw9/CDjPvpS5BZZW6pKiEJKtu/AzWZRj0iE64kGS7bx1Li0k8TwxjJ8fXRwvQi0gtJfEz0ZZfyFZ4uHfrM9+eVFINzNFGmiRHafTxBLqAsBQ3AIzTvpFZmHHRGXZ3W0FC3m1JcVvlY6vO/up+6rXBfbnNBRU42qMUjfKiMtn/Fke2ihqTNCl+h1/rrMOsQoLyIs9KlxkR0paUpKlJK8nj5fLO2Poo40pcJ+GucXkqVFKAVJJJVx5CTj5WMUqQWzUCR50oSDVBZUB+yMNPJVwuNqQoK54JIqvalPx20z3W3MwEiGUjJ41EKBOO/fq6NqE2aty5BlbnWBxKG2+sLhHZxnlnx76Dd1S5LEdPGSWev4vk8Oce+sw9DU0xKiEKeWi1p8SS5xqJI885p9mJb51wZQhsLiCHlKASEn4TG48snn31LgiDUeknPM1GVeW8xShSlolKKW1JG2ySc/QaqbIkvWCO28C4FNlOF7kpycfRiq2A1GlQbSwEcXC6rr0YIIX1ZyFUtiCjYiYe8n3UoTO/iNYx4LjtyWmUAQ27gErQsK4AjgBION+DixnFWNiSeqkraU0WVuZQhlCkoScb8PF3Hy2zmoeNEtGkEw+J91LTMz3n3VhJPoqUXIKDonmQv0YpSoq4sjh4DyG/P6acnJcVKlplOMtvq4QypxDilJGBjq+Hb42eW/jWbxIhxNz6XyyTvy2qPAvAnBa0NuhoHCFqAw4AcEjfONu/FUUOAxJulwekt9Y4hxCU8RPCMtjOBy3yaqm2AxbbasNNojrUovlxKigqyeDjA34eflyrJ4kZuJvRJOcb0S57bSm0uOBJcVwIB+UcZx9BrHoz6LGMlRVbvSVlYQlfAlOBwDfco4s+W/hSpQhJbgOBKjAEtXEXAopCSk8u8Iz7KzeJEOLNkJGeWTQ68+dUN7UhVv4XXnGWytHbQgqA3+UBvw+NVzEj0SKJzTSAiJJUVBni6t1Ck4JQDuBnh28qxeMhpmu645oi+eW9ZaC281LZgLLi1MKM1w/OUUDCfPtlW3lTEWQl2VGcbQ00twOB5LaXONPYJ4XFK5nI+is3Azdmu6+h1+/OsjbOqIt3oyXPTAQZCiFZ4OE54idscsVNurjAmxfSuIs9W4FAZx8n42O6p2itmjD+/fRh41kC8luKlBaBhuSVdSp/jDaEBO2QNyCc8IO1CMj0mKwwviLP2wUgJAUgcHCTgA7gb8vOk4itmr9Oa61TXH8IhIUU+API0svVmHmo7FwlpKUoX6KCwDnuQoHH0UuM2pgQFsJIedjL4z85XVgjP8AeqXETbNGHc0CvNZe2qWXoobWyh1KD16AlfWK7Jz1mds5/wD4qdZFNx7ZEcUFddISkKUckqO+M+yoocJOy3UaaVRlW1JO9KzvxJjSxTK07VIIyaSpG1S5HoQi6Iam80ytnyqw6vNIUzvUvIdcIFapjyplxnyq1Ux5U0tip8U2UCpUzz2qK6z5VcrY57VEdY8quOQrYVDrVRy1udqtnWajFrc7VqphtKh1rc0y618GKsnmtzTLrXwYrWMhbSp6rt8qYdb7ZqyLXbqO812jtWqYqIKm/gqY6urBTfwdMBsZHrq0wohOo3psN7GpryN6bS3sapMVEIo3FBxG/KpCm9xRuN8qqxUWDaOdElG9SEI35USUb1Nnj2JU32RSmm96dUjsjaltI35UrE5DQb7Zp7q/g6WEds7U91fwdTuJ3DTLe4p0t9unGW9xTxb7dS5EuQlDXZO1ONteVPttdg7U6035VDmQ5jfUnI2qQlk+FOhrcbVIS1y2rNzM3kGGmfKnkseVSW2fKnkseVR4hk8pGSxsNqWlmpgZ25UYZ8qXik+KRQ1SurqR1XlQKK0WQayjARRhNOlNJIreOQ0WQRihgUZ2oia3jkNVMAOOWaSoDzoiqkqX51ushamKUSdsnHrpPdzNJK6Tx+dWpsakLOKBUTzUT7abUuiK6tSKTHeM8uI49dJJx3011m/OgXPOrVlWPd3M++jB7sn30wHNqUF791XyFj2w76MJHPJ99NcdOJVtTSYrFgEnmffSg3g7Ej20STTqd6pRYnICW8UoN47z76WkU6EVaxshzQxwEciaSW/XUrgpKkVXhMXiIiFG/M++klOKkqTTShSeNlKYzvjGT76QQAaWqm1Hep2spSCPrNAEjvPvoirak8XnU7WVY6FkZGSM0fGSN1H30yV0Avzp0ykOZ9dNOxkOvsurKz1JKkN57PF84jvI7qML86Pj86dDQ6DjkSPUaLOORI9tNhyiK6NpVD4PjRg+Z99McdLSujaPaPbedLHrNMhdLCqNjHsHKVjPMk02k06k01jYbBQRnfJ286X1ee8mgmnkin4LYvDI0eGmP1vAVfCuFxW/eaeDWOWR7aeA9VGRUvAyfDGOrxRcGN8nPrp8+ym1H1VlLAxPEIA3zk59dFnBzk59dAq9VNqX6qwlhZLwjgVg7HFDj3zmmS55ik9b5isXhZLwD/HvudqCllSCkqJBBHOo/W791DrfMVk8LM3px1lAYYbZQTwNpCBk9wpCmkKkNv5PG2lSU4PcrGfqpId8xRdb5is3iZP4ckhe+cn30rj86ih3zFGHazeOg/DknIPOlcXnUXrfOj62sZRGtMS+PPM59tAK86ih3zpSXN6yaNIaUkKO1Ab01x5pxJrKUjtx6cVw5NK6vIo0DJqQlGRyrmnko78eAjhrltR9Rk8qmIZz3U8I+SNq5pZjshgKwxj4Uhcbyq59Fz3UlUTyrPxzbwSgcjc9qiPR/KtC9G57VBej+VbQzWJ4igeY57VFLO52q6fZ8qhqZ3NdUMhm8ZSPs89qYda+DFWj7W5qM838GK6YyIcCoLfbqM832zVkW+3UV9HaNdEWQ4kJTfwRpgI3HrqepHwVRwncVomTtIj7e/sppLexqW8nf2U2lPZNWmKiIpG4o3EbinVJ3FG4nlVWTRPQjeiSnc06lO9ElO5qbPn7FKT2RSmk70pSeyKU0N6lshyAlA4zT/B8HSAO0afx8HUNkuQbKNxT3B2qba5ins9uobM3IfbR2DTzKKbbPYNPNGsmzNyJCWxkVJQ0KYQrJFTWt6xlIxlIcZap9LIAyadhRjIc4eNttCUlbjrhwhtCRlSlHwAqukarPGpqyI6hsbCW6gF9zzAOzY8ABkeOaxtt0jnnkovY9iuElsLZgyXEHkoNnB9tIk2qTDGZEZ9nzcbKR76ySkvTXFOy5L0lZ3K33VLP0mnm5l2sb/AxLlxFDfgS6eEjzScpPtFFS8zHxnZeqaptaMUq03dF+cVGcZbYuQSVoDQ4W5QAyrCfkuYycDZQzjB2IcV3jFXGTumbRnYwoU0qlrXvTC3K6YSN4yAo02VYpK3KZU5XRGRspDhXTal00XKbU7XTFmikPqXSAumVOedIDvOt4miY+pyiLm1Rlu0Sndq3ijRMkdZvRF2onXb86Ivb863jEuyaHdqUlzeoPXbc6NL29aqAWWHWb86eQ5tVYHt+dPtvbc60jAlsskL5VIQeVVrb3LepbbuSK3hjsxlIntgGpKU4GTjA5nwqNGBdUlCElSlEJCRzJPdUS46rTDeVFtAaccQeFc1SQvCu8NA7bfPIOe7A3PoafRvI+Dgy6iuF1LxqBIeTxMxpDqTyLbSlD3gU3JiuR9nG1tqPctJSfprJoavOopJbT9tLrIxxFCS48oDx4RnA9lOJnXywvqiekXGC4gZVGfKsD1tuZGPZiu7/AC2PRPk5vxM+pfuII7qiuDFLtV4bvPEwtlDE5CSvhbGG3kjdRSPkqHMp5EZIxjFJkbZrz8+kcHTO3Dn3EZZphS96DjmCajLd3rhljO2Mh0r2pHWUyp3bnTfW1lsNUySXKAc2qKXaAd250bDREnrKMuVD63zoKd86NpoiYHKIuVED3nRF7zpqJqkTuspSXKgh7zpSXvOrUDRRLAOU4lyq4PedOpe251axlbSwSun0KquQ951Ibe3reOGxqBYoNSG0kiojKgSN6j3bUiLQ6qJFaafmI/CLdHE3HPzQnktfjnsjwJ5ejptA8rpF7F3LpDS3PwTTrv8AZtqX9QNE42poZeQ6z/atqR/qArEyLveL5IS05LuM15fxGULWrP5LaNseoUTV6vtjf6pM66wHME9S8pxGR35bc2I9hr0X7HhVbuRbYmxVnGRyPfTLisVX2bUjd2fTFlpZjTXDhl1tIQzIX8xaeSFnuUOyTsQM5qY8vs5wR3EEYIPeDXl6r2c8TpicBCl70wt3c0hbuCajLdrzJ6dBsJCndqR1vmKiqe2pvrqwlgDwyYXu1Q67bmKgl7tUXXbVhLAHhk8Peqh129QA9Rl7esJYQ8MnB6jD3nUHrvOiD9cuTEPwieX/ADpXXVXF/wA6P0jzrjnjLWIsku0tLvnVYl/fnTqH9+dc04GscRaBzapDagQKq0vbc6lsvbDeuLIuDphiLNogqqc0jIqsjuDiG9WsZQNedmbR2Y8RKZZzipiI24o4EdyS6hllHG4s4SBU+deo9kUYdvbaelp7L0pwBSUK+ahPIkd5O3rrxtRqtrpdT09Po5ZHUUHHsU2S31jUN5aDyUE7GkybFLjJ4norzY8Sg4qilXF+a71suS4+v5zqyceruHspyLdZMNYVEmvtEcwh049oOx9orh/Fzv7+p6v+UOr3ffx/sOPxhvVbIYAzWlYmx74v0V5tqNcF/gXG9m5B+aR8lXq2P0VRTUltS0LTwqSSCDzBr0dJqfE+J5eo0rxy2yKSQ0N6gLQMmrGSob8qr3FDJr2sVnBKBXSEbmoryB1YqW+rJNRXlfBiu7GjCUSApHbqI+ntGpp+PUZ8ZUa64oyaIq0/BGo3DuPXU1Y+CNRsbitUjNojPp39lNpT2TUh4b+ymkjsmrSJojqTuKNwcqUobijcHKqomiekUQG9KTRDnWZ8tYsjsilNikk7UtFJktiwO1T6UFaeFIJPgBmmk8CUrdcXwtNp4lq8B5eJJwB66o5t3kSSUpUWWe5tBxn8o/KNJRbIZo0gNkBSkJPgpaR+uldY3xZ61r84n9tYwKHgPdR5GeQ91DwktG3Q81g/DNfnE/tp5t9v+lZ/OJ/bWCyPAe6jCh4D3VLwLzJcToiXkZGXWfzqf21MakI7nGT/AOan9tcx4h4D3UtKwPkp91RLT+pDgdR1NMVA05FjoIzcnlqcUCDlprhwnbuK1An8ms7CfQjhcKs4OcU3cZHpGitNyEY4IzkqG5j5KyoLGfWAfdVUzJxjeueGP3f1fzOWWLg9YaB0b0dQZLCYC4V0vQYEpfXPiQ4yCE5PB8VGCoAbZrCdO2orbKv67PGbWJEJSeuWUAJSSjPCjxyFgnzFM/YxNIdveoJQxlqIy1/jcUf+gVzzpLuol9IGpHAriT9sXkA57kng/wCmurJziSSo9HUNS0sVGKVsqVzHY76JEdwtvNLDjaxzSpJyD7wK2l2mMuOty0BDTcxluWhBUEgBxIUQPIHI9lczkzOFBPgM1e9ISzDlWi1rAD1vtcdl3yWRkiuZ4rkkedHHyi5dmN5PwrP51P7ajqmN/wBKz+cT+2uerWCc4HupsqBPIe6uuOA6owR0FUtsHHWs/nE/tppUpsn8Mz+cT+2sESPAe6knHgPdWqxI0UUbsyG/6Zn84n9tFx9Z8RSV47kqBP0GsEceA91AK4SCBgjvGxrWMKLUTdLdwcd/hTYdrO229LaUlmUsrY5BSty15g88eI91XClFJIPdW8UWh9btJU5tzqKtdIW6lDa3XFFLbaeJShvt5eZOAK6oI0iSg4Sdtz5UhT6RsXGwfNxI/XWTuF4kTOJvPVMZ/BIOx/K+cfX9FV5UMch7q6oxo0UTdekox+GZ/Op/bRiS3n8Mz+dT+2sHkY5D3UMjPIe6rHtRv/S28/h2fzqf206ia0E7vs/nU/trnZx4D3UMjHIe6qTFsR0lu4MjH8oY/Op/bUpu6RwRmRH/ADqf21yvI8BR8Q8B7q1jkoiWFM7FIvLcOwXCXHfQXiERWltqB4FOEgnI7wgL94rN2yQ02EjAwNseVUlte6zSUpCMcUeY06oD5qgU59hI99Ltz6pCkNNpKnFqShCRzUonAHvIr3tHmUUmeZl097kvM7xaulexaG0ZFh6ZYbk3RakrnOTG1toyUkqUSCCrBwlIyABv69B0mzmtS9E0S+3iCi3XRPUOtIUSVtqWvBQCcKwpGVcJ5d+4rPWDo4haUi/bCREXf73HQFiMhxsNJezsG+MhOx+WvPIkJ5CsH0mSOkG7I+2uprRIg2yMoJbabUlTDBWcAkhSipajgcaufIYG1cUlieeM4dbtt9X6HVGE/DcJdKqjNfbZ2FKbkxnOB9hYcaV4KScitld7jDJQ804yy1IabkNoUsJ4UrSFAbnuyR7K5O/N4iSTgDepmqXzxWqMsDjjW5lCweYJGcfTXRqdQppswx6bbJGwdnsknEhj86n9tR1zGs/h2Pzqf21zoqHgPdScjwHuryZSs9CMEjoSpjWPw7H51P7aT6W3/TM/nU/trn5IzyHuoAjHIe6oLpG/MpsnZ5n86n9tLQsrSSghYHMoIVj3Vz7iHgPdSkOKaWFtqKFDcKScEe0UUUje9d50Sn/OqO1XdUw9RIIL5GUL5dZj5J88cj38qmF/PfSo2iTw950lT/nUEOFSgBuScADvqqud6W24uPDXw8J4VvJ5qPeEnuHnzPqpo6Io0vXcPxloT+UoJ+s0BLaHN9n86n9tYIr4jk4J8TuaPI8B7qpSRqkjf+mNYz17OP7VP7aWmY1j/aGPzqf21z7IxyHuo8jwHuq1NFHRUzWRzkMfnU/tqQ1cGAc+kx/zqf21zLIHyR7qUFDHxR7q3hlpjs679txb7VMuTK2nHI6OFvCgoB1ZCUE48Mk+ysSmR4qJ8STknxJ86atEjrtK3yKj47So0rhHehKyFH2c6gCR2CPCve0uqUIKu4M7xovpLsukdFxLToq1SLlraelPXqMBa+Jw5UvcbrShIISkHG2T31v3PT9b9EV1ldIdnahTYrUp1tbjJZW2G0EoeCVEls5GMZwQOWFYrk2nOjLVNo0xbOkXQ96RcritoOMwmYSVOJQsFDqRxqIUtBJBTjOxx4V0xKb9q3oRvqOkmIm1zAxIc4ikMqCWkhbTq0A4SeMY4eSgBtvXzeszYvE8TE7e62796/JdOBHmcvdYwnj2KkjiHgSN63v2zE+ywLnIeSHZKVJeUohPE62eBR9asJUfNRrlomqUlKlDhUQCR4Gre9vqi6bsUJwEOOodnLSfkpcVhHvSM19Hn1UckCo9zUrnMEkiQx+dT+2o65jGT/KGPzqf21zziGTsPdScjwHurxJ5EFo6CqUzjaQx+dT+2kels8vSGM/2qf21gTw+A91GMeA91YOSCzdGU1nPXs/nU/toelNf07P5xP7awoxxch7qPbwHurJ0OzdoeQv4rrSvU4n9tKUsgjOR66wo4TzA91WFvub0XCCpTjXe2o5x+T4GspQvoNM1PW+dJ67zqKXRgFJylQBB8RTZdx31w5EWkTS950fWnBVnYczyA9tVsiamIwX1gKJPChBPxlYzv5Abn2DvrPSZj0pfE+4V+CcYSnyA5CuRwspcGyTMaH8+z+cT+2nEzGv6dn84n9tYQEDuHupXEPAe6spYEy1M6Cmc0APh2fzif21IauMcAZksfnU/trnHEMd3upaVjwHurnnpItdTWOWjqUe5xirHpUf86n9tXUKcwrGJMc/+cj9tcXS4Btge6pDLwSc4Hurgz+z1JcM6sWfnoeirdPFtsdyuzDqC+gIisqQoK4FuHBO3eBvWUMwJ2HqFVWjZyZHR9qGOg/CxJkaYpI72/ik+zBpuHOiqnxUzVqTFU82l8pOCGysBeD3dnNfIZNG3nnB9nX8L6n1Xs/LGONy++h1zo9tcSzWt3XF+GIbI4YTRGS4oq4eMDvJJ4U+0+FXPTmtDMeykAJJdeGw/EFJ1BeOjbWX2sth1s3Ejw3ECPDiOpQ24sYSj4yDxYGwAPee+p3TSzpt22RFX28SLfIaTIchNMp4jIc4R2SOE7Z4R3c+dfWS0MYaKenx1VLm+r73/AEPDjrHPXY8+VO7fFPhVwl592zjbkriAKFlKkkFKhzBByD76u9YSWFmBdVONNC6RkvkKUEjjGysZ86wDd24BlRA2yd+XjS+lGepEHSFtWAHGLR6S4k80F5wqSD7BXzGh0cvxEI/H5fWj2fa2aOxPuTX5jJz/AChj86n9tQXJbOT8Ox+dT+2sAtwHuHupsqB7h7q+wx6BLufMT1HobZ2Q0okB9n84n9tMLfa4cdcz+cT+2scSPAe6hkY5CuuOjS7mDzGo6xsr2ea/OJ/bTbiQonC0K9Sgf11nBjPIe6jwOe3urZaZLuZvIXjgwgg5BqMfjCorE5bQCVlTjfzTuR6vD1cqlrI4gQQQQCCO8eNTLFtBSsZe5+ymgNjS3TvTYO1TtAQobigvuolHlQWaKJLAUkUYohzrA+TF91KQcU2eVGDikQxi8ulMNtAOzjhUf7o2/wBRqkJymrS9K+Bj+tz/AKaqCdq0h0ChQNHnekCjBqgoXQFFjPKiO1AheaPNNGjzQ0FGl0tPiOxpun7k8GItw4VsyDuI0lPxFn8U/FNVs+JLtMxcOc0WX0c09xHzknvSe41WDbnV5C1NiIiBdobd0hI+IhxRS4z+Qsbj1VzyxuL3R5shx5tE7S+vtRaMckOWC6uQTJCQ8EoQsL4c8OQpJ3GTy8ap3p70qQ6++6p155anFrVzWpRJJPmSSasOo0hJPE1OvMI8y242h3HqPfTiXNK24BbTM27PjcCUQhketCR2vUSRU7u1Mly42u/v+CTpaBGbUnUN5H/ZUNQcQ2ec11JyltPinIGTy2x44obxdpV8ucq5TV8ciS4XFnuBPcPIDYeqnbrepd5fDstzKUDhbbSOFDY8ABsKidXxDYVePG090uooquWNYJouHeprcMhIUvsBXImrzVr2mvR7exZkOl9tlIkLIwniwNvM5ySRtWm+pKKXUTye8kkZVQpBpayDyps1sjdBE0RojzolVSKDzg1oYb5ciMknJSngz6iQPoxWbq5tyv5Ij1q+s1omUTHF1W3x8iG22DgLcJPnwjb6VGpriqq70rLDA/GX9Sa6sT5LgUyjvSSaJR3pJNdNnSkLzQzvSM0M707HQsmhnakZo87U7FQeaGaKgKtAWliuTcCS43JSpcOU2WH0jnwnvHmDvT0huXYJzS0u7pUHY8lvk5g5Ck+fLbuqnAqfCuz0RvqHENyYx5sOjKfZ4V14stLa2YzhzuRpj0ua6BKvuonkn8Vv9yo916TNXXy2v225X2TLhyAkOsuNtYVhQUNwgEbgHY1VdZp948SmrlEJ5pbUlaR6sjNKDthjDibYmzFjkl9QSj2hOKtQXW19/wAi3+j/AGE2mGiQszJnZgRzxOFX84RybHiT3+A9lRLjcHblOelvHK3VcR8h3ClT7nIuBQlzhbZbGG2WxwoR6hUPFTkycbYhGPNsMmizQNJNYM0oMnegDSTQqbKoWDQ4txSAaGd6dhQ+26ppQWg4Ug8QPgRuK0zrnwqiOROQKyqTsa0S1dpXrobNYDqpRYaeeT8ZtpSk+RxgH3nNZhRxsO7aryUr+RyvNr/qTVCs71DkdMRQVR8VNcVHxUtxY7xbUfFTWdqPNNSGOcVGFU1mj4qtSAtbFdzZrkiSUB1opLTzRGQ42rZQpd5gfa1wOxlF23P7xn852+Yo9yhy88Z8ap81Ng3aVb0rbbUhxhz8Iw6nibX6xXTjz+7tkO+xc6Z6RdV6NQ4zYL/Nt7Lp4lsoKVtlXzuBYKQfMDNL1H0k6w1ewmNftRT50cEKEdSghokciUIAST5kGq0vWGSOJ2FMiL7xGe4kewKBxRIXYY/aRHnS1Dkl9wJT7QkDNLZG91r7/QAWq2pnqMmYstW1k5fd5cX4ifFR5eWc+GU3e6OXe4OzHAGwvCUNjk2hIwlI9Qpqdc5FwCEL4W2Wtm2GxwoR6hUXNVLMq2xC+yJCWXlR1yEtOFhtSW1uBPZSpQJSCe4kJOPUaa4qSDQzWTkAvio803mjBqGwFBXapXFTWe1Ss1LYx1KqcSqmEmnEGlY0XlvfKoiUk54FFI9XP9ZqR1tV9uWOpX+X+oU+pdcebqaxIV6dK32kZ7LbYwPNRyf1e6q/ip+6r/le/wAxH1VDKq5gsd46AVTXFQ4qTQ0x/i2pQXTHFRhVQ0WmSQvenA7gc6ihVK4qzlCy4yo1OjNVJ03d+vfb6+DIbVGmM8+saVz9o5j2+NW2oIS7M60tl30q2yhxQpiTlLyPAnuWO8c+/wBWDSavbLqmdZ2Vw+FmXb3jxOwpKONpR8cdx8xXi6z2e3PxsXXuvP8Auv56Ps16uj12xbJdCaxdX40hqSy4UusrS4gnfCkkKBwfMCrrU/SLqLWrkdy+zxJMZKg0lDKWkp4scRwkbk4HPwqvF10bOIU/aLtb1HmIktKkD1BYJxT4vGjLakmFZZ9zcxt9sZOG8+aEAZ9Vcl5UnBY5c9uPndfyd7zY21NtWu/3yStK2hu7dZdLq6YunoKgqbKPJwD+Zb+ctXLA5A+OKoNXajf1RqKdeH0Br0lY6tocmWkjhQj2JA9uabv2rLnqEtpmOpRGY/2eIwkNsMD8VA2z586plqKjvXdodFKM/FydeiXkv6t9/hXq/M1Wp8R8Ciqi4qbzmhnur2oxPOkxXFRhVN5owqtUiLHQd6PipoK3o+KmId4qnRnusj8JG7asD1Hf9tVhVtUuCfgXPyx9VRk6FRfI84d6bB2o1nekDlXOWJPMUFGiNBVIRZAUQFKFFiuWz5EBG1EKM8qTSJZBvf4GN63P+mqgnarW956mN63PrTVQTtW0OholwKSaUOdNg04gcSwkYyTgZOKoGidBkRY6JHpEYvqU0UNdrAQskdr2DNQs05jhKknGQSD30uHCeuM5iFGQXH31pbbQPlKJwBSSrkziuRkGpE5UZTgVEYeZa4Ugh5YUeLG5yANs16rsf2M+g7Dam39SLkXGQ0kKkPvTFR46Vd+EpKcJzt2iT51KV94PSBSgp0cl1BxgJTLcSfP4599VsbZ2rRPrJ0eRGEGQ4G2QXln5DY41e4ZNai09FuuL0lK4Gkr06hZwlxcYtIP95zhGPPlXpBz7Iboz0+11VnYmPJAOEQLZ1Cc+GV8A38az1w+yyiFShbtISnNuyubNQj3hCVn6a0WGT7FfhsS/NI5zb/sbekWYEF21Q4PEd/SZ7YKfWEcVaW3/AGJ2pF8H2w1HZ4oJ7QZadfKR5E8ANM3D7KPWEjIhW2xQU5yCWnX1Y8N1pHtxWemdPPSNPyDqVcZJOQIkVlrHlnhJx7a1Wlk+qHs067WdRtf2JtlaIVcdS3OXtuIrDbIz/e4yKvh9jNoMNrZDl6DvDkL9P7SPPh4eH3ivN0/W2p7x2Z+pb5JGScOT3cDPPYKA+itT0ETPtR0p2Z4r4G5ZdhOHi3V1jZKcnv7aU+0iqlpGotjjLC2oqPUqulnRUno41G3Z3XzLira9IiyCAlTjZJBCgOSkqBB7jse/AwTjnErPdXqH7JDQl31dIsEmyxmpDzTcllbZdS2tQJbWnBUQDjCts99cAuPRzq60q/l+mbwwj5/oq1o/xICh9NcS2p0jizYVCb2LgzSj5Ug1qk2G0t2J116YtN1C8COrs8IHl35+jFULsIt7mlDLGVpdjmhnjK0uxANETTq28csUyrOQPGtkdEeQiat4BxER/e/1Gql1tbLqmnUlC0EpUk8wR3VawtojfrV9Zq0U+g+4raqq8n4Bk/jL+pNWLhqsvB/k7P5a/qTXTi6l41yU6jvSSraiUrekE10WdiQvipbYSsr4nUN8KCocWe2R8kYB3Pnt50SEsGK4tT6xIC0hDQbylSSDxEqzsQcbY3z5U2DvVIKuxziFGN6bwSdq6Z0edAOsekO2Iu0JMKBbXCoNypzikh3BweBKQVEZ2zgDPecGnuSVsNrfQ5ygFSgkDcnA3p1TKm1FKsZGxwQR7xXpC0/YeELSbtrAKG2W4MHfz7S1f9PsrWxfsWtAWtAduMu9yUoGVqkTEMIUPPhQnHsNNZ8YPDNnkVphTikpSN1bDJwPeaflwkwlpQuRHXlIOUOAgEjOPWOR869d/cn0C6YIMhnTCnEpwUyJZlrPrTxKz7qmMdJvRPp7P2qixgoDhH2vsxTkeSihIPvrqxRzTX+nik/0ZLw88yR5Ag2G5XRSUQLdNmKVskR463eL1cIOa1cDoQ6Q7mEmNpC6pSoZCpCEsD/6ik16Pl/ZG2BgcECzXiRgbcRaYT7uIn6KppX2RNydClQdLxWk9y5MxaznzCEAfTXbD2dr8n5cNfFr6oW3Eusjl1v+xc6QZu77NogDGf5TOCj6sNpVWT170V6j6OpDTd8itBh/IZlxl9Yy4oblPFgEKxvggHG4zXY5fT1rRzttN2aOE9oNoiLXxkfJJUsnB5bYPnW+6XY7Os+hG4XBDLZV6Azd2QFZCFICXDg/klafOsdVpNVo5ReoSqXkCjjmns6o8VrTjNNkVJeA4jimO+spxp0ZRfA2aKtA3ou5uaZf1IrqG4DLqWe24AtajthKe/HfVARg4qJQceoQyxne13QkUdG2hTiwhAyTsKelwX4LxZkNKacTzSoYIqafUvcrruNDka0Kz2leus73EeVaFfxzUSZcRmUf5JJ/sj/qTVGo1dyP9jl/2J/1JqiWazbOqD4BmhmkcW9OsNF5ZTxpRhJVlXLYcvXTVt0jRK+As7UtDikBXCccQwfMUgDfB8cVqLnoZ+2aQtmpjc7Y+xcXVMojMvcUhopBJ40Y25fSPGtIxbTaLUG1ZmM0eaV1ah3GnepKhnAHqrJ5EjNySGQe6nFYUolCSlPcCcke2lhjvpxqOt1aUNoUtazhKUJKlKPgANyfVTWVUS5oZCSaWGzWttnRzfpRT18ZiBxb/wAufDasfkJ4l/5a1sHoOdlBBd1jp6MT8YFiUeH3oSD9Fc0/aOGLpyX7nO9ZiTpyX7o5QGzttSQgnOO76K7uj7GefKjOOW3V9guDqE8QaDLiAfWQpRH+GtbqXoPs6+jKLZ7amEdQWxoLTObAHpUg7uNrPPhXnCc/Fwk8gaX+ZYlXJp48Vy2eWTtRZp59lbTikOIW2tJKVIWMKSQcEEdxByPZTPDXppXyjdOwZoZ3oEYoBSuEpyeEnJHnT2sdgz2udGTSflUN6loYsHzpxtVMpNOoqWhotLefgF/l/qFPFVR4GzCvy/1CnVVx5epomVt1V/K/7iPqqJxU/djiZj/lo+qoeawCxzio+KmuKjznYUmOx3O1LGcVIuFnmWqNbZEtsIbuUX0yOQc8TfGpGT4HKD7CKO022berjGt1tiuy5kpwNMMNDKnFnkPrJJ2ABJrNTUlcSunUdt9pl3BXCw2pXdSHGFMOKQsEKQcEeBrvFg+xi1oIxanagtFqbdAKwwHJDg8RkBI9oNaGB9iNaEH+X6quklOc4jRGmsjzzx1zKU3J7qrsaSniSVdTzUyEEb5zTwRv8VXur1Sn7Hnor06gO3Z2UscWyrhd+qHqwkoFNFn7HnT7mCNIOrz4qmEEf48VTjb4J8dI8uhTeQnrG+I7BPGMk+qre3aWv11wLdY7vMycZYhOrHvCcV6UR049FGnhi0Q1kk4P2vsvVe3KgjIqFM+ymswBEDTl4kEHA9IkNNAjx2Kz9FNYJPsJ6tHnq96Ov+nG0OXqyXK1trIAclxlIQT4BXxc+Wc1T8IddSyw0tS1HCRgqWs+QH1AV7P6POkS19LFnujEizmMI6ksyoUhaX23WlpJBzgAg4UCCNiPVXlWe7O6O9b3eFZ5ao71umvRkHZfE2lZ4AoEYUOHhzUZIzintXPq6+vyNcOVTdSI+odHTtO2+0PzGVNOXBhbpbWCFNqCviEfO4SkkeZrOKGDXW9edKou+mLXDi2+CZU6KmRLU+yHUxlbp4WwrYKyFHiOcDHjmuSKUrJzvmuT2Vm1OXDu1Madv5v/AM/k6dTHGpe4IJoZ2oYNHsBXrJnJQWd6BNJ4u1QJqrJoVxbVNgf7O5/aD/TUDO1T7fvHc/tB/pqMnQcOo4vnSBS186SOVczZqJIoiKURyoKFKxUWIos0AaKuU+QDJ2pOaM8qTQSyvvhPURvW5/01Tk7Vb3w4Yjetz/pqnUdq3h0NorgMGlg700DS0nJqwaLrTum7zqueLdYrbIuEtSSrq2UjspHNSicBI3G5IG9bRro61P0Z3G2aivjECMmLKbcLIlJccSAoHJCcgDbxrb/YoXqFHk6isykIE6Q21KaXjdxtBKVJz5FaVf3jWX6eNRX+Vri82i4TXkwIy0iNFR2GgypCVIUQPjqOTkknfbuqscNzo2WKKx7+53P7I2Abn0UXJ5tZKIb8eYUjcLbDgBz4jC+L2CvIZUtGUhRGNsA17G0q798HoQitPHjcuVkVEcPf1gbLefXxJBrxygFbKF7cSkgn143rr0y6o6NQk2pCQTVjYLBL1A+tLLiWGGcdbIWCQknkkAfGUfDbA3JG2axRCTW50pJQ3puIlvA7bvWY+fxnOfZw+zFdiiYUSo/R9Z0ow9Nuby8fGSttsf4eE/WarNQ6MatEBU+BMkSW2yOuaebTxISduMKTjIBxkY2znNaREvbnS33Q7ClJIB4o7oIPf8GqtFGgOYg8KjmrjT13NmvNsuSSQYcyPI254Q6kn6AazzTpU02SSSUj6qeJ61lbadytJT7xinKNpozfDTPY/TLerhp3Tke720MqXEuDaFpeQVJU24Fo7iCNyncGsBauniXHSPS7HHcVjdUaWto/5kq+utbqyUNWdBT9xQErL9lYnpxyC20ocPuKFe6vOTVxZS5wKB586+by43u4OT2ply4ciljfU7450z6SvLfV3rT0x9sjBS+wxKGPac1Js2kOifpEYni2adaaU0Eh5bbDkRaOPOCkg4+SeW224rhKHEqHEnliu49AEQN2O5zcdqTOQyT4pbbT+txVRFyvkx9n6/Lny+HkSa+B5i1hZhpzU92syHS8mBMejJcIGVpQsgEgd+AM+dUqo6y0H14bZPxVq5L8kj5Xs2860Wprki66guVxbQmUuZLflBSkkjhU4pQJHfsRz28fCs7Ledlv9Y64px04GVHO3cB3AeQ2roi7OpP3nQytaOqbbSylCklRLmSVLzjAIzgY8vHerOET6K3k/O+s1VutqbcUhRSSk4JSoEewjY1aQv8AY2/731mtkW+gtwmqy8H+Ts/lr+pNWbnKqu8/7Oz+Uv6k1vifJpi6lKo70gmjUd6Sa6DvSFA0obmmxW36F7Xar10o6ct96abegPy+Fxpz4righRQk+IKwkY78476q6VjqyutmidT3aAZ0DT11kQ8Z9JRHUGvXxnCSPUa9ndEU1w9D9kVCaQJEaC4yhpzZPWtlYAV5cQGawv2QGvZNmkwtOwYjjhmxC+pzjCUIQFlISkY59k53AAx41M+xjvUiRpC5wZKuNVvuXGnOPiuICse9J99KcZTw+IyIyUcm1HFp/Srre/8Aw07VF2AcSFFlh8x2xkcglvhGKpjJcmr45LjklY+U+suHPrUTT+rbUbDq292rcJiXCQ0nPzesJT/lKahh88CBsOFPCPVX3WghjUVKEUjGV3yW1tYkzJDcSEw468v4rTI3I8dtgPM4FayP0c3yQgKcegMHvSt5SyPXwpI+mpnR241H02l5GOskPOdcrAySlWAnzAGDv3mtcmf4KrunqcidQJ2ruc7vWkbrp1r0iSll6NkAvx1FSUk/OBAKfWRjzqt9LUUBBUSByFdbD7MvMd9AdZeHVrQeSkq2I9xrib74YUtCEqQEFSML+MACRg+e2/tru0eolkTU+qIlFdie5K428JxxDfNeg+i9xGpeiGLa31cYXHlWtWd9gpaBt6lJ29VeYFTsJIGxruH2O9+Jst3t5XhyLKbmoT+I4jhJH95r/NXj/wCJorJpk12af9P6lYXtkeZUx3Fq6nhIWgYWFHh4SNjknluDRlTUVI6oBxwj8KeQ/IH/AFH2AVda4t4t2u9Q2/KWWo9zk44xkBJcKk7d5woVRukynerjIWri3Kl/GV5k9w+qvmL3LcupnJVKn0Izjzi08BWopzkJycZ8aT1auHiIwPPvqaplMUdopWrxxsPV4+uojrhWck5rOcK/MOMr/KJQrgGQSD3Yo5Mx+U4FvurdUABxLVk4HLemzk+NIUCDvWMpOqNVFXYoHOa0K91Gs4PCtNwZOcVzykVdEeQP5JK/sj/qTVCrc1oZSQIco93V/wDUms/nBOOdZbjfHLgJEdapCGTlC1qCcKB2zy+ulFBQSk7EbEeBpPxx2sYwck8gK9B6L+xNn3a0Q7hfL+La5JQl30KPE61xtBGQFKUoAKwRkAEDlvUTzKK5NNz7HAW2yo/FqUyy5krQ3vyJA3r1fD+xi0DZGw5dp13lJAwTJlojNk/3EpP+anjpjoF00eF9nTC1d6XpSpasj8XiXg+wVyy1fkRKbXV0eXWUR3WUpdW0hzJ2KwCatYWl5s9GIdsuMrzYhuuf6UmvSn33OiXTiT9qILJUByt1nDecfjKSj66pb39k9DCV/avT8p9OOyqZL6sn+6gK/wBVcc8r8zhySgus/v8Ak4ZI6PL6zIZYlWyVbkvJKw7MaLQCRzIScKPgNtz3863mmNMRLGx/I0kOLHC5IUfhHPb3D8UYHr50JeoRdUydU6gk9W04QpwoGdz8RhlPNWAMAeRUcZJrE3TpJv14lei2Yt2OMcpQW8KeI/GXjn5IA9vOvPySzai4p+6jyMvjapuMXUF/J1pMYQ0hRSGmzuVKPAPedqdRe7SggLu1rbI5hU1oH/VXmq9elpnvNz5Lsx5JBLry1LKwRkHtZPI1BQsIBJSnA3O1OPshyV7v4NIex01e/wDg9eJu0JbCHEyoz6T8RTTqV+4pJqvm36W26Ho8txLhHCo5yFjwUDsoeuuY2W7WrQ2jrYiU5wy5bPpS220cTzql4VkJ2wMYGVEDaqKf0q3B5ZTb7bFjNDkqSsurPrAKUj6a5cXs3NOT8NOvPocK0eacmsfRPr0LrpN0ymeHdSQGwl/405hPJQ/pkjx+cP73zq5yiKtSQQlRyMjAzWnj9IGpONK1yLWlPzDGBz5HGdvbXX+iJWhb1pf7X6jZ0c9KZlL6pp3gQsNqAUkArwo4JUMZOMY5Yr7n2PDNhwuOpjaXRr5fofRez/GjHw8vbozzsuMtPMHFNlvAydhXsR7oF6PLyguxLc+yCMcVvuK1JSfUStOf/wCsVnbr9ixYHMmBqG7w3D/+aYafH0BB91el+I0zdW18V9LPS5PLfVkHJyB3edJKa7zcfsVdQoUVW6/2aWnfHXJdZUfoUPprnWsOirVmh+qXerUW47y+rbksOpeZUr5vEk7HnsQM42q4wx5Go45WxoxiRS07VKcgOtAgpKT4d9McBT8bnU5dLKHVFosLfuwv8v8AUKcVzpFtwY6z+P8AqFOqG9eNmVNlJlLeTib/AOWj6qg8dTL2cTz+Qj6qryawQWOhVXWlY+n5l4ZZ1JPmQYKlAKdjNBZG/wAok5SPxgFEeFUGcVqGtB6lh2FeqZFrUzbYjrZKnlBJV2ufDnPCDgHzIA78c2plFQ2yltvhdLv0vuaY027SujsvTCNAN2Kz2ye5LjyIzP8A2YLUhDqm2MAdrjISWzwjHaySCR31hOgaW1D6WbQ8hawlK1IbUsAEhSkoORkgZSsjY99c9ut7lXdyO5JUSpiO3GSfxU5/WTVz0cTXoetrS6yrhX1igCfHgUR9KRXD7N0EtJg8KU3J+v8AQ21GdZJuSVHqz7IbXWpNGWizpsUswEzpDzUiShCS4OFsKSlJUCE5yo5xns7YrzjdNeanvCVouGpb1KSrGUuTneE/3QQPor0T9k7B9P6NGbihIKYlxjv5J5JcCm9vziRXk4unxr1dOlt5POyNpllb7dJvtyRDhRUSJTuVkrCRgDmtS1cgO8nxHMkCto30WXEoAVfrcl0j4gaeKB5cWP8ApqN0XKQ1DucoJHWqfbYK+/gCeLHtUSf7o8K3KZmSN66lGznc6OS3mzTtPzjCuDKW3eELSpCuJDiCSApKu8ZBHcQQQQDUZp0jka3/AElNok6dYmKGXospKEr7whwEKT6ipKD6xXNEv4Oxqug7s7z9i/cEp1Nf4m5U/bmXM+SHlD/936Kl6l1Do7TvSVqi3atsSZjUiU1KadVbmZKQlyO3k7njBKgrkDWQ+xsuIY6S0NKXj0m3SmgPEjq1j6EKp37JCII3SMJAB/ldtjOEnlxJU639SU++vPzK8lHbh6GuRaPsetQhJEmJanVgDhEmTA4T4YXhGai9In2OdotemJN/0ncJziorJlLjSnkvofZA4lFtYAIPDlQySDjG2c1xFlxwlICjz5Zr1FEV9zf2N0dSOscUnToDaSklRW+jCU4G/N0ACsprb3Nra6M8nuNpQCSoHwx31HOVEJQCVHkAOddj0z0E3C8RE3PUb67Nbko+BhtBJku4+dnZsHzyryFZzVNktunnn4MAtNhG6sL41AeK1d3q29VeWvbOHxfAi7l6dF+p60NE8kXO6SOfllSD2ufhSFYFPSpCOtKWsrHeojA9n7aiKUTnNexCTatnDkSTpDoO1WFuOY7v9oP9NVQV3VaWveO7/aD/AE0ZOhEOo+qiSNqWoUEjauZs1GyOVAilFO9ApqbAlg0WaSDRZ3rGj46hZO1JzQJ2pOaKEV99PwMbwyv/AKapidqt78fgI3rc/wCmqUq2roguDoguBYNKBxTQVtR8XnVUNo2nRNqdOk+kSx3R1wtxvSBHknOB1Lo6tWfIcQV/drqP2TmnnGbja9RJSeF1CrbJPcHEErbz60lwf3K898QUkpVyIwceFepnXh0t9ApcbWHroiKOIc1CbGxt61pH/wBWrg9rTN8S3QcC2+xfu4kdG5guKyu2znGwPxFYWn/qrz1ru0nTus9QWkApRFuD6G8/MKitH+Vaa6N9ipey3frzalE9XLhpkIBPym1ju8Slw+6qb7JW3Kt3SW5KSMIuMGPIzzypILSv/TT/AP0a68XGVrzNJc40crcXvWp0pKZVaQw06FPpdcW418oZxuB3jAG/rrHqXxE00lakKDqFFLiDxJUDgg929diZlR070kpA7qEi9MW+MqRKyWh2eAAEuE/JA89+e2M1XolJlsMyEfEeQlxI8MjP/wDFQL5EduEFKWslxlfWJT8/bBHrxuK0FRmG3ClCU+AxjwqQy6QrPfzptdquLIClwnuEjIIHF78cvbTKlOR1gONrbURkBaSMjx3oJlGz1v0JvNaj6G2LW6UrShUy2KBOQElasA/3XR7MV5l4nGVht0FLrYCFg8wpOygfaDXbfsX751tg1DbOLtxpjMxsZ7nG+En/ABMj3iuV9IdtRZ+kHUMJIwhE91xsDuQ4esH0LrypRrIzLXQ3Y4y8h6E5xMgeyu+6JnI0z0Lu3UqCVohTrhvtg5c4f9Ka86QZPA0VZxwgqPsGf1V2rpHmq0v0KptfxHVwYMDCuYWrgUv3BDlcUo1I8z2XDbknL7++DgHoiBEYclvmFC4QQVjielEDmhvbs+ClEDzNVU2XHWvhiMFhrGAFq41q81Hln1ACosuU5IfW884txxZypa1FRUfMmmVOFRAAz6q1hjrqehDD3Y7xA8quIAzDbx+N9ZqmSkgAqBSDyz31obSzxw0YHer/AFGrlwGR0hDidqqb4AGGB+Mv6k1onYquEdk1QaiQW0MDBG6/1VphlyPBK5GeOOLei2zuTw57udGvnSTXUmemg9u7NWFkuEmz3OLdooIegPNyWyPnIUFD3kYqEzw8SeP4vfitBFv0S0sSWYbRdRKb4HA4OW2Nj7a1hFPqzLJklHiKtnoXp5THv+mLBrG3kKabWlxKxvmNJAI/wr4R76q/sZ70mPqa92lTm0qE2+kfjtLwf8qz7qV0WTWdc9C9x01IUC5BWuIhPeht0Fxr/C51mPUKwfQvdHbR0pWJTuUGU4qE8k9xcSUEf4se6t8UbxSxszl/+ikXPT7BNv6TJj+MIuEePLHmeDq1f5mj7658HvGuvfZMxCmXp66d7jUiIrb5qkOJyf76vca4iXzjavovZuf/AEIp9i5Lk6V0eXDigzIYdyptwPpbx8VKgElWfDiAz4beNa305QGxrh0We9EeQ+w8tp1GeFaFFKk+oiuiadu8idZY78l0uPErQpZGCrCiAT54r1I5EyWjZM3JLGXnXUNtt4Wpa1YSkDvJ7q5HcZbbk2SYq1Osl5xTainBUniJBI7tq02qWH7pbGmYp41NvBxTXEBxjhI79sgnOPXWLfbkQApuTFeYLmwLiSMjwB5VtjyqFk0JU/lZUrJJ39db7oNvnoGtnG3XEoblwHmjk4BKShaR/lPvrPaL6P73ryaqPZ46XENEekSniURowO441DdSj3ITufVvXVk9EPR/oFxqRq7W0pucpPEGWnxDCh38LaAp0p887143tHWwleG7fpyTXc5v04wUHpDlTk7tzoseRlIG6gjq1Y9re586wfXrZRwNoQhI3PCOfrPfXoCfbehHUakId1FcEPNp6tp1+XJa4U5JwFONlOMk86z2rvsfJEa3/bPSV2VeY5HGiK6UFx1P/KdR2HD5YSfDJ2ryoy2JRkmv0Mp+8+TnFh07GusN+6Xa7M2+3sOBpaj23nFkEhLbQ3USAdzhIqpvcm3GSpFpiuRoiQAnr1hx1z8ZZ5ZPgNh586iPKcYdWhaFNrSShSVJwpJBwUkHcHPMVFWSo0ZJpRpEwwvfuk/07FkxNtCbFIZehyl3dTwLUgO/BJb22KfHn7xuMb1RJJ7zSktLXnA2HMnkPbSVqSnspPEfEcq5Mkm0rOiGNRbrv9/og0jetY20cDasoyOI1vY8UqaQQOYBrgyzojLPaVE5spgS8/0f/UKzfEUKOBnuINbK8MFFslkjbq/+oVi3lcJ2rn8Q1wztEmOlooQhSAFLeQOI9yeX1nNe0eky8Tbz0MvXm2Sn4zjsaJMWY6yhZb40F1GUkEDBOd+QNeI0uqX2DkA17F6KXk636EW7S+rKnY0q2q8iclP/AKifdXLmfc0b6rzPO018E5eHWLOMqc7ZJ8cnNQXbgUJPa4Ejn3CjmPFTbZUCFcPa8ld49+aasam3L/bkvAKbMpvIPI9rb6cVxJcWzwVDhuRcx9K3eW0HXVMRAoApRIUeMjzSkHHt38qr7tZrhakpElCFMrPCHmVcSM+B2BB8iK3S31LVkkknc+ZpmWyiaw5FdJCHk8BPh4H2HBrmjnlfJxx1Mk+Vwc/udzlXJuO3IWOqit9Wy2gYQgYGSB85WMk8z6gBUW1uNsXiC67gMokN9YTyCSrB+gmiUo4IVjiBwcePfUN85Ck9ygR769CEVVHr412Nb0q6bVZrjCf4cJdQ4wT+MhQI+hf0VhXmCIy1cjt9ddd11ebbqXo9iTVSGRKZTGkdtYCus4Ah1Pr3Vt4gVy6U9FVDKUPtKcJGwUPGvS9nSTwuMuqNtNOW1LydGg0fpI3LTsqesKT8K4Eq7yEIBPu3rMxyVhJPMjNdj9GGnOg2NM4FJdkxOraWOSnJK1Z38kFX+GuQN4SdsYr19Fjt2bRbcpP1JaDkAD3VprdozUDrYdENDCVbgSnktk/3Tkj2gVE0MgKvyHerKuoaW4FdzatglXrydvOulNSspA7q+jwS200VuowE603SxFC5kIx0qVhDzRSUKV5KRtn14NWVs1rqG3D+SX+7x88w3NdwfYVEfRWzedZkwpcaQnjYdjuJWk9+Ekj2ggEHuIrjzEsqbQoqySkE+vFerh1UZe7lV/E1hKzqsLpr1zBTkX30pKO1wy4zToVtyJCQrHqNeg7q9ab9ohLupTHi22fDYXKLi+FLXWBBGFHkQpQwe44rxk247I4mm91uDq0jxKtgPeRXpH7IaWiy9GCLaggB2ZEhpSfmtgqPu6sV5ftnBp3lwLBFRbfLSry+0dOOTOfdLk/o3hwWoekXm5M1tRQ64wVLbIHeVq2Wc53G1cVde4j4ZNKkvKcCuBJKUDKj3CoYXk5Fcusy7YrHubru+rNnKy7tCQqM5/afqFSVsqHdSdONF2K7tnDg+oVcKh5TnFfK6idSMJZKZiL+kpuCsj5CPqqtNW+pUKTdHARjCUfVVQayT4NIuwZqx+6K7JsP3Pic6LUX/STFGODrfncs528araMb1Moxl+ZWWmzpnRB0Ky+k5Mm4Sbh9rbRFdDBcQ2HHX3cAlCASAMAjKjy4hsa1T+n+jTRrocsj02/XVv8AAPrk5Q2vcBWEpSjO/I8X01L+xp1NNRZ7tY2GHHUxZCZ4UEko4VAJcSVck7oSdzyUfCqyP0dQLVPlLnXlU+OmQ51MO3jhCmuMlIcfUMA4wCG0qP4w515uu1KxppzSO7R4fEl+Vs75rxmLqToJnKlKCG12RExC84CHGmw4k+oKRXi9ZOSSMeVe2tJxW9RdFLVreASJEaXbSnnwjicbHrwCOdeIVFSW0heQtIAUDzChz+nNd2jnujfnyefqYbZOPkzZdHlxZjrnxHXOBT/VONgjYlPEDv3HtD11t0yOEjeuLxVvCS0YxX6QFhTXAMq4gcjA766NZrjMkwUOXFlTMpKilYUnh4wOSsd2c+8GvQg+xxyj3HdfXmMxp5duW6oyZa21ttp+ahYJUrwTtjzPqNc4Qo8zWu1XZHLtJbnw1pW6GksrYUoJOEk4Ukkgd+4OPEd9ZlVmuiWnFLt8oJSCFEIzgY3O2abKiuDcdCkpy29J+mnnA40hyWGCVII4kutrQBv3EqTW8+yjabRetOTS4hIfiPsbkAqUhxCvqcrlti1XIkXqz3GW+0yYU+I/8GOEYQ4jKu8/FBJr0P03zl2RyyL9EiTIbsiTHeizGUutuDhSobKBweydxXm6zJ4T8Sro7dNBzaj5nmFPWKbWhAUVrSUIA5lRGAB55Ir1J01XJzTPRamBHeeZKX4UBDzaihXY3O45ZDVc5t+hNF6quECXYJStPXNqS2+bVKcK4kkpWFcCFblGcd2efxamfZH3aeNOWSBOjvxn3rk485x7oUUtY2UNlbuEjG+x2FcUNXi1PuxfPl3OueHJimty6GaidKtzTooW6XdHC424tsP7B1LW3AjjI25nfc4rD3e3zWI7cu65tzL46xiO4D176T8tLR7XD/zHOEHuzypFm1cvTcAotVuiouinFKN1fT1zjafkhlChwNEDmvClHuIqlWuddprjjq5E2ZIVxuLWouOuH5ylHc+snFcml0Cw5JzilFN3ff6JfHt2R25dVKcVCiOt3idUUgpTnZOckes0ACeZwKcdYTHUUrcQpwHBSg5Sn+93+zbzpLTD0hYQ02pxR5BIya9ZTVX2OJxd13CT5Vb2kH0d3b5Y+qq0xXGQQ6OBQ+SedWdqz6O6P+YP9NTOaceBqLT5JJFADajNGOVczZoII5UDRmjIpWIIKouKkBVJ4qKPkaHirai4qQVbCkldFE0Qr8r4GN63P+mqQmra+L+Ajetz/pqmUrauiC4OqC4QsKowaZC9qWlWaqi2h5tK3VBDaFLWdglIJJ9QFd4+xh1MuPIvGmHV4K0i5Rkq5haMIdT/AIShX9w1xG1XeRYrjHuMFYTJjrC21kbA8iCO8EEj21daA1cvTnSBar9IWA2Jg9KOMDqnMoc28krJ9gqVbfoLE5KfTg6PpVhOgvshVQ0/BQ1zHEIxy9Hf+L7AHh/g8q1H2VlqU5b9O3jgOWXn4Lh8AtKXEj3trqt6c7Qq06t07qJhRC/SDbX1d3F2iyr3qWPYK3XTgyNU9Dcu6NpyWxDuoG+wyOP3JdV7q6Yy5jI6q4aPJaQpbqW208S1kJSkd5rSW+0R4KMupbkvkbqWkKQn8kH6zv6qz9tWGbpGUvGOs4fVkEfWa1JC0kpKVZ5YxXfFnNdD3WcKQEgADkAMAewUrrSRUZbiWhlxaWx+OoJ+uoyrvBRsZbZ8kZX9Qqt6QixLmRVTqNhLtv8ASPlsrB/uq2P04NIVfmeIhmNJe88BA/WahzrlMnMKjpittIXscqKlHf2fVSeWPQW5Lqzf/Y4XwwNdvwSsBFxt7rfCTzW2Q6n1nCV+81P6e4QZ6Qky0ghMy3MPZ8VJ42if/pprn+iHnNK6rs97fWEIjTG1ODJ2QTwrzgfNUqurdJsN7Xjlrm6btt1ui4rT0dxTcJxCVIKkqQUqUBxb8fvrzM+WMZ23RlmyweKrOaWZKpctiOn+eebaPqUsJP0E10j7Ii+GRa7XDQQfSJzr/CnwQjhH0u4rFWqxXvS12iv3ux3WCwhfEp16IvhTjcHIBHPFR+knVKLtcbWu1yy4IcZWHmjuhxayTwnuPCE78xWLcZSuLOfTR22Y6Tb1wu1cSYy8AiN/PK9afkDzVg+ANQVucZPCkISTskHPvPfRvLSCQlJBO6lKOST30yk10Ud0Y8WyytEuTBlIkRnVNupyAocxkEHn5Eiuk6O0hcLhpl67R7dLegxnFIceaRxJQR2jnG+wIJPnXM4J7ac12Tof6QZehJ6XUhb1ukEJmRR/OJ+cn8dIJx4jY89uTUTrr0ODUyipJT4T7kaDpqXfWJTlpt02emIjrHvR2uLgTjPt2BwBucbVzzVKWn+qLCXOBIJJUO84/ZXpe6QvvZ3yHrrSKvTdM3LHWtNK7CUqOS2fAZ+IT8VQ4T55npm6ObbOgDXOlgl2yz+3JQ0MCM4TurHyUk7EfJV5HbHFlcHz1Xy816E44yx2+66r07Neh5kcZKTnBx40yRiru8W9cNwoVkd4BqlXsTXq457laPWw5FNWgBJKFLykAEDcjPu50uQGG5S0MPKeYCsJdU3wFQ8eHJx76Z7qUyhK3UJcX1aCoBS+Hi4R3nA5+qt4vsatdzq32PN+EHV0uzrWQzdoikJH/Na+EQfXwhwe2oesUL0r0jvy2RwIblt3BgjzWFkf4gusjZbiNM3m2XeA645KgyBIIIASsJIIAxvuniBB8a6d04wGlqgXSKSuO5lKF+La0BxB9wPvruwLY+TmyO2mjpH2RMNu5aFM9k5EK4MyEH/luhSD/rb91eZCvAJ8K9PupVrHoW6v47suwjA8XWkZHt4mRXlxa+DCkDPJQB94ru0UticfIu7NPAsTDSUqncTruAS0DwpT5Ejcn3D11fxZKGGkNNJShtAwlKeQFU6ZYk4ebyUuDjTjwO9KLxQMqIQPFRCR9NevGaXQC7M0+NRVwH9S3W2achqSJFzkBAWoZDSRupzH4oCj6hjvqoXd4TXx5rIPglXEfozWx6EnEXTXNyuKMKTBtvVMKUMEKccCSfdxD1GsdRqfdqL5fBEuFbOkaz1fE6L9PwdI6PxEkhjrlPlIWYjJOOuUDsp9xWcZ5YJ5BNcT9MLs12Q4px155RU488suOuK8VLO6jU3XFxeuGpL7NWolTtzeY8g2xhpA9m59tZgPFKs5OavRYY4YKVcvmzhzNz4PQPRdo+w6r0+XLjBS8orLSnONSVJUOfCQRjYpPtrM3du6dDGqHE2t52VaJBD6obhw3Lazg7ckvJ7ljntnIViqbo16VZOi1SWFMNyIkjCy2skcKwMcQI8RgEd4A7xUrVdxf1VppV1dfL8iK8t9aickoUOFWPIYScdwHlWc8WSWSTm7g/v9KPPcniaS7k7pk0hbtT2uLrax4dcdbbceUlOPSmF4CXCO5xJKUq8RnO6N+Ry7fDtcdJkEPSFJCurQeykHlk11zo+uBm9GlygvnKIr0uOnPchbaVgD1KcUfbXCZlzWStrhQrBKeIjJ591cdwwwcpLrdfod8FPJLanwvkMypK3zhWAkckpGAPZUcc6RxknJpad1CvGy5HJ2z01HaqRPgsFage4V2OVpqVYocNVzjOQ+uZS4jrhjiBHd+znXJ7ScLHlXpHor1LA1bY1dHGryHI6uzbJSl9phY+KgK7iPkH1pO2BXjanK92083M989jdPt5Wcq1ZDSxaHkBt1K3mwW+NtSQsZBykkb7b7VzSRGWlRyDXraBY25KZPRPrhxQUlXW2O5YzwHfhCCe49yfykfNrhetdBXLS90lWy4R+rksHORul1HctJ70n9oO4rlhqGl73/AI/IMWV44q/g/R+TOaoRhYBJAJ3PhXpv7GG9BGnrnAUv8A+3KSM/lIVj/Aj315zlQlNq5V1j7Hu4KhXp2JnaQh9kp8DwIdT/AOmuqzyuNnTkyJqzK9IUJVl1ffreEhKI9wfDYAwOBSytOPLhUKzDErqZLLp4j1bqFkJ57KB291dF+yAhqi61MsJPDcIbD2cc1IBaV/6affXMoseROfSzGaU66d+FPcPEk7AeZ2pQSaszUFzJnTIl5iXRLj8R0qSleFBSSlSSdwCDSpVwRFjOyl5UllBcKR345D2nArPWG2P2duQZLjRW8UdhtfEEhOeZxjPa7vCrF9TT8dxl5IW24kpUnOMg1wyxpSpdDxZ4oRnUeUYV2Qtx1a1nK1qK1Y+cTk/TVzpTS0/VF1YgxmG1uvJLwL6illllPx33iNw2O4fKPuL8iy21LSloaWFJGd3Sc++t10eEQtGSp5AEm9XBbLi/CPHSkIbHgniVnHkK6sufZByR6b1MVBzS6Gu07pbTGnS2uHb497nNgD7Z3VgOb/8AJY+I0nw2J8a2Ru785vqJzdufaPNty3MKRj8kp3qDY9G3ydp1N9jssrjrQXUNBzLziBnJCcY7iQM5P0VddHun/uknCfJRm3RT38n3NiE+obE+weNeTWonNK2rPPi9XkyRjbW7p2VfQxmreiS3Xy2Ox9NIZs86QeNEFl5abdcljfqy0onqHtuyobZFec50AwnikpcRhSkKQ4MLaWk4W2sdyknY+Ox769ha5utsb1C/Bt6Oq4QEyXEHs9fniBT4KScEkd+3ca4H01W+NI1uZ7ASz9vbWzc3QkbIkpUW3CB+NjJ9dfTexNfOOd6fI7PW02o3Tlhm7a7/AH9/Mw+lro1armS+opakI6kq58KuIFJPlkYPrrfIlqbUQdiDisNB022VturmryhSVhPVDBIOd9604eClHJO5zz3r7fHNo6XTJF9vUeDbJCX5IaW+w4htAPbWSkjYDfGTz5edc4ad5VM1DEnuXaU+uM8tK1AoU2hSk9WBhOCB3Acu45qvgKjl9Jk9cpnfiDJAUTg4GTsN8Z8s0RztyNYpJGx6Obf9uddWCAUhSHrixxg8uBKuNX0INdQ+yrvKhF07bgrdxciatOeeyW0/Wv6ay/QdHgzOlhD9vYkNwosaTIZRIUFuN/BhAClDYnLhGfVSPskZabn0kRoS3Q21BtrDalBOSkrKnDt3nCk1nnySyamCXZfM3h0ORKd40YWSccgOQpLec4xU+6PWslLdrhuIbbSEqefc41uHvUQOynPcByqC2e0BXDrJ7Hy7NHwdH6NtNT7xa58iNBlSG47qesU02VBHYzvjyB91aa22B6+QZ8qzR3J7MBsPSQ0nK20HPaCTgq5H4oPKs/0P67n6D1E1cI3G5GWOrlxgrAkNeG+wUDuk+O3Imu4XuMjSl2hdKWigJNjnjM6O32QApXayPkgq/wACx4E18nqNQ3Jvy6/DzPKzTuTlfC6+aXn9Ty5qdgPzXn2gS0sJ4CRuQBzrOraUk7g16b6Xeju2zIA1xpZCXrHP7cppoY9FcJ3Xw9w4vjD5Ks9x24ZerGqG4pJwUkZSod4pQ1O17Zf+m+HUOMvDn1+a8zKcNdT+x66O7Vr3Vkld9QXrba2UvrigkCQtSilKVEb8IwonHPAHjXNHmi2rGK7l9ik51d31GPGLG/8AUXWftTVywaSeWHVfU9bTx3zUWdX1jo+6QYoRZW2l2JvdMCCwGhFHm0jZY/HA4vEd9YCdgxQpGFJxkKTyxXfGJakLyDgjvFZ3VOiYWog7Kg9TDuSweIHZmQfxsfFV+MPaDXwEdVDPPc3UvmfTYM7xR2SXBW9Ed649LyGCrtwp5cwT8lYSsf5gv3V5P1zbDZdZagt3CtKYtyktp4ufD1qikn+6QfbXonQTM3Td9ulkuLSozzzLbhacwFZQpQz5ghZwRkHuNcW6dYqonSZd1cKUiYhiXt3lbKQT6ypKq/Q/Zc7xRvyr9j5z2hFeNKu/P7jOnIaLZbUPJwZEptLji+8JIyEDywRnxPsqwMiq2DOjqtUV0vtJQGEBRUsDhISAQd9txTDl+tjZ/wBtQv8As0qX9QxXsqSo4Nhb9aaQVHIKSQfEcxVIvVUQbMR5Mg+tKB+s/RRt3S8TlJ9CtAAXulTpUQR48R4RSeVIpQsh3iN6PcZCUAt9agOowORUDkj+8DXpTpYmjUPRdp++/KU9Ckk893mFJUM+tf0V57VY7jLWJVxnRA9whIS0Oy2kEkAYG5yTvn2mui2G5ah1XphnQVnhquSmG2E8eOFLCULCkrcWey2nAxvkkcs15msyRlFo7dNBxkpeRURMBHGpQAG+ScY8/Kux9Hdl1JqS3Lj6jitTNJvtK42rsjiW7t2S0D2gkHfiVj8XxqZozoosujENTr883dronC0NBHwDJ7ilB+MR89fsSK1c+7PTThauFvOQgHb2+Jr4nV63Bp3d3LtXb9T325Z47Irjzf8AQ809M3RXbtA3KJLtUt52zXEudWys/CR1pwSgOH4ySFbE9rY5zzrnT63g2Y8dJZaWd2ms9r8o81HzP0V651ZoJrpIbs0ORJTGZhyHX1r4eJZBQBhAO2T4nljka5nr20aK0WyqPYH0ypYVl2QVB0ox3cfxSrySMDyr0dL7Yc8MZSjuk/v77mMNLFvZuo41H026hpMq48UZg/FTjC1erwq1k6xTB00uw2u3xYrTrwedklAVIcI5Ar7gPAeNUl6vLkuSpa3FKHdxKyapnH1rJ8q9mOneepZ+a5rt/f8AU5p5Y4rji/fuSFPKXuok1bWc5jun/mD6qomgVDJOB9dXdmIDDoB24x9VdeRJR4OWLbfJONBPKgo0STtXKWA91BVETkijJoERAuk8fOmguk8Vb7T5WiQpe1ILlNle1IK6e0KI17VliN61/wDTVOVbVZXheWWPWv8A6aqSratoLg68ceELCqUlW9NBVOtNqccShAKlqOEpSMknyAqmimhzO1OdQgxkuF9tRUtSFMjPEkADtHbGDkjnnINW7Vht8NhTt8uoiO8OW4cdAefUfxsHhQPXk1X3CTbg/Ibtcd4RHAjgVM4VPII3JBTsMnPjtislK3SOeORSdR/ft9/A9BXGWvpD6BEzytTtwiw+2obqEmIc8XrKEg/366Nowt626IRByFpm29+EM/joJRn2OI91cY+xwv6XEXvS0g8TbqBcGUnlsA28n2pKD/dNdR6BXVWuz3OwLcUp60TFM4PPDa1JB9qOpPtq74Z3J9zyguMsgBxKkqwOIKGCD3j30+zFmy1BpL0p0qPCEha1cR8AO+ulaxssayavvtt9Gjp9FnvBslAzwKV1iP8AKtNVca6yba8X4j647oQpAW0eFSQoYOD8nbvHKtZ5nXB8/l10oZHjroyhi6Fua5saGq3yWpErPUpea6vrAOZyvAwMHJJwMb4q3T0dqhuf9r3KLbGS0Hm3nFF5L6SSAWuqCusGxyQcDG++1bFdyttoiRYarkxcmUolNyzGUtx1bkpoJdcQpSQjCOFAAKsrIUduLavb1Db4DFoYTEcuTVseek8UgdSlxa+EhPCkqISlSArc9ok8hXHLPN9CZ52urK89HkS0FxVykxHyzO9EcBkqaYA6pLgUpzhJHFx4AIHxFg7iqqdY5sC8OWiNHcTMMjqG40cJUVKJwkJUB2gdsKzgjerCXrFaJDi7clqGqQ2pl9DC1vmTxklRcCyrjUSTzGx3ABrU9Gcx1Kr9rm48ciewtNvhLkDtB9SRxrIxtwpwkDuAI2rHLnnji5yJlK1ufRF7YNFWfQK213Flm/amAClpePFEt5IzgD5a/P6u+7naov0lWV3eSykbBuOQ0geQCRWZjTw4ta3Xu0olSlLVuonmT51ueiZTMzWnbbDgZiuOIURkJXlAz68Ej2mvEuefKk31OCEp6jKoRdW6+/MzyNW6hhq4mL5OOOaHl9ag+RSoGqO96asXSKpSFxomn9UL2jzIyeGJPV3NvN/JUe5Q7/dWq6YQiDrmSVBLaZDDLw7skgpJ96a55cJjSmyniByM5BwR5j9tWnPDkaT6Fb8umyuDd06OO3m2zLXcpUCfHMSXEWW3mVndKgcH1+O3dvUDBBFdV6XEjUWn7DrNWDOcU5aLkoD8I80MtuHzUjn7K5Ut4KQ2goQCjOVjPErJ798bd2Mc6+j0+XxIJn0uKW6KaJsIZWBW2sastpBzj1Viba6jrUha0IB+UrOB7gTXb+hOVpe0BzUd9L8qTDJ9BgNMlQU6ACFqV8XO+E52BBJ5CufVK+GefrMXiSUW6XmdStaUdFfRfMOp/wCUyLzxdRZ3sFKSUYwod22FLPdsOfMujdA6PNAXPUWqn1N224JT1FtdSMv9kgHhPynBtj5oBPlkbTqSBqrXC9Sa/VKRHYHHEhIYU42cHKWzjkkbHl21HfbasN0zdIl01hekPy1FmKlCjEiBWQwgnG/is959g2Fc+KnJOPbhfV/QeOUU1KH+1NRXzb/ojn+p5KZLqyAEpTkJSDnhGdh54rJPd9TpktTizk1XOKzXrafHsikd+kxOEUgql223SrrLbiQo7kh9z4raBkn9g8zUIGrK1XG5RnFR7Up5t58cB6jPWODnjI391duJR3e8dGXcovb19TZK0jadMxuPUd7bbuGApNugo65aR/zVjZI8hv662q32NV9D6VtBS121C4/CsdodSoLRn1tKSPfXEEF99xLSApa1nPCOajXUug66pkIvtjfOUOsomJSe/gPVue9Cx/hr0I5otqKVI5I4JRTlOVv77f8Ap1LoLuSJ/R3b0Oni9ClvRnB+JxBf0haq86ahtS7Je7ja1/GhSXYx/uLKR9AFdg+x/fctlw1Pph89qO4iQnz4FlpX0LQayHTpbvQekKY+AOGewzL/ALxRwL/zNqPtrXHKpfE26HP2330N9Wh95CD8lKyB7qQU5UCoEk953NSLbLjQ5Yel29ue0hKsMOOrQhSsbFRRhRAO+ARnlkV0mNGEZ1gM2yLZr+u2ymjKisqYjxpTnCWGS4slKH+BK0lWQQXkpPaSTRPPtdUWlfc53b7RPur5jW+G9KeAKihpJJSBzJ8BuNzjnW96GX3tO64lWqe27FfmRlR+qdSUqS6khaQQeRIBHtHjUC+9XPXY4t/vSYNwciuovTyyXllCHSWEuJbzxvcAAAV+IVEYql1PeGHdSputonrX1IZDBSypsMJaSlDaQVniVhKE9ogZOdhTxZrkm0ROHutWbrUtlQ1qe/RHuJKH5H20jL7lNPAcRHkFgpPgaxM6C5CluNrSoFBxuMV1e03q19KdrYQ6+m33uMFKQtpIK2lkYUUoP4RpXykd3lsTn71orUjDZTItDsxhGyZFq/lLYHk2SHUfkkEDur28eSHhqE+K6PtR58ou7Rz9SyknBIq7sOpH4FvnR+yppST8c7DIIVnyxzo2tFXeasJYtd+eyfiN2txGPWteEj11sNO9GTduR6dqVUViMxhwW5LodCiNwqS78XhHPgTt849xxlmp1HkmWJSXvCrWPuQ6KHZcolp6Whc0pVz4neFLKPWUIQf7x8K4YtC0pSpYI4xxDPePGurdJFzuOtrW9c4a2kaft7hWlbyyldwd5KcSnG6U5wM4zk43yByVbinMFSicDA8h5eVeRrJ8Rj2XT182d2lh1l3fX08kG2CtaUDGVEAZONzUqTEet8x2LISlLzKihYStKxkeCkkg+sGoQ3NS4io6VKDyFqBQQjgUE8Ku4nY5HPbb115j5OidrldC2s+S4B411Ho50tcNX3xq027iBUStx/GzDYO7h9Xd4nArldtfSyviO+NxvXpiz6ls2huj1u36IkLuWoLqhC5VwS0Ww3kEnhK8Y4R2UjuJKjvXj6uFv3uh5GfDGc92T8q/d+iNF0nuo1jqCz6HsSTOucBX8ouLhytjCQDxLGOWylH53CBvVN066is6m7bp0yUTp1pQfS7m9jjSeHBbONipWylDuIHfmqhWt4PRfouWzp9z0/Uk0AzLpjLUYH5LalbrIJPd8YlRzsK4Jdr25LWriWpWSVFSjkqJ5knvPnXE4Smn5y6+i8vj6jmpZFKus+vkkui9X5scub8fBW1lSlK5EbYq36L74LVrGE4scKetbKiD3BYB/wAi11j/AExRVvlQ7hT8GQtma2+2pAdQeLAUOz3bnx35c628Oo0bLE4xo7X9kdblC2WOfjJYkPwnFY7lJStP0oX7zXKNKrShE/HxlFoE/i9rb313vpbjJ1L0USri12+BEW6JIHdkBZ/wuq91ebYcmTCfK45TxEcKgpOQoeYqca3Y9opQ34tv31Nc4/wjdVMrcWEcXIeJqjXcZzxJ9JQ2fmtpSk/tpb+nbot9tqXFkNvPp4m/TD1XGPEKcIHh7x40LGl1Zyx03/ZkiZcEJZWkPNlR2wFA+utNom9iTo5+3j8JaZrkpQHMsvBIKvYpO/rFZGZpt+2WM3R5baAHS31HVrJyHFIIUobJOUk4PMD1ZrbLqOXYLq3cYgRxBJbcaV8R5s/GQryP0YBrSWBZMbUTp/CqeKUY/bR6p6IOlFmyFNgu7yW4DiyqNJWcJjrJyUqPchR3B+STvsdtZrbpDt2mIarLpsx0S3Stbq2FApi8ZyTtt1iiSQO7n4CvM0C9QrsUqs0hrKhlUGS6G3Wj4JJ2WPbVnx3NCCXYS2G081uONobH94qAricskY7OnzON6nPix+D0fRPukaiRewykr4icb88lR/WSfrrAdJV4RP1axA61CTabe1BWrixlwr6xYz5E49lIuOt4ViXxwn2bpck5KFoJ9Fiq7lZIy6sd2MJHnXO1PKkurW88VKcWXHHVnJUonJJ8a7vZGicMqzSXC6Gns3RSg3klwblp5QAODjxG9Ool9rnWYY0/LRhxqQw0gF1LrjjpZEdTfBxBZP8AaIxjOSrFPPxdR25L6nA8pqORxuAodRggKCgd+JPCpJ4htgivsIatdz1thqW5pQcpUQfI4rP6jUly6pdGOJbCCvHjlQ+oCoLWopTJSX47awRkEZQSPHwpqVcjcJZf6oNApSkJBzgAY510wzxkTtaO1/Y0Q+K8X64Y7TMNqOk+bjhUfoaFc76X7mbx0nakkNkFtEwxkqUrs4aSG+f9w12D7G6MiJpm73N4EIdntgqHehlkKPu6w1w+HfbNwyrvcLSq73GRIceCZbqkRGuJRVuhBCnVb5wVJSPOog92WUjqx9EZwOoQD1YS6obcZGyfUP20GiSsefjTt3vcq8yeulFvYYQ2y2lptsDkEoSAlI9lR2lgKBA5V52skm6Ro0auxt8OHCoBO4PljH7for05oZkdFPRvNuOqlqcF3GY9lcxgkpOxB5KUN19yUgZ3rjXQOnTbd1kX7Ua1PptYDkSAhviL753CjnbCcbA9+CdhvuoN7g6s1jJ1B0iTsRIjfWxbWgFxLu/ZZTjbAwCQSCs4ztmvls3u5G+/y9WeTODjlcl+Z8LyXq/oa3oxP3C6Cu2odTKLFluASY1uWOIv5BGyT3rBCQO9KcnbeuIXqXARGfJQ0hrtdW2e31eTskE88Dv8qX0rdK121ZqF1UtPUxI+0SGlfZYQR342KyOZ9g2Fcyn3d6QRxHIHIZ5Vi9M57Yrohx0jntiuIx6ebE3BTSldiuwfYukIuuo1Z/8Aw0Yf/UXXD1ulZ3rs/wBjM71c/UfmxG/1rrm9vJx9nZf0+aPpPZ8P9aCPSDb/AJ0v0jB51Tpl+dL9L781+U+Iz6nwSdco8G8sttz2iVs56iS3gPRyefArHI4GUnIPeK89fZB6SvLNzt98fjpkW9MRMNVxjp+DUtLiynrE82lFKwN8pJGx7q7mqb51HkXZLTDqHUNvsOIKHWXUhSHEnmlSTsQfA19F7I/xFn0clGXvR8vocWp9mRyr3eGePGIUQutpfcCOJYSpfDkIBOCo43OBvgbnFa5nTFjeajzYE6W/B9MdivekQ0MuuhtlTpUyStY5I4TxDsFaM55VtpHQZC1hfhM0fObtNtbdImofSp1qGsdzSvlH/lk9nvIGBXWLT0a6QsSIrj7s+6yIaOCO5JdCAyOEpPA22EpGQTkkEnJyTX3WX/EOljjU769u54q0GXdsrocLsunkv3iILTYjcbdMhs3FZuElWbfH65TTpUtooSrJTlKzyTvw5yamax0s3bNGpuypEiC7Bf4OquCEoXLQ86vASThanWmwzxDHAnKgO1xE9ul6e0lJbSy5ZAptOQlPpLqAB4AIWAB5VmvvXaat2omNTaftyJU+MDi23SQp5pStsLaW4ThxONkrJSc/JODXHi/xLpsjrlM6H7Nyx5oxXRr0J3LUMRq86okPWSyqAW2yezJkjx3/AAaSORIKj3Ac67db5Np01bUWnTUBmBDb3ylO6ld6jndSj85WSay8zUj1xdU9KdX1yFFCm3ElJaUOaSk/FNZ6/axct70e3wWHLjd5hCYsFndSsnAUrHIbHHecHkBmvA1XtPVa2fhYlV9j04aPDpoeLnfT9v7nQV3DKlKBW4s7k7kn11EduCxvwL/wmsU7oZIV1nSLqm5zJitzYrE51TEYfNcXnBPtz5nnTX3G9G5Xlqxalt6u6TEvKy6nzwo4qf8AIV/y5kpeVN/yeRl/xZo8U9lff6J0SulbUs6DpSImDIW0JUwsO8BIKkloq4dt8dnl31wWcuRMVla1dWDwBatkDyB7/UM11fWmitQytNuL07qF7V1vguiYuHKaDdzhgJUknGMPJ4VEHY+VcMk3GVJUl92Q64vg4Ukq+KnwHgPIV9D7I9nSwY9tp9eUav2rh1K3Y3waxy1aPtemo90uF2lT7pJWvgtkRKW1JAOAXVniLYPPYcRBAxzxiXZCnTkgJA5JTyFMrcKleVJ5mvc0+neO3KTk359vRL7Zy5Mu7oqQ+lZwKurIr4B38sfVVQzHWW+MjCe7xNWtnOGXfygPorTK01wKF3yWJNBKtqQTQSrauWjSxRVyo1GmyregpVKgsrgqi4qbCqTxV2UfNUOle1JKs0gqpBVToKI92PwDP5Sv+mqsnarG6HLDP5Sv+mq0natYrg68a4FJIBGc48qkIlOICksqLSVDBCNiR5nmaiA1Mi+jhYL6+BHkOI+6iSFNKuhKtdrm3aQIsCM4+6oZ4UDkPEnkBVzqfRb+kYkZVxmRvTX8kxkKypAxsT//AMpDWupNshrh2BoW9LgwuTgF9ft+T9fmKzTr7jzi3XlrdcWcrcWoqUo+JJ3NZVJu+xyRjnnPc/dj5dW/j5Gn6NtSI0zrqy3N9XBGRJS1IJO3UuAtrz5cKifZXpDSr6rB0x3K3OHhReGESU55FxI6lwDzKm2Ve2vIhIVseR2r0RdZ9z1BozSOtbIhT92hscDoAz1igOqeSR+U2lXcd8g5wato748I2HSn0QX3Verl32wu2oNSmGkyG5T6mlB1A4eIYQoEFIR55FVET7He7OYNw1Fbo6dspix3HlY791FA+g0cbp8vaooaTpW7S5IT8Z6EoDPmsLQFb95AJ8TUWX0udIk7IjWaNBHcV9Ukj/WfpqKZy5NNglLfKPJqrZ0AafYwZl1vlwUOaULbYSf8KCof4qvmujfQNjHE5ZLYFDfiuLxfV7nlkfRXFZ2oeka78SZl/SwlW3Vslbhx78fRWenWm5NILl01FNbSefG4mOk/SM0toksUPyxX7HoC/wCqtL2OC40xc7bE7B4W4yQ2CcbDKQB9NcViXkL6NGX0Ekqv8svb8lKBKc+w1z+a5p6JxLTOEl7xBU6T7QMfTVhoy9MXGLd9MOuBpNzUmTBWvYIko5A+HEAPd51y6vE3jvyObV43kg210+/7nXuiLpJ07pNy6Lv0J14yQ0WXWo6XlI4eLiTuRgHIO3hXbtH9LGndcT3rdaFTQ80yXyl+P1aeEKCdtzvlQrxGic7FfWy8hbTraihbatilQ5g1vehrpBtejtbifeXnWIT0R6Mp1LZc4FKKCkkJycZTzAPOssTlCoroLSZMmJrHxtPSuuOl2w6FujdtubNyckOR0yE+jMJWkpKlJG5UN8pNcU6XemCza7tcKDbbVLjvR5PXGVJDYPBwKSUAJJO5IJycdmsn00dI1s1trJE6zqeXDjQ24qXXEFHWqC1rKgk7gdsAZ3OOVYFqTInPtxYzSnpD6w202nmtR5Cqybna7F6jJkm5Q/2mpvMr/wC56R1mMSNRN9SCefBHwsj6q5cVb1rdf3JllNt0zDf69izNrDzqT2XZTiuJ1Q8hskeqsdxZrr0UKx35nRo8dY78/tEuO7wmug6Tnli2IwealH6a5sk4NauxyC3AQM96v9RrTPDciNXjuJu1XhRTjjrGa0mF12Or8VQ+kVJcmHhFUOoneNLBP4w+qowYtsrOfT46kUTy8qO9MqNGs5JpJO1dx68VQBTjb6mj2AAfHG9NA0O+qUq6Dcb6jrjzjqy44tSlnvJrS9GN8Rp7XVomvHEdT3o7++3VugtqJ9XFn2VlgSNx3UXETv3+NVud2LbxR6EsKF2Lp16pfYRdoy2z4cZRwn/O2n30vp/sciZEtN6jRXXhHLsR8tpKuBKiFtkgDYcXWDPiR5VUaxv5EfQ2vWG0vraW28/zwSUp6xJI/Hbc99bVnpw0iloPpmyWlkY4U8IOPXxJP0CvUjK+UclNHDLf0f6uuZSqFpq8OA7pX6MtCR58SgB9Na1zor6TdQIKbxLIbUriKbjdus38ShJXvue7vrYzenm0urULfap89XcpSic/4Un/AFVTSemfU8gEQNPw4gPJT6cn/Mo/VTase5ojQfseZgAE/UMJn8SJHW4ferhFWrHQTYorRVOuN1fx3gIYT9RP01mZusdfXZCi9fVxEH5ENPAB7UBP01k7k4l5xSrtqF+UvvSuTxH3DJptqK5Ju2aTVWmdO2BaXbVdTHktnKUmWFHI5EEbpPmKj2/pnvltAaemCcE8lSWkuq/xgpV7yaxa5NjZUeBp97zGR9ZH1VXvT2VE9TDbb32JOTUS1rh+VopYN3VM6ZO6fb282UNxofkVMqVj2KcUPorDai1rftUHhuVxfdZBylgKCW0/3UgD6Ko3HVuHJx6gMUgc65cusyZOG+Dox4IQ5S5NNp+Y9f79bYV0lKVDK0pUznhStKRngAGwKscPtrvku3WHpLtKbXd2UsyWBhh9hCQ7FHySjkC2dgUHbbuODXl8KUlQUkkEbgg7iukaS1+t91pua8GZ6MdW+fivHz/GPf3H116Ps/LhzJ4c/wCZ9G/l9Dm1OKUalj7FJrno+vGgrgli4NpdivE+jTWgeqfA8M7pUO9J3HmN6zfIivUVuvtl1japFhvcVLrchPbZUrHFgbLbVzStPMd48xkV5v1RY3NM6iuNmcdS8YUhTIdG3WJHxVeWQQa5Nbo56ee2XQrDl8Rc9SOw5gH1V1G2XlxENpIXjCEjHsrlDa9jWujyyhAGe4V52XFuQsuLcXWp7quRa5IUri7H/UKwC3FOKwMk1fXWUVwJAP8AR5+kVkXXiTjJrm8GiseHgsXCxHRl11K3P6NG+PX3D259VRpM1T6EpSlLaUnKQnx8ahp3OMVJbjFaOLITg99LwkuWa+Go8s9W6EX92HQ8iEo9t+FKgY54OFcH+tGK87x0tIUiQWkOKICuF0cSckd45H1V2L7HzUTbVinWVx9r0iE+iS2nO5bUkJJ9im05/KHjSpHQ5aVTZMhd5lsxXHluNMNsNgoQok8PGokHGcZ4eQFeW3sk0zzJra3E563eGk2bD02OCWpOYSEhCVOHhSx2Epx2cKWVc/PJApL+oYER5c2A1JlKcuZuiWpSAhMdfAscOcnjPGsHIAyG0+O3RBojQNpBMxx2Tw8xKuBCfaGgmqO6aj6N7Q+BCtdpcWSE/BsBzG+MlS+I0Jp9E2SnxwrOaP6hmmLIiMpaCXkuJKuJS3AlwJ6wE57XEU5yoEjJwRVQ1Z7i+CW4UhSfnFBA+nFdkcemXRSm4CYFvZ+KStZSE4/EbQM++lfeuduKA6dWZUrZQahAJ96nCforSOrjj4fBEPaEYquF/PyOOt2Ca5kKQhG/xVn9VKXaGWpjMaRMZaS5uXMkhv1g8t61murFb9IO/ayPqGVcLiRxPNNNpaQwkjYL3JKjzwO7nWCXxAE4Jya78OXfHcd2Gc8i3J8fD6mhn6AucbhcjPxZ7ShlK214yPLmD76qDbblb3UuLiPNrbUFpPBxDIPlkVBbcdZIU0Vtkb5Sopx7qnxNQXhC0txpsh5SjgIV8KT6gcmumEq6myjlS6p/wTU6kD3pMWVF4YjzIaDLLpSWsOBfEkq4tyoZOc5z5Cpku/W+QzMlssvtXF9oxm0/HRHaI4OFCie9vCSSnJycYzVrGtd96luRf7S3HjOfF65IQ4rxPASSBjfJAFZ+Feo0dIjzIgUjPxghLiVeYBx9Brpi00Y48+9tRXTydlrqy9QrzHjuMvcbqZDpQj4XssqSjAWFnCVApxhHZx4VQMpCnB3b1p4KdJ3TCC2004TjDTqmF/4VHh9wNaC2dFdruz6Oov0qEOIEoejpcVjyOUj3iuvHOuSty6Pg6Rol37m+gifckgocciXCaDnfiWVNIP8AlRXmRbiiwhBPZTsB+uvR3S/coWleiJNhjOhJkJj26M2VBSy02Qtaie/4qcnxX515oWvOMZwABUvLV+p04+UPgJDPH1iOLOODv9dG2vChUUK7qdbO+a5cslI1N1oucY0eRg44lj6q0j13WsDtmsJp5/gjOebn6hVsZZI515OfFcrI8O3ZV6mkA3NxRPNKPqqjccCql6heK7io+KEfVVahIc4suIRwpKu2T2sfJGBzNXGFJM2S7EptDKvjLIGO4V2LoB6uPcr+lvHAGI4BHyvhHN64o1xFQCeJSj3Ac6650FvqZev7izjEeOf87leL/iCDehyL4fNHpezv/wB4ncPTQCd6X6aMZ4qyv23B+VRLvHCEpRxOLUQlKEAqUonkABzPlX5n+ClfQ+r3I0My6ojtFa3AABkknFRLVapGpwm4XJ56BYzu3wHhfn/kfMb/AB+Z+TgdqmoVujMqEm9JblyM5RBJCmmj4uY2Wr8X4o/GPKxfur8t4uvOFaj3nu8q6McFi5irfn2X1+RlLdPhcIvkz2Y8RmDCYaiQo6eBmMynhQ2PIePiaZVLJ76pRLPjQ9KO29ZShKT3SdsqEIxVJFmuT51Hek7c6guy/OoT8zs86uGFsu6GNZ3hhm3InSDh9pYaLoHacbIPZV4lOCQfZ31V6CkLsVhe1k4Am/6ndcTCcI3hQUHhKkZ5KUQEg+ABrLdKdzc+0fCn+mP/AKawKlXa8Bm36SaQrLSdOxA2e47r4v8ANX1vszC8eDevzPi/Q+H/AMW6qcYrFj4NKl0AgcXM53O5P6zVnaocm+XOJbIgy9IXwhR3CAN1KPkBk/R31d9CEzTN/t9xtFxtzMi5E9YtUhIWHGdgAg/J4TzHPJBz4bXTulLT0dm832TN4mAFKQ44N40Ydrh/GUTtnvwkc678Wgctrb47+h8Tp/ZMsihNtbX19DKaz0y30fP2+5Wi8vCYpZ6tDwBWMDtKBSAODcApPjXBunfT0KLcrfq20xkxbfqJtbrsdHxWJqDh5I8Ar43rzXQtTaykaovL90kjq0rTwMs5z1LQ5J9e+SfEnwFZHpOlod6IY6XQStGo/gD4AsErHq/bXRpciWorGqizp0GeMdW44VUH0X9fv0OLAhRPdj6afRLLACUIQO9WRni9fl5VDDq+HgBATnJ8SaLiOa95wT6n1kZtdCe7cH5JPWLyVfGOOfl5CrG0K4WHR4rH1VQpVVtaFENub/KH1VnOCUaRpGTb5LUroJVtTRVmglW1c9GtjnFRk01xUZVSoCt4qLNJzRZrso+foUTSCaBNJJp0FDFyOWGvylfqqtPKrC4bsN/lH6hVeeVaLodWPoEKUDRCh30yh1L60NuNpwEuY4uyCdjnY8x7KJEh1tt1tCylDqQlYHygCDg+0CmzQB2pbULagE10bor6X3tBJdtdyjOXCyPLLvVtkB2M4QAVozsQcDKSRnAIIPPnFCnV9Sjv95+yF06prFutEiQ6RnikM4APqLn6jWEvXTVeZ2UwWI0VPiptCyPZwgfXXOxtSaSgkLamaOf0gakuKOreusvgxjhS6pI9ycD6Kz7jq3Vla1FSzzUo5PvpFADeqpFUkDfzpSFqQQpClJUCCCDggjvoqFJoDXs6otuoEIa1GlyPMQkIRc46clQHIOo+V6x9FOHTqHTxQdQWOU384yC0r2pUKx6yx1LfAHeuyrrOIjhx3Y7/ABzmm8AncA1yPSr/AGOjkelX+x16dvv9TbDTjDQCp+o7LFTnfgeLyvYAAPppmZqa22NhyLphLq5LqC29dX04c4TzS0PkA+PP66yGAOQA9lCnHSK/fd/II6VX77v07Aznxo6KhXXR1jiedX9vc4YbQ/K/1Gs8k1dQ1/yZrnsD/qNKSOfMrRZqcyBzqrva8ss/lK/VUtTmwqvuysstflK+oUQRjiXvIqVc6SaUqknlWh3IFF30dF30FAod1LDa1/FSVeqk4I50xWdM6NukizWqyr01qmKp63F0uMvBoPBviwVIUg805HECNwSdjna5vGqeiuGnrLZHcdc5BEa2pRxf3nFDHurjFDFbx1EoqkQ8UW7N7K6SoiQpMGx4T3GRIz9CEj66pZWu7u9+A9Fhp8GGRn/ErJrO0VJ6jI+rBYoLsS5t1nXAky5kiRnuccJHu5VEoUKybvk0SoKjoChSGChR0KYgu+j7qKjoQGkteurhb2UtuNoklAAQ4pRSsY5ZI5+vnVbfLy/f7vKuclDaHZK+Mpbzwp2AAGd+QFVopWdxXVk1WXLFQyStLoZrHFO0uR9HI1pEubmsylVXnWYUr11C6BQ7MXxQ5I/5Z+sVnOFIOVAnyBq8fVmLJ/sj9Yqm4MnbJqNvJpFcBsICljiHZ8AcVKUsAYRgDwFR08Kc7e2pTEZx1PGQlDePjunCf/5qlg38IvamKjXGRbyH4jjkeSg9iQy4ULRnmMjnnzo5eqb3Nc6yRdZji/ncePqph5LHxQ4t3B5gcKfZUm9SrRLTbk2q1OQFMw0NTFOSC76TIGeJ0A/EByOyOWKzlp0mTsRAenyZCMPPOu+a1Emo5cKhg5x4U6UjBNJUjHdik8SDajfaL1ap/hhPq4ZQRhBJ2kYHL8vHvx48+i2fUam+Eg9n5QPdXnoLUghSSQQcgg4INXly1ZJnw4a0uuR5rCyVrbUU8ZxgLGOR55H7a5ZaWDfKPndd7H8TIpYuE/4/t8j0Y9Ntt5bT9srTbLjsAlUmK26oD8ojP01Vv6Y0jIXxOaQtij/y2Qgf5VAVx6zdK96t+ESmIU9HeXUFtf8AiRj6Qa08bpqihIL9maSfxZqt/UOrNXHR4kuODyZ+zvaWJ1C2vR/3RuHLJpyFhUfR9jaxyU7HSs+4k1Xy5y2+xGQ1GSfkxGUsp/yAZrLzunNsN4hWGOVH5Tz2ce5A+usPqLpBveoULaccaix1/GajpKQfIqJKj78U/wAPGJeH2Xrsz/1XS9X/AOllrTUqFKdgRX+ueXlL7yVZShPehJ7ye8+zxrFokOt7JVlPzVDI9xoNNreWltAypRwBnFIIGxBPLfI763SaXB9XpdJDT49kRxb4WnBaQPycj6OVSYN6uNsUFQbhLjY5dW6Rj2cqirQU7EAYAzj9dIx3VXKZ0UuhNul6uF6fS9cZsiW4hPAlTy+IpT4DwqEaL5VGTtScr6jSoMU4nnTYNLSaTYF3Z3OGOv8AL/UKsC7mqm1nEdX5f6hU5K655q2aRRWXzPpv/lo+qoI76sbmUmWCpIV8Gjn6qhOKU4QVBIwMAJGKSHQqOtxlfWNuFCxyI5jauj9EMsR29QKxsGGB/nWP11zYA42Bq50rqRWnZb6ltLejSWw26hCwlQwrIUCQRkHPPxrg9o6Z58EoRXLr+GmdWkyrHljKXQ7DClvTpAjx2+JfDxKUogJbQOa1E7AeurWHMZhLIiKLr5+NL8PJsHkPM7nyrCtdJWm2oqY7bd0YZyFKb9HSorV85aus7R8O4dwFON9J2mU75uv6In+JXyc/ZmZ/8br4HvR1uLvJHSGJRIFS25Fc2b6WtMIG5u2f/c0/xad+/DpkDYXf9ER/Frll7I1L/wCN/saLXYf+6Okh/wA6BkAd9c0+/LpwfzN4V/8ADo/iUk9M2ns5EW8H/wApsf8AXU/5Lqv/AObD8fg/7I6Q7I86gyZGEnesEvpmsJ5QLv8A4Wv36YV0wWJYPFbrsfa0P11rD2Nql/xsT1+D/sSdeAzLe40n43EFp8Nsj6iap9Nzlar0qzYmjm9WMuOQmycGXEUcraT4rQrcDw2pm49JFjmpI+1tzOfnONDFY+53eG5Lam2pmZBlNr4w51qdiORHCMg19FodHlWPwpxrunwfOe2ceLVK4SVo3tg1RPsVwYuVtkqjTIyuyrHsUlSTzB5FJra6y6ZbvrWCxAkRo8CGgpccajrUvr3ByKirkkcwnx3JOBjljfSJDu4B1PZlyJgABuNvdDD6/NaccKz54p5vUmjBhS3NVEd6A3Hz6uL9eK2enyxW3az5KWnzwi8aTp/f30NC3OkTZDMSI05IkPqCGmUfGcV4ftPcN6oelTULTq7dpWFJRJj2ULMmQ2cokTF/hCnxSnASPbUO49I/o8d6Hpa3mztPpLb0xxzrprqDzT1nyB5JxWMGAMAV0aTROMt81XkdOg0Dxy8SaoWk70DzpAO9KCt+denR7aFpG9Wtr7Lbn5X6qqUqqztqvgVn8f8AVWWToaQ6lhxUYVTXFRhdc9G45xUZVTXFQK6VAQs0WaKiJrpPCDJoqI0WaYUMT/wKPyj9QqCeVTp34BH5R+oVBPKtF0OiHQLFDFGnepkK0yp6S42hKGE/GfdUENp9p/VSbS6jckuWQsUMVbmzQhsq9xuL8RhxSffiku6dlBhciI6xPZRutUZfEpA8Sk7j3VPiRIWWPmVJoUZ8qKtDUKhVvp7SGoNViUbFaJlyENAckGO3xBpJzgq8OR9xqNYrFc9TXRi1WaC/PnSM9VHZTxLXhJUcDyAJ9lA6INEK0lk6ONXajvEyzWnT1wlz4C1NymkN49HWCQUrUSEpOQRgnuqfJ6GukGFeotlkaUuTc+Yla47ZSkh0JGVYXnh2HMZzuKLQ6MbRV0FXQB0npSpStG3IBIKiSWxgD+9XPs5oCgUKFCgA6FFQoECjNFQpgKTVtEOIzfqP+o1UA1axj/J2/Uf9RoZllXBLKqhXI5aa/KV+qpBPnUW4fgW/ylfqpxMsa5K5VJPKjVzojypnWgUO+nYsR+a6GY7SnHD3Du8z4Cpv2naQSl+5xm1jmlsKcx7RtVxhKXQmWSMXTZEizpEMrLDpRxp4Tgd1MqUVEkkknmasRY1vHEOXHkq7kAlCz6gar3WnGXFNuoUhaThSVDBFOUZpLd0JhKEm9vX+RFChTkaM9MktRo7anHnlpbbQnmpROAB6yRWZqN0KuNU6RvmirmLXqG3O26aW0vdS4Uk8BJAPZJHcfdUi6aB1RZY9ofn2Oayi9JCrf2OJUoEJI4EgknZadsd4osDP0Vbe59CvSJZ7Su7TtIXVmE2jrHFlsEtpxklSQSoADnkbd9ORug3pJmRmZUfR11dYfbS62tKEkKSoZB5+BpWh0YQUdWeo9MXjSNzVa77b3rfNShLhZdxxBKhkHYmqynYgUKFAUwB30KFDuoAAo++ioU7AWk1dFXbV66pE1buKw4sedaxfAhxxX8nkD/lH6xVa02XTnISnPM1OUrMeT/Yn6xVSpZ5ZqlJJ8lomh+OwewjrVjvVyFMvynH1ZWrOOQ7h6qihRzR5ollk1XYdj3WbUXGKks2iQ40l55bcVlXxVPHBV6k8zTn2siY3uK8+IjKIqljySVpDpkLrcHbY+NEV5FTH7JIS0p+MtuY0ndSmSSUetJ3FV2dqzmpR4khNNdRRVSaFXmmNEak1m84zp6xz7oprdwx2ipLf5SuQ9prNskpKFX150FqnT15jWW62C4xLhLWG40dxk8T6iQAEY2VuQNiedWkzoa6RLfGekytG3plhhCnHHFRzwoSkZJJ8AAancKjG5oq3DPQh0kSGW32dGXhbTqEuIUlnZSSMg8/CszqHTd30pclWy9wH7fNQlK1MPDCgFDIPtFG6worqIUKFVYB8RxjOx7qGcnNFQFKwFFKODi6w8fFjg4e7HPP6qTQ76FFgGDS002KWmgCztyvgVfl/qFTUmq+AfgT+X+oVNSaiSNY9CJcj/KR+Qn6qjEjan7kf5QP7NP1VFzSoV8joXhJAA3pBos1a2fTF0vrTkiKyhuI1s7LkOBphv1rVtnyGTWc5wxrdN0ioqUnSKxRGKTkYq9VYbK0S3I1ZEK0nBMaG86j2KwM+ylJ0XKnNLdsdwgXoIBUpmKspfSnx6pYCj7M1n+LxLq6+KaX7tUX4M+3P6oz9DO9AgoUUqBSpJwQRgg+FJJ3rpRixVFnepVptFxv1wZttqgyZ8144bjx2yta+84A8t60136HOkKxejmfpC7NiQ4hltSGg4FLUQEpygnBJIAzjeixGPJoZq++9/qw6lRpj7n7iL2tHWJglrDpTjPFjwwOdNxNC6onzrpAiWG4vyrTxCc02yVGLjIPH4cj7jRaApAaPPl76u7JoTVGorRKvFpsNwm26JxddKaay2jhTxKyfIbnHjTemdHah1lIej6es8y6OsoDjiYyOIoSTgE+s0WgKehV5qnQup9ErZRqOxT7X1+eqVIbwlzHMJUMgkZG2aocigQeaMEYpOaGaAFZ3pQNIzvRg1JSHAasrcfgV/lfqqrBqyt34Ff5X6qzn0NIdSbxUArakZoA1hRsL4qBVSM0CqlQEcGio6TW54oZoqBoqYDM38Aj8o/UKhEbVNmfgE/ln6hUI8qtdDaHQn2mEy91sqXxeiRgCsJ5uKPxUD1/VVzY7Re+kDUEWy2qMl6U7nqWAoIaYQkZKiTsABzJ3+qqxZ6iwwUAYD7zrqj4kYSPdvXXvsUAj74N2dUkEt2ZxSSe74dkH1ZG1c2SVJz8jNLdK2Mq+xl1e2sNv3nTDLnVl0pXMdGEA4KieqwAD3mszrXon1T0bxod7kuRHob5Slqdb3lKSlSgVJB4kpUOIAkbEHHsr0tZm275ddTfbKZLkzIVxEEKYd6gdUhPG2FpHZVnrFAggghAOMk1XfZCPSZnRFc3JbTCFCZEUgtLUrJ60ZzxJTvv3bVyQ1LclFiW18UeTrk01doTlzZaS1KYI9MaQMJUDsHUju32IqiNaGwkG8NsKGW5SHI6x3FKkn9YBrPDdIzzrvxPrErC+sT0L0MZ0t9jv0kao2aclgwW1nOchsIGP7z5x51V/Yf2lMrpNlXRwJ9HtVtdcLh5JUspQN+7s8fuNUnR/9kVqDo70o1pq32OyS4qHXHlLlocUpxSlcW4CgNtu7uqRK+yb1RIuN3nos1jjuXK2JthS00sJZQC4eNPa3US4ee2wrQ600bTou6ZtI/c5qPT2p7jd9NrvtzlTG71CCkqWHFA56xIJStOMZwRg42ql6b2OkHovv2nTG1/d7xFeYd+1MlawmQ3xcCVoURniyCjCjzB7qzeiPsib/o7TMPTb1j0/e7fAUVxBPjErYJUVbEHB3J3xnzrOay6WNQ681fC1LfBFeXBW2Y8JCCmOhCVhfBjOcEjc5yfHYUVyFnavsoOkPU2kp2ndM2rUE+KtNo456mXeFUhSzwZX59hR/vGvMNarpL6RLn0oaoXqG6x40Z9TLbCWo3FwJSjOMcRJ5kn21le6qQmwUKHdQHOgQKOhg0eKBCaFHRGgYYqzj/7O36j9ZqsFWcf/AGdv1H/UaZlk6DxNRp5+Ba/KV9QqQc1Hn/gGz+Mr6hVIyh1K886VHjrlPtsNjtuKCRSDzqdaMoefeGymo7ih68Y/XVwVySZvOW2LaJbjqEJMKEerio2dcBwX1d5J+b5VvbF0KaqucKNKVBiW9mUniji4zG4q3x3FKFHiI88CqXomg2+fr7TkO6BswnJ7QdS58VQByAfIkCrbV8u43bVN8lagLguaJjrbiHd+qwsgIGeSQnGANsb16eCF8nlZ8m17UU2pNHXPS9zetN4grhzGcEtrOQQeSkqGxB7iPCoPowvaRAlK/lpSREkq5qIGeqWe8HuPPNdF1/Kkv9G2hpV1dU5cViWiOpzdwwQU9XxE7kZB4SeYNczmvcDXGg4cQQtJHcRuK2qLjz+pnGUm1XXt6fffzM2pCkKKVApUkkEHmD4VuOg+ypv3S1paEtBWgT0SFgfNaBcOfLsVQauZQ1elvIHCmU03Jx4Facn6c1O6ONfzOjXU7WooEGFNktNONIRLCuBPGMFXZIOcZHtNePmhsk4+R7OHJ4kFPzNV9kJclap6b74ywvrOCQ1bmkpVndCUoIA/L4tvHNdi6Wdbw+j3pv0UHLdIuNv03ZyXm4yONbKXQpvrAnkCkJQd8bEbiuXaj+yYvOooaI50tpmGROYnuOx2Vhbq2nQ4Aok78SkjJ54zUGJ9kbqyH0iz9cIiWlUu4RkRHoimlFnqk8OAk8XEN05599YUzazr+tut1zpLVeuejjpUvLsVMVxy5WiUT1TbXASptCSAWjwg42Ofnd9VOhteaqtX2NOqtUzL9PdmiSi321xxzJjpHVo7Hzfjq/wiua64+yI1LrHTrunI1us1gtMg5kMWxgoL++SCSdgTjOAM43NZ2R0pXd/oyjdHiYsFm2MSjLW+hKuueVxKVhRzjGVDu+SKNrCzOX6/3XU9zdul6uEi4TXQAt+QviWoAYAz5Cq+gKFWiQGhQoD10wBQoZ350O6gAUDzoZoGgBSatXfwq8881UirV78M5+VWseggZ+BkD/lH6xVUedWg/AyP7FX1iqs86JFBDnVnbGW47Crg+gOBK+BhtXJbnPJ8hVYOdXLyQmNa2vk9QXfapRz9VaaeNyLgu4vLj6y++4px5XNSvq8hWz010WXjUumbjqUSYkG3QgtXHJCh1/AnK+HA5Dlk9+3caHRZ0fv9IeoxCy61bYwD059sHKW84CE/jqOw8Bk91el9W6QZu+lPuVt8lNmt6koZc6priKGEb9WgEgDJAyT3Z8a9bco1FHdp9PvTk1f9TxygOMOJfYcWy8nkpOxHlTd2iNTYJurDQaeaWG5jSBhIUfiuAdwPIjxq91axY4l8fiadlSZsBj4MS3+HMhYJ4lpAAAR3DxxnvqtgrSW7o0sZQ7AdJHmjCkn308+OM4tff3/Q59vO0zHifbXrPUbiOjHo56P9Gw9Tq0bEvLDku6XthlTq+tDSFlI4N+2pzGQRhKAM4ryZXYNM/ZL6hsul4unLtY7DqSHDSlEdVzZK1ISkYSDvhWBsDjOO+vn5xbOdHV7rpzUH3f8ARLGvOuV6sYeluToZNvSwepbQlzrVrySskcI3xsPHJqF04a+snW6oFt6W7y1cG0qiDTsaOoMBxIDa2+MpxgkKJOfHHdXM3vsl9Uytb2/VUm22dw2yO9GhQUtrQywl0AKUCFcROEgc8Y7hTGsun9/WNiuNrc0RpKA7PGHJ0aIRISeIKKgonmcc/M1ntY7OnaP6RtUwvsadU6ruF+uEi6GaIVvedc3ZHwSBwbbfGWf7tea7/qC66nujt1vM9+fOeCQt99XEtQSABv5AAVon+lG6O9GEfo9TEiN29qYZqpCeLrnFcSjwnfhxkjkPkisYTtVxjQmHRUAaGauiQUBQyKAI8aQA76FF30dAAFKFJFKTQBYQfwR/K/UKmJqFB/BK/K/UKmJqWaRIly/Dj8hP1VGxUi5fhx+Qn6qj5pCfUvNJ2SLd5r0i5OKZtNvaMma4n4xQDgIT+Ms4SPbV7Btmoula5rjWqGhqDCQC1EQvq40Jvkkeajvvgk4J5Cq9H8k6M0qbGFXC8lLqgeaWWQUpPllwmtfoWWYnRVen48p6NIZvMVzrGHChYBSlI3G/Mny2NeFrc84qWaPW1GN9Fyk3Xnf8V6nfhgm1B+Vv5kV3oK1gjYwmTjbsrWrPuRUKV0O6ztDJuKY6GlxQXUqbdUhwY37OUjfbbeu7aI6abJM08+vUrgiXKCjK+FH+2p5BTSRzWdgUdxOR2eWV0zredrjpJEiaSxCTEkCNCSrKGkEoByflLI5q9gwBXh/5p7ShveWKqK54fPovj/B2R0+nk0o3z/ByWYpGvbHKufVJTqC1tB6SpCQn0+MCAXSB/OIyM45jf1Ys862PR2fRdbWQFJLEqX6G4nucadJbUPVhX0Vk5scRJb8YEkMuLbBP4qiP1V9VpHsySwroqa9LtV+lfzXY8zMt0VN9e/1OqfY4dI1j6NtVz7hqCK/6HKipjensslz0Q8YPaA3CVYwcb7DY10XWLV601aLHrTTnSdc9TaMl3yK67HnucbgUl/iGFkZKQpBBThOCBscbcd6M+mW8dGUS422Na7TdbbcilUiJPZKkqUBgHIO4x3HI9VL6RemzUHSJCg2t2HbbRaIKw61b7c0UNdYM4UcnfGTgDAGTXY07OY9X3u3w9E9JNz15dEN8V2Nt0/bdxnLjmHCfck+pB8axfSTbZugdJashW6OXNSdImoXIkVKMcRYWcAerhK/UXa4d0jdP+p+kiVZH5saBBTZ5AltNRQvhceBBC1cRPLhwB5nxqyuv2S2or1raz6rmWWzuOWZl1ESIS71KXHNlOntZKsYA7hiltY7PT2jtI3DRabHoOJbOs0yxZ3xcLhhPC/NcUnbBPFvl08sdpIztXI/seNG32BoTpLTZUrbvjj67REWpzqyh1pKhkK+SQXM58QK5Dp7p11pZNZnVLtykXJxTjzi4MqS6Yx6wEYCArACc9nHLAp6+dOV7vGkrxplu22+BGu9zcucl2KXEuFa3A4UjKscOQPYKe1hZ0rp0vM6xdDVi0RrK8NXbWi5aZj4SsOrYZBXwlasc8KSnPM78wM15tFGtalqKlqUpR5qUck0WauKoTCNGKSTQzQIUOdHSQd6PvpDFpqygH4FX5X6qrEmrGCfglflfqrOXQ0h1JRNAGkk0Aaxo2FZoE0jNGTSoBFJpVFWp4wR5UVGeVFQMZl/gB+WfqFQjyqbMPwCfy/1VBPKtF0NYdC0BMrT6OHdUF88Q8EL5H3ium/Y13di1a7mtO5451tXHZGQApQdaWRn8lKuWTtsK5LAnOW9/rWwlaSChxtfxXEnmk1as25qapLtmfClghXorjgQ+2efZO3FjuIOa5s0fdcezM5+7fke1rQ1HhB92VO4nn5C5LgZiraBUrH/MJJwAM+Xdyqs6QL5pVGmpK9RxkybO0OtdYfyPSXAD1aE75KuI5GO/HcDXk5V81jEPAq46lbUO70iR+o0xNj3+9lMm9zpaGW+Ui6SFEIHfwpUck+QFebHSyUk3JGCu7sYsBSboZq0dVGhpckuAEkNjBCU5PmQBWeGyR41aXK5sCJ9rLbxiIFhbrqxhclY5EjuSO5NVVetji+ZM6scXzJ9zoXRtabZq2xXvTj8aIi5HgkxZimgXWxxJSocXPAPDtn5ZrQvr0lEstwv8Gw26Zb7OpNtt6XGk/wAsfPCFPOnGVjcYz3BR2JGOb6T1ZJ0jImyYkZh56VFXFCnSodUFEHiGDudhzp/S+t5Wm4Mq2LgwbnbZSkrciTEEo4hjChj1D3CuHPpckpykulri/wB/v4nBn0mWU5Si3Vri6v8A7fL5nULfpnT96uGmdRvWSDDZct0ibOhpbHUKCAkIUU8sZWTy3AHPGazekNPW656OVKlW6KZN7vrEVhamxxNNBYUsIPyRgOA47hVK30s3xGojd1Mw1smP6GIHAQwljOeAAHI3Gc+zltRL6U5/2ztL8e2W6LBtLinY9vYSpLXEQRlRzknc+Hf4msVptQlX9elW6+RitLqktq9O/Srdfu0r8kdBvGlNPsXK56ij2qEYDNomIMcMJ6pElpfCCE8gcZ/w5rJ9FUCyS7XPBbscrURdSiNGvGS0WsDPCO9RPENskYHcaz6eke6jT11simY62rk846XTxcbXWKClpTvjBI7/ABPjTumekVWnbW1b3NP2e5ejvqkx3pLZ42nDjfI54wMVS0udYpRfLtVz2RUdJqI4ZQbt2q57L7p9DoFg02pz7qp50PaV3NuQ3GjWspS4ylSUgqKVK2AIWlRxjuxRXPRmnntXPz27UyuNaLeH5sGEjibdlkq6tkJA54GSAOQGRua55eOkq8XuzyLe+hptcqcZz8hkqQpasYCMZwEgBIH5Ipq3dIN2s2nWrNaCm3EPqkPTGFHrn1HbBJ2AAwNvAVK0eo5ldN8dX0pfTjv3J/A6nmd03x1fSkut+nHF27Olo0XaldKyC5aoYg/agTVQw0kNB38Fgpxw54snljIzTzum7TOuOlYlx0/ZLfenZi35EKEkKT6KhCyesA2IJCBvnfOO+sFM6WrrOjvIdhROvethtq5IUvjKSclfPHEd/Lc0cbpbuDFyttyctcB6XChKgqdUpYU+lXD2lYPMYPL5xqXpNTw/JV19GZPRatpN9Uq6+jrv3v4mruv2ga1DbrXerdoyLapUla+uty0l4IQDwJdUNkBRKQSMciNhmqnpTiOW+0MIOmtNsRXpH8luVqODwAEhCh4kb53BwcVnz0gxmrpHmwtIadiobbcacYSypSH0rxniyeYxsR4nxqJqrXMnUsGHbW7fBtluhqK2osRJCeI53JPrO3mT31th02WM4Nrhdef79f3OjDpMsckHXC62/j5Pr080ZsVaR/8AZ2/Uf9RqrFWkf/Z2/Uf9Rr1z1MnQcNR5/wDs7X5avqTUhR9VRp3+zt/lq+oVSM4dSvPOp9lUj03qVkBMhtTOT4qG304qAedDJG4ODVwltkmbTjui4ljFedhvlC+JDqFYODgpUDXSV9LMqYhmRetN6Yv9wZQEt3G4QyqRgDA6zhIS7juKh681zxMqNdwn0l0RpwAAeV+De8OLwPnRORLjG2VGdWk8ltDjSR5EV2wlxxyjinBSfvcP76HVNFdIViv2pJrXSfERdYt2QhlNwX2FW4jPCUBOAhG4HZ3Tgcxmuf6xtTVl1LcrJBmtXBhmSWY8ppQUl9BwUKyNskKGcd+aqG41wkqw1FePmpJSB6ydhRl9u0HiadbemjPCpvdtgnvB+Ur6BRKbfvO0vvoOEFHiNX99RerZSJN9eQ2oKbjJRGSR3hCQk/Tml6IucCz6rtky6xI0yAh4JkNSGg4jq1dkqKSCCUg8Q8xVGdzk70aSEqBI4gDkjxrjnkcpufm7OuGJRxrH6Ud5vulNM6OubtlhRLfLveqZwbhCQwl1u1xVqxxpSrbOSrhPkPm7ybcNJvdISujeLoy1O2tllbT0x1vilKcS3xFfWcxvtnnncYGBXJ9T9Idy1Lq+PqhLDEGVF6nqENEqSgt7j43Pf660s/p0luCVKtemrParxLaDT9zZClPEYHLPI7DGc4wOeBW6yY7vtfl2PPlps21J8trz6Pz/AEHNS6ftGm+iR5bMWM/Mm3x5mPMW0lTwZbWtIAXjIB6ru27RreQtG2VvWNttadO259Fr04HX0KjNn0iQ4oITx5GFK7KsE8s5rlum+lg2bT0ax3LTlrvbEJ1T0RUsq4mVFRVnvBwSfA799Mr6XL3Jc1I/LYjPSL9HTFU4CpHozaQoANgHlhR558edEcmNU36fx9WOenzytfHm/OvkjSdLdutULSdoXOslmsWrHHsuwbaQAmPhXaWE7cwnHM5yM8wJ/Qvo+x3XSM129Qori7rNVb47z7SVKbw0d2yRlJyVHI70Cueay17J1tFs6Z8KOiZbo/oypaFKK5KdsFYO2cgnbvUadjdI9ygadsllhx2GPtRP+2CJCVK43V5UQFDOMdojbuqVkh4m5rg0enyvAsadO/Pp98HVdNaMtESRoizT7Nb3X24k64XAuR0KW6pJKEBZIypIUo7HbsjwoQbQzctY2W2XHT2gjEU49NUbKlLyyhps4Q53cJU4jbvKfKsQvpumOapXfl2C3qzbzbkxVOuFCUFwrUc5ySc49VM2zpdYst9butr0ZYoHDEciqZjFxAc41pVxKOc5HBgeRNaeJiVJdL8u3Bh+Hzu21zT793fr6m6dtDdw1ZYLPJsWgRDlT1PA2dKXXy2yhS+F3GwSrsgjvI8KglendZ2jXEdzSlntzVjbdVEuEJgNLKk8fBxEY3JQDjkQSMcjWOidK7Fpv0O8WbRthtbkZl5ooj9YA71nCMqOc5AScflGoepulCdfLOux2+1W2xWt1zrXo8FBHXqyDlaickZAOPIZ5CpWWFc+vb04LWmy2uK6c30557+R1CyWy3I0hbH9G6c0lqNpMRLlxYmK4prrvCCpO/LfiGDjuCe6vP8AIcS9IccS0hlK1lQbRnhQCc8Izvgct66O102uQmnJFr0hp623h1nqVXGO0QoDbJCOWdgd87gc65oSScnJJ3z41nllGVbTo0mKcHJz7+vIYq2fHwznrqqHfVq8fh3MfONKPQ6xI/AyP7FX1iqs1aD8FI/sVfWKq1USKCHOrda+vtMOQncxSqO55AniSfpIqoqTAnKhOKygOMuDgdaPJaf21WKe18lxdcMvtLR5V4vUa2xZ6LeX1YVJceLaGkgZUonIzgZ27zt311bpO6RIdk07E0JpeZ1zSY4bmSkOhZLf9HxDmtZJUsjkDjvNcVNvbmYNvfQ6D/MukJcT5b7GgLXc2yEiBIB8kbV3Ryy8rOmGWUIOKXL7+g+p8eqnmXRHtVxmuHHXN+hsD5ylEFZHqA+movoPo3buT6Y6R/NIUFOq8gBy9ZqHcbgqcpCUoDTDI4GWknZA/WT3mjLqWk76mV7eWRK6PaLDCkaADaoTC7jLjyJDThaBcPAoYCVc/mj+9XOK0jWup0ZdsVGjxkC3xlRkoVxKDgUACVb89gdvCubTZMcG3k7qv5X9DTSZMcHJ5O6r7/Q09ytlrs2jZjHoURyZGjttuvFlKl9e5gkBRGcgH2bVMsWmokS0RrXLtbLsyVGeeekOMBRZWoAJRxEbKGfHYpNYeLrCS0hpEiMzKSJ3p73GSC853A45JB3xipcbpIvTV3M513rmCoq9DKiGhkbY79uefGuuOqwblJrsl0+/h+52x1Wn3KTXaun38Cy0PLhu2me3MstsdRbIy3lPOMBTjiskhKiR5EU/Fm202SVq6RYbaHkrTDixEN4ZSRjKyO9Ryd/xcDxrLR9TORYl6jtRGki6q3IUfgU5J4U+PxiN6fser3LRb3LbJt8W4wXFlzqXwdlbcj7AeVZY9RBKMW+ifNd+3bsjLHqYJRi30T7d+38F1aJ1q1ZqW0kWONGdaDq5iG0JLLoCSU9nHj4+PfVjB01Ft1xvd6lps0yIll5xmKzwuBrmpOU4wk4Tj2ms2zrp2NdjcI9qt7CUxjGaZaSUJQCc8WRuVZ8ar7bqR22WK42pmKyTPwFvkniSkdwHLx95qo6jEvzcu27qu1Lj1/uyo6nEvzcvl3VduODdWu0tRNM2csW7Tjz7zJedXdClBVxHIweZ2Ps2qvjTYNt0o5qB6yWp96ZPXwMrYHVoSduFPeEjgVj11VK11GfYitS9M2yWYrKWUKeUs4SBjln203F1wli0w7a9Y7fKRET8GXypQ4sk8WOWdzVePiX5X2pcd+PT4+Zb1GHtLouOO/Hp8R7pAtlvjotFygxEwjcGC45HRslBwk5A7vjY2wNuVZGrC+X6dqGd6XOWkqCeFCEDCEJ8APWSar64NROM8jlBcHm6mcZ5HKC4AKWmkjlS08qxMCdB/BH8r9QqYiocH8Efyv1CpiaTNEQ7kP5QPyE/VUXNSrkfh0/kJ+qoZ2pCfU1tnAvWhblaWwTMtsn7aNIHNxopCHceoBJ9VN6P1TFsSJkS5WpN2t8vq1qY60tlLqCeBYUPAKUPbVFabtMsdxYuMF3qpDCuJKsZB7iCO8EbEVoF2q3aqcVK0+5HgznO07aZDgQni7yws7KH4pwRXl58UY7o5fyS5vyf6dPNPzv0OrHNunD8y4+P30NO10gaLbThXR+4od+borf6KcV0nWK1ock2DRjdvnqaU23IXPU4EBXPs8O/d3jlzrDSNL6iiuFp2x3MLHMJjKUPekEVJa0ZdUNokXtTVihHm9PPCsj8Rr46z5Y9tcMtBouspNry3yd/pfPwOhZ8/Zfwl/QsOjcBF/Yu0n/YNPtLuL6j4oB6tPrUspArFOvLfdW84crcUVq9ZOT9dX981HE+1gsFgZdj2oOB1957HXz3ByW5jZKR8lA2HM5NZ2vV02KW+WaSq6SXor6+rbf8HHlmqUE7o6r0E6dt9ze1DdblBts1ECGlLKLkE+jpdWSQVFQISMIxnGwUa1eqk6U0xedFvXnTFgDsxTgnOwYo+16mldkFOdllKilWe4Z7lCuaaK6SGNI2G5WaRp2Hd2Li6lx70h5SEqCR2UkJG4B3599R9b9I8vWyrYy5boVvt9sTwx4UXIQPig8/JKUgDYAV4ub2dqs+vlOdrG+OHXGyuKd9W30XnZ1Qz4oYVFfm+Hr9Dba+sGmuiu03KGiBCuF7vb7xide2HE22HxEJKQrPb3IB8Rn5O8XoVsLMiw6pvbunIt/fittMwoj8cO9Y6SSQAQcbcOSO6sV0h64d1/qNd6dhNwcsoZSw24VhITnvIHeTTlp6RLnY9FyNNWxPoZkzBKcnMvLQ8QEgcAwQAOyK1Wg1T0Kxyd5ZuLk2+nKtcPokq469e5HjY1m3Je6ro7FcOjzS111RbpVxska1egWZVzvNshnhRx7dW2QnHg4TjGQkeOazAe090jaB1VcfuRtVgfsjaHociAngKgc4QvkFHAwc/OBGMb4HRfSBc9G3t+6NpbuHpbRZlsyyVCQg4O55525+sbg1a3/pUNwsjdhsunbZYrV16ZD8ZnicElQIICycZTkDI5nA3wK54+zNXjnGFuVbaluaUUnclV276K74q3wafiMUk3VXfFdfL6nTH7Zp+DpdiVpfR+ltV2hmFxTF9cBPC+Htr3BUO845gg4AwKptD3rTT3R3eb5N0Np9ZsEeOwla2gtcx1W3EsqScEnB28TWYldMLDcOeLJo2x2S43BhUeRNi8WeBXxghGwT9Pd4VmoWtHYOhLjpJuEyUT5jcp2UVnjAQBhATyxlOc+ZqcXsnPPE45E7co8uTur966lXS1xTfl0CWpgpJx8n24vt2K/Ut3Zv18l3KPbIdrZfUCiJETwtNAJAwBgeGTtuSarO6k5o+6vqYQUIqEeiPNbt2wxzo++kjnR0wFpNWMH8Cr8r9VVqasYR+BV+V+qs5Fw6knNEDRE0BWZqHmgTSc0FUhh0VKFFiqPHEmixSiKLFMCPM/AJ/LP1VCPKps0fAp/KP1CoJ5VouhvDoFQ7xQos70yyY3d7iyjgauExCfBL6gPrqM8+7IXxvOuOr+ctRUfppFETSUUuiBRS6B5oZos+GKLNVQ6NBZp2k4kds3WzXWfI34+rnJZb57YAQTy8TVmm+dH4O+jbmf8A/Ln92sYDR59Vc8tNGTtt/u/qYS00ZO23/wDTXyZslX3o/wC7Rt0B/wD1c/uVT6guWnZrTTdjsMi2rSolxx+cXysY2SBgAevc1S0VOOnjFppv939Rw08Yu03/APTfzYKFDOR3UXurc3DoDnRUYooA6FChRQBd9HRUdABirOP+Ab9R+s1WCrSOPgG/UfrNBlk6CzUedsw3+Wr6hUlQxUaf+Ab/AC1fUKpGcOpXnnRGjNEeVB0gpxmS/HPwLzrX5CyPqpuhTTa6A0nwx96dLkJ4XpT7ifBbhIpjuoUPdQ231BJJUgqGKFDNIZq4N10LGDfpGmbxNIa4V8VzCOJfzhwo28MVN+6Ho4x/7C3P/wCcq/crEChWiyP0/ZfQweCLfLf7v6myXqDo+weDQ9wz53hX7lY99bbr7i2mgy2pRKWwokIGdhk7nHnSaLbypSm31+SRcMah0v8AVt/MAoUO+hUGgKAoeNAUwBQoUKAAKFAUffQAY76tXd3nPyjVWKtXvwzn5VaxENn8DI/sVfWKrDVoThqR/ZK+sVVmkygqGKFHUiCIpYedxjrXMeHEaT3UKLHYnHlR4oe6joAI1a26VYY7QE62zZjpG5TJDSUnyAST4czVUaFOM9rtfX5jjLa7RpPttpAf+GJh/wD8if2Un7a6Swf/ALMzM/8A6gf3az1AVr+Il5L/AOY/Q18eXkv2X0JdwkwH1EQrd6KjOxU8pxWPPO30VDIoUZrGUrdmMpW7CAoYo6KkIGKMUKAoALvoGj76BoAA5UtIpIpaaAJ0IfBq/K/UKlpqNBHwSvyv1CpaRSZouhAuI+HH5CfqqIal3H8OPyE/VUQ0hMFEd+7ajojQImtXy6xmktM3Oe02OSUSFgD2A1Effdkul191x1w81uKKlH2mkk7UnNQoRTtIbk3w2HQos0M1ZJoLDJ0hHiK+3ttvc6UVHAiS22G0p7uaFEmrT7a9G3/CupPX9uW/4NYviocVcuTRxnJycpfpJr5M0WRpVS/Y2S7n0bFJ4dMalScbH7cNH/8AZrMXR62vSc2uJJixwkDgkPh5ZPechKR4bY7qhk0KrFpo43abfxk382KWS1VATR5ogaGa6CA6Khmiz6qQBUrupNK7qACHOld9EOdGKQxSanwfwSvyv1VATU+D+CV+V+qokXHqSKAoUBWZoFRmiozSGOAUnFLAosUHkCSKLFLIouGmIizh8Cj8o/UKgK5VZT0/AIP4x+oVWq5VrHob43wIoUdFTNUFWl6O7XEuOqGJFzwLVbUquE5ShlIZbwcEDchSyhG2/brNUWTvz86Y0deuNjgatvA1Qlkajfl2vrTDh8ccTbg0ttp5IASleza0vFKQCcnG2TT130vHm3199GmH582PDtEdNnZlFKoraoo4nVKSMqKChKSTsCrK81xvJGMEjByPXQG3Lap2lWdRsrUB3pw1JFlWpi7Ideu7bEdaykLcCHigJ4OalEcIx3qBTuBTt6gWO5WS3wJNq9GuDGmnZrcgSSkx1NyXyGS2RhWwKSVdrlyxg8pGxyNsUD5/TT2hZ0jpR0bZNMQGzbYU1otyvR2Za0u9VPa4Cet4l9kk4SoFvskL8gTdwdJ262CyXKHanoCH4kltxc8uoffUq3ulRSlXwbjfECQts7BSQoZIzx0qKgASSBsAe71URUSACThIwMnlRtCzqbmlmZ6UyYdll6puKYtpb9CTJXllpcNC1uEN4Vw8Q4Afiox2skirP7ldP6ihacbnuNtPmJbYstQe6swIynFAvjbhcKlYbJOQjiSSCVdnjIUR8U42xsaHKltCzq140rpexLkTpmnLi2uNbXJLlsfW/FRxiUy2hSVODrFApcWFDbdOQRnan1xpS32vSVou9vtMiA3JLSVOTC6l51amitXCFZbcbyNltnYFIUMnNYJSlLPEolR8Sc0RJIAJJA5Dwp7Qs6ZYtDaXuUS03F6Q6iNd/R4TLfpKUKbloCjIQVK2GerbCc7D0tB34cU5c+j+PKiqUxpu4Wu9ybdIeZsSnVreQtp5kB1KVdshbanuwd/g1KG2K59cb3OusWDEkuN+jwGupjtNtJbSgE5USEgcSlHcqOScDJ2FQipziDhK8ncLycn20qYWX+utPt6ZvjVtSw7HcTb4Tr7TisqQ85HbW4D4dtStu7l3Vn6G5o8VaRLYYFWsb/Z2/Uf9RqrSKtYicx2/Uf8AUaDHJ0HCmos8fydv8tX1JqaU+VRLiMMNbfLV9SaaIh1Kw86SeVLI3pJ5UzoQVDvoUKQwGuu/ayErSJ0EbjF+2iIBuQhejL637Y564o6zh4T/ACf4Ph4vjDHOuRGgNqTVjTOyyNI2SLaZVsFqdt9selWtpF8XLCvT2luDjeQFdgDCs5Tsn4qsmqXXlrFq0BBZVpp/Tq/t1IAjyHlOOOoDDYS5lW+O7I7JO6cVzTngHu5UNzz3qdo7Ox3JdrhwpMw6VaZgL0rEdHVvOJbnkuRcji/EVxJUU7kg5INCB0caWdfnuKh3GWwZbKVsxusedt8ZyM29xAo2Jy4oBTnZ+CwdySOO5OAMnA2AzyogopzgkZGDg8x4U9oWbnoy0xb9Sybiy/bZc91AbRHUQ6IzXEogrfU1laBgDCsFCd+Luq7ECI7py2Ox7R9r0DTtwQ7cI7xKJbzanstkkcKieEKOO1hSQNgmuVhZTnhVjIwcHmPChk4xk4Bzihqws7NH0hZ7XJvVpehyrbYzbQDqNfG6m4NekxVdahOOEAk7FGeEK7WcGm4nRtY1wZb9xs8+O4ZkhmSiGXZRtbaEpLZCk9lXElXHxuEJWn4uOY47xHAGTgbDflQClYIycHYjPOltHZ2KPp6z6ik2ZP3HTOFVkjrZdiJedYkOdhKi6G+3hJ4wVIyQpQ4gQMVym9wxbr3cISQ2lMeS60A071qAErI2XgcQ22VgZ51EC1pxwrUMZxg8s86SBVJUJsFHQ76GNqoQQoyNxQFHimIUkc6t3Rl5z8qqkcj6qunk5ecP41aRBEcp+Ckf2SvrFVR51cLHCzIP/KP1iqdXOiQxIo6GKFQAO6hQoUgOn6IuCG9LR9TLajOP6KdeWlDiEkOCRgx0qB+MA91p79j5b3EnRtmbuKrCGFyWeGVqCJGbKuOWy642iOkcAKyEshbpSkcRGdhzri+e7PszRpWpKgpKiFJ3BB3FZuJVnRrDY7VbOmmy2sQJDsRUyLmLMStpTbi0pURhQCilKjkcQBUAMjc08Ilsu1pZv92jz5jKLfNuQhmYR8J6chsAr4eLhPGSrvO+CDXMypRWVlRKiclWd80WTyycU9rCzqMDQ9velyJtu05c7z1n2vcatkeQSqI1IY61TilhJKkpV2UqUOEfLztmsRYod36RdWNrgPT/AEN6ZIjW2Ovq1S1pfx1Y4RnASVLIQMkIIGOYwQWpJOFEZGDg8x4UEqUlXElRCgcgg7g0trCzrr+lbLE07doKLA6JTk60Ouh55SpFrD7b3E2ogckkDPEB+EQFdpIpKtB6Xul9TEh2+dBZh3a4WxTZlKeXOMdlTjafi5S4tQCMIHyhgZ58k41ZUriVlXM53ProcSsg8RznPPv8aNrCzqF80Zpq0wLpcRbLsXWmofBCcLjCWHH1PpJHWJDi0YbQpOeHc4JI3NN0h6YtmnJVtfiW6ZHtr63W8SHVolOBtSeLrGnEAtuYVglPEgn4p7JFYlS1uKKlrUoq5kknProOOuPKCnFrWQAkFSiSB4b09rFZ1OZ0Y2C2tT5TkiY81bkO3J4F5CQu3uJX6EQcZ41rDYJ8Hk7DBqRJ0fZJV0jN3Vi4zJNwuVutIkNvoaSyHYjKuPhS3hSgVbDkQDnJ3rkeTg7ncY591K61zIPWLyCDniPMcqW1js6TC0FbhZFlyyXWZm1TJ67y28UMMPM9aEt8PCU8OW0hQUeMlYxgYzzMcqX1rgQW+sX1ZPEU8RwT448aT3VUVQmGmnEUhNOI5cqoRYW8ZaV+X+oVMCai24ZZV+X+oVNAoZoisuIw/wD3E/VUNQqbck4fH5CfqqEqpEwjSTRkURoEa7o1szU+8SLpMMFuDZ2DKWuf/s5ePZYQ5sRhThTkEEEJVV1etD21T94vjcaRNhFqJLixLKscBD/GHVBRSSGm3W1t7J5qQCRXOQ862ytpDq0tuEFaAohKiM4yORxk49dLj3GZEWlceZIZUlCm0lt1SSEq5pGDyOTkd+alp9Qs6e/0V6fjXZVpck3NLsrUarJGfdcQlMdCUNLK3EhPbX8IUhIKRnG+2Cs9F2m35Rkx13ZMZmG5IdgrD3WKKHm28pcMUKKe2SvhaVwlOORyOZ3O83C8ynpU6Ut1x50vrGeFPGQAVBIwAcADYdwo3dQXh+e1Pdu1wcmMjhakKkrLjY32SonI5nke+ltYWaZvRNvVr6XZGnZb9titKkrLgMZ7qw0FlJC0cWQTglLZJAylG9P3fQtptPSFb7I49clWuYyxKJbYcXIbQ41xlPD1YUcH5XV54d+EkYrFtTpbEwTmpT6JYWVh9Lig5xHmeLOc+eaNVxmqlomqmSDKQQUvl1XWJI5EKzkYp0wOkI6NLGq+yGZaLlb4UJUefKCZCZB+1qmlrccSrq0kK4kJCeNKT8IkEZG7KOje0265txLii4SSxCdnzA291YS0p/q45SEtOLIUjCzhJ2cQdgCTzx24TXn5D7kyQt6SCHnFOqKnQSCeI5yrcDn4UbFznxZAksTZTL4R1QdQ8pKwjGOHIOcY2xyxSp+YWbvWuhbDoy2XFa03WVLF1ft0VRdS222hLLLqVuAo4lK+FIx2c4ztjFNaW6PI950pJuUxqQ285GnSYbzTqlJxGaK1BaA0UpGUlOVOJPaBA23xkm6y5kNqK+6XENuLdClElSlKCU5JJ3wEJA8KbZuEyPHXGYmSGmXDxLaQ6pKVHBGSAcHYke2imB0lXRzpqZNcs8V26QZUZdq6+dJeQ4yUy+qCvgwhJTwF3IJUchO+KgaysEG06GZei2G7Whf25ejkXUJU8sIZTyUEI2yd07gHkTmsCZD5DiS86Q4EpWCs4WByB8cYGM8sU5Muc6eEpmTZMgISEpDzql8IAwAMnbA2o2sLOlzOi20KdXAaavFrU0i3u/ba4LSYsj0lTCShKeBOCnrlKB4zlLSsgdzCujyyrfhPvW/UtqjKmyYTkWSjrX3g0zxh5IQ1xJRnAXhC+AHI4uVYa+aluuoVoNwluONtpQltkKIabCUJQOFGcA8KRkjnTP24uapTEw3GaZMdIQy916+NpI5BKs5AHgKKYG61Ppe22HR93QbK4icxeWUNSRLD3UsuR+sQlSuqTxAg8jwHJGQCkiudDnTy5st0v9bKfX6QvrHuJxR61Wc8St+0ck7nxpoU0qAUkbVYQPwSh+N+qoCeVWEH8CofjfqqJFx6jxFADajNEKzNAsUCKOgaQEjhouGnQmixUWeNY2U0AinSnajSiixNkO4o/kqPyz9QqpUKvrk0TCQruDpB9qf/AOKplo25VrCXBtjlwRyKTT/B5UlSN+VaWbKQ0RWq0C7Fjo1K9NirlR0WdZWyhzqyv+UMDHFgkDPPG+M8udZgposEZwcZGD503yWpHTkaFtYfm3CDpy43sLYtsqPZ2JS+NhmSypxxxS0p4lJQpIQDgAdYCrPei8aA09bX74+n0sw9Ny7hCmhT443VhREI8uzxlXCrH9Eo99c16xxJyHFglPBkKPxeWPV5UnKjkkkk88nnSorcjpHSBoSw6a08H4bNyDrTsduPPLbqo9wStBUtXEUhsdxSG1K2yDvvVjpfSkODZXZcbTs64of01OmLvvWH0Zl1UV3LITw8OUHsYJ4+IcQ2xXJytxbaG1LUUIzwpJJCc88DuoBxwN9WHFhGeLhCjjOMZx442ooe5HSldGUZtFzuC4M9u1JatS4EpxZDb5fUyHOFWML+Ovl8XGDuKv06Fttk1AVM2C5WVyJPmW+OLg/1oubPo0kl1IKAMpKEAlGUnrU94341GlyIj8d9pwhcdYca4u0lJCgrkduY5UufcZdzmvTZLpU+84t1RHZAUpRUrhA2SMk7DaimG5HR5GmY8iCi5qs101PL9Bt7SojD6gqI2qG2vrVdWgnhJJSnOw4FcWSRVnYtB2a2s6eu1xs6D1FxtjcgrkPKYkpkAklSlNhsgHhUerJAHZOc5rj6HHGiS24tBKeElKiMjw9XlQW44tCUKcWpCRhKSokAeAFG0NyOvno9sctU+XI09dowdkymn47CZC1WkNoBSSOrxlWes+EKU8GAORNZTWWk4lp0lZ7pCtUqIh/qkOPzVuNvOuFriVhtSQhTeclK2yRjAVgkVjOvfPWZedPW4C8rPbxyz4+2kqW44lKVrUpKBhIUSQkeA8KaTE5I6PH0NaBpduc7a7gtlFqF1Xey+RFcdB3hgAcIJ3b+Nx8e+MbVV9MMxuRriVGZjrix4TbUZqOXitDSQgHCAQOBO/xQOeTzJrG8a+q6rjV1eeLgyeHPjjlnzoEFRJJJJ7zTS5E5IQBSgKMJpWKohsICrqC3mK37f9RqoSmtFbo6vQ2iRzBP+Y0mY5HwILee6oN1TiOz+Wv6k1eiMT3VV3xgojskj5a/qFOJEHyUChvSSNqdUneklO1M6UxvFFTnDRFO9BVl5o6wx9TzpVnJWLjJir+1uFhKVyU4WGznnxpStA5dpSa3lp6P9N3KSlq3Wy5XiC/cHLdInsS+FNsbaS2FSV9nhwslxwcZCQlITzya5Pw94o0KWhCkoUpKVjCgDgKHn41LiylJG8k9HrarGq9RYM421GnW5xmcRLJmdYlK0hWMHmQUcxzOwqTprR+m5tv063LjS3Z11Zly+ISVJ6wsLdShhtCUE5Xwpyd1bYSMmudca+AI41cIJITxHG/Pah2hw9o9nlvy9VLaw3I2Go9LW2Dra2WpuDdo7EvqDIiJaWH0FSyFJaDyUqOUgFPGBucb4yda5pC12ibqWENJLlrcsCZsWMJD5fQEy0IUrgcaS62vh7RBHxUqIPAvI5GsqdWVuKUtSjkqUcknzNKLzxdLpdcLihgrKjxHbHPnyocWG5Hb7bbm4l6Q2papBM6J8I+lJUQbOtWNgBjfbbuHM71zrRFls0qyXS7Xa3ybgY0yBDaZaklhPw/XBSlEJJOOrGOW/PI2rKFbhOeNedt+I+GPqpI4gkpCiEnBIB2OOVG0NyOpjTFhZukhVkbnQhb13u2uOmV1hlBiC4tDh7PZ4sEKA2wdsc6bd6P7U05pl1VgvCYUpaGpCQXfTH1FjrDhko7SAQo8bJV2MDZRFcwBUDspQO/I+POlda9ls9a58F8TtHserw9lG1huR1c6Jt7BkwpsZ9qCm6trMJiSrIQbe68O242HEq7PJaQU8iDzqsiaQsN3bt96hWqXwSrXIltWVuWVLkvsyA0UIcI4iCglwpAKsIUBzGOdKW4oqUXFlSjxElRyT4+upVrucq0SQ/HTHcISUcElhD7ZB59lYI7ufPzo2Me5FzrjTzdruLSoFrlQ4/oMaQ804513o63B8VSwB8rYZ3HI7g1me6p10u068yzKmuhbhQhsJQhLaEoSMJSlCQEpSANgBUTh2q0iHIQBR43FKCaPhqkhWBI2PqrQOtfCr9dUiUZBwNztWvchFLqwQMg4q4gmUshvhjyDj+aP1iqNSd6102EoQpRA5NKPuIP6qyricGiRa6DGN6GKWRvREVACcbURpeNqLhpAdOtFns970hp22ToLxlSo13eYmNOcBZLIU6Mp4fhMlGDk7A7YNLZ0Dp6HpuFdb1Elxmo67euY81JWtL7MkHiIUWwgKSMKAQVAYKVZO9cwC3E4wtY4cgYUds86MuulsNlxZQkYCSo4G+eVRsZVnVLb0Y2aC9It1wakXC92+Ol+RDaW7hzrXilBCWkKXwpaShZKRzfTnZO+Ti6csj/SQ7pvr5aLe9Kcgx3pALTjLigUNFwED4rhSFAgZAPKss26604HW3HEODktKiFD286QU53O9G1hZ0tjQOm1PAqmOrS47DgdUiQlSmpS5CW3AVJBBylqSoDuBbO4Ip2Lomw3lcWZbbTLbjx5k6JIjvTFrVIRHQ0oODgbKysl0AoQnkMjhAJrmAynGCR37GltuOtqCkOLSpJ4gUqIIPj66W1hZ07U+lrPp2warhxrI/JdjSrY+2+paw5EQ/EccIIKAoISo4PFw5yni3SM1un9E2y8aGcuSostl9BK5NwkqcbYjth5KOJrCC27gK7SFKSvIPCMc8EXXTxfCLPEOFXaPaHgfGh1jgaLQWvqyeIoyeEnxxyzRtYWdWX0a2dy6NxHbNd7WkS5MCN6RJBVdOGO8tt1vKRvxoaHYylXWpA354XV2mHNMR7E3JiyYk2ZbTLkNPghSVF95A7JGU9lCdj+uqRTri+DicWerACMqJ4R4Dw9lJWpbqytalLUSSSokk01FhZ1B7QmlbheFWqO3PtbNvvcO2SpjsoOF5t/rOJWCkJQQW8JPLtdrxqUejrTxvTQVbbtHUmC9INsdblDr1odQgBKiyHVAJUpS+FBwUHBxnHJiVKzlSjxHJyc5pwyZCnUvKfdLqdkrKzxD1HnS2sLOt2TQVpgalZXBsV8vCxeI8cskllVsRwsucbqVIyQStYSVhI4WySATtyq9pxebgAAAJLowBgDtnuqMHHAtZDi8ubLPEe137+PtoseNVGLQASNqWgUSRtS0CrBFpa08TCh+P8AqFT+qIpqzsZh8ePjOK+gAVPLJqZM0SM/dB/KP7ifqqCRVpeWyiUnbm2k/q/VVcQPOpsTQ0RREU6pI7s0giiyaNp0f6PgangzuugT5c4OJaj4WtmNjgUogvJbWlLmQMBzhRjJJq+vFitsm3oXHgKs7C9M295yUOFbbvHJitrWcoxlPEoqKSDnmeYPL0uutIWht1xCXBwrCVEBQ8DjnSCtwoDZcXwAEBPEcAE5O3r3qWrA65B0ja7ZdL7bZFouNht6bfLjLu1w4pCH2kPsYfQkNjtYIOUEpwtPLclELoysJEz023XZsm4PRFNMLdkOQWkNoU2vLbJQ4pwKKwVFCCgZSeZHJ1PPLSlKnXClKeBIKyQE+A8vKjTIkIC0ofdSHEhCwFkBSRyB8R5UqYHRbdpDThuVstqrReJch2zx7ktYW6ttx11DZ4VJZbUttoBSiFAKPFwg7GoekbJBja81FZ5dl9LMeDdG2YnpAeUhxtlwgJWEYWocJCVBIOcKAyMVhW3nmnA4284hYHCFJWQQPDI7qShS2lhxtakLSchSSQQfXRTA6BL0FbU6dfkNQrihLNpRdBe1vZiOuq4MxgODGxKmh2uLrEnIxsH9MdH9juOh2brLFwkPy/S+N6I26v0IspykcKUFBJ+MrrFJ7JGPGucl14sBguuFkK4ur4jw58ccs+dBDjrba20OLShz46QogK9Y76dMDq56JLYq12cShJtr7k23RZMoOLcZcTJSoqWla20oOOEY4CoDiwonnS5GmbWq0aei3DSt8tTZk3R0w3Qt10qS3GShS1IbDgayCCQk4VnGxwOTF11bYbU64pCRgJKiQB4YpQkyEvB9L7yXQMBwOHiA5c85pUwNNE0xDa6RZtiuMOUqPEekIWxBUuQQUJUUgqSjjLfEBxKCOIJycZFbW16biWiZGhJsI6+Nq2C2qQHS+I6FdWUhRLaTwniI4V8JycEcQNchQpxpwOtrUhwHIWlRCgfXzow68OPDrg4yFKws9o5yCfE53oaA6c1o/TWqrqxKjwp0Br0y5RnIqZKnlzHGGkuoCSG8pUsrIISlWw7Izzh3/S2l7LCu1x+1t2WthMJCIjjrjCI7z6Xyd3Gg4tADaFJyEk5wSQMnnYK0kEKUCDxDBOx8fX50ta3XSpTji1qUQVFSiSo+eedFBQ0kUoCjSnelpTvTbGkBIqfBHwKvyv1VDCanw0FLBPio49gH7ahsuKFkUQG1LUKSBWZQWKBoyKBoGTU0QG9BKqIK3rE8WhZGwpSBSSrYUaVUEtEpDTcphyItSUdZhSFqOAlYzjPkckH157qpZNvdZWtDjakLQeFSVDBSfOrVK8GpJkocZS3IZQ+lI4UlWQpA8Aob48jkUra6CTaM0IazyBOKkRrFLmqCWGuInYAqA4j4DJ3PlVtwRc5Sy8PU9/8A60B6IBvHeJ/txj3cFDnPsN5JdjPybe9GcU262pC0nBBGCDUZbJHdWrlyhMCEyBIcCRgFTwJx6+DNQlxoauUd4f8AnD92tIZJf7i45X3M8pvFJ4KvVQ4fey9+eH7tJ9Bhn+ae/Oj92tlNGqylIE0AmroQYn9C9+dH7tD0CIP5t786P3areh+Kil4aHDV2IET+ie/Oj92gLfE/o3vzo/dp70HiopOE0OGrz7XRP6N786P3aULbD/o3vzg/do3IPFRQ8Prowmr77Vw8/Eex/aD92lC0xDvwPfnB+7T3IPERQcFHwVohZ4hPxH/zg/dpYskT5r/5wfu09yF4hmgjelpbJrTt2CGr5L/5wfu1KY07ASclp9zyU9gfQkUbkJzM5bLW9cH+rbGABlazyQnxP6h3mtZ6KkBKW0lKEgJSPAAYFT48RpptLTLSGmxuEIGBnxPeT5mpTUMKxtScrIdsrBEJxtSJlmNwiLjjgSskKbUo4AWOWfI5IPrz3VoW4OcbVKatueYpJjSOOyobsd5xp1tTbiFcKkKGCk+dMKbIFdnnaUh3VCRLjBwpGEuJJStI8Aod3kciqlfRXDc+JOlt+SmkLx7dq0UkbI5Z1ZodXvXVE9ELCv8Aekkf/Dp/bS/vONd11kfoyf20bkOmco6s0Or25V1kdDTOP+9ZOf8A3ZP7aMdDTX9ayf0ZP7aNyHTOS9WfCh1Z8K6yehprvusj2Rk/toh0NtHldZP6Mn9tPcgpnKA3RdXXWB0ONf1pI/Rk/tpJ6HGu66Sf0ZP7aNyCmcpLZodWa6v95xk87rJ/Rk/tofecZ/rWT+jJ/bRuQUzk4QaPgrqv3nGh/vWR+jJ/bR/eca/rWT+jJ/eotBTOU9WcUA2a6v8AedZO320kfoyf20Y6G2j/AL1k/oyf20Wg2s5PwHNGGziur/eabz/3pI/Rk/tox0NN8vtpJ/Rk/tp2h7WcoCPXSg0SRiusDoZZH+9JP6Mj9tTIXRFbmFhb7kqXj5KyEJ9oTuffTtBtZzrS1jcuEtL62z6MwoKUojZahuED24z4D1itkm1qOSU5JOTW3Y0wlltLbbCUIQOFKEjASPACnzp/h5I+invRVHPl23hPabCkkEEeIOxHurB36yPWiV1SgpTSt2XCPjp/eHIj9RrvC9P8XyKhS9LtyWlMyI6Hmlc0ODIP/wDXjS3Fo8+lG9EUGuvS+iW3POFTL8yKDvwjhcA9WcH6TUQ9EMfJ/wC05X6Mn9tFodHLOA4ouA11I9EUf+s5X6Mn9tD70Uf+s5WP/dk/tpWgo5bw0OGupDohjk/95yv0dP7aM9EEf+tJX6Mn9tFoKOWcFDgrqf3oI+P+85f6Mn9tAdD8c/70lfoyf20Wgo5YUGgEV1X7z7A53SV+jJ/bQHQ+x3XSUf8A4ZP7aLQUcq4KBRXVB0PsH/ekr9GT+2j+86x/Wkr9GT+2i0FHKgihwV1X7zzH9aSf0ZP7aA6HGD/vWT+jJ/bRaCjlXBRhBrqw6HGM73SV+jJ/bQ+84x/Wkr9GT+2i0FHKQjtUZR666n955nP/AHrJ/Rk/tpJ6ImUne6Scf+7p/bRaHRy9KKlwYL02QhhhHE4s7eAHeT4Ad5roieiuI2rtT5jg8A2hOfbvVtE0rFtiC3Fj9WFY4lEkqV6yfq5UWhpGaatYjMtMtjKG08OfnHmT7Tk0pUM+FapVsSOaajvQAM4TWcmWmYu82lcuOlbKSp1nOEjmtJ5geY5++sqpuuoOwuHO1V1wssKeVLfYIdPN1s8Kj6+4+0ZqNw6s58UmklNax3TMMHsvyh60oP6qjuadipH4eSf7qf2UbkLaZpSdqLhrRGxRf6aR7k/sppVljA/hZHuT+yjcg2lFweVEUb1eG0RgM9bI9yf2UX2qi/0kj3J/ZS3oW0peHai4auTbIo/nJHuT+ykm2xR/OSP8v7KN4bSo4aARVsbfF+fI/wAv7KHoEQclyP8AL+yjePaVIRSuCrVMCJjdcj/L+yh6DF+dI/y/spbw2lVwZoBFWvoMYfLf/wAv7KAgxfnSP8v7KW8e0quClBG1WZhRfnv/AOX9lH6FGA+M/wD5f2Ubh7SsCBmlBFWAhxs/Gf8A8v7KUIsQHf0k/wB9I/6aNw9pCZYW64lttJUtXID/APrlVgpKW0oaQQQgY4h8o8yf2eQFOF5DbSm2W0soUMKxklXrUdz6uXlTPEDU2OglUkUalUlJ2pCAaNW1JJ3FGpVADyVUAvzplK6AXUUeRRIK9udGlfnTBXsKNK/OiiaJAcOedOFw8HOonHvSyvs86VC2jwcPjQLhzzpkL86JS96KDaPFZxzpJV503xbc6HFToNotRogfOklW9GDTHQYo6SDR5qkOhYFGBvRJNKHOmFBgUtIohTiRvTHQAmnkJ7NJAp9tOU0BtAhBp9LdBtO9SUo39lMe0NhrapbTR2oRm8iprTYyKZW0UywCRip0aPQYa5VYxGqLKUQmYvLarSNBzjahHZ5Zq5iMAgUWUkNR7ZxY2qxYs/Efi1YwowJGau4kJJPKiy0ijYsOSOxUyJYFTXFNw4zsxaDhYYRxBB8FKyEg+Wc+Vaq2Wf7aTVRyFJiMAGQtJILilDIbSRy23URvggDGSRs48dmKwhhhttlpsYQ2hISlI8ABsKLKUTl50bdBsLLLJ8nGP4lJGjLvkZskz85H/iVr9T9JuldG3Bq3Xq5qZlutdclluO48oIzgKPAk4yQcZ8Kpj09aDwSLhcVfk2yQf+mjklzxp02VJ0bdj/uOZ+cj/wAWi+4y791kmfnI/wDFrZ6T6StL62kPRbLci7KZR1i2HmFsucGccQSsDIzgEjOMjPOtRiiy47ZK0ck+4y7/ANRzPzkf+LQ+4u7/ANRzPzkf+LXXCnfGaMJ7jRY9qORfcXdv6imfnI/8Wh9xd3H+45n5yP8Axa69w92RQCRnY5NFhtRyL7irt/UU385H/i0PuLuw/wBxTPzkf+LXXuChwUWOkcgGi7vnP2jm/nI/8WlDRt3B/wC4pv5yP/FrrnCD3/TQ4fOi2FHJPuNu/wDUc385H/i0E6Ou4x/2HM/OR/4tdb4R4igEjnmi2FHJjo+7f1HN/OR/4tAaPu2P+45v5yP/ABa60UYoBG21G5hRyb7kbsP9xzR/5kf+LRK0hd+6yTfzkf8Ai11rg3oikDnT3MKOS/cbdf6kmn/zI/8AFps6Kuxz/wBhzPzkf+LXXeHfnR8FG5jo5ArRF1x/3DN/OR/4tJOhrp/UMz85H/i12FSQPD30XCM8xRuYUcdOhbqR/wBwzM/2sf8Ai0BoW64A+0U385H/AItdi4QTjI99Hw55UbmBx1OhbqD/ANxTfzkf+LQOhrtn/uKZj+0j/wAWuxcOOdGEUtzA479w92x/3FN/OR/4tAaHuw52KZ+cj/xa7Fw0RSKNzA4+rRF2/qOZ+cj/AMWh9xF2Gc2Ob+cj/wAWuwcPhQKKNzA4+ND3bf8A7DmfnI/8Wh9xN2/qOZ+cj/xa6+Ukd+KASO8ijcwOQDRF2zvY5ntcj/xaNOibsDvYpn5yP/FrrpTg7kCj4cYyae5gcjOirqRj7RzPzkf+LQ+4m6kD/sWXnzcY/iV1soOcZocGOdLcwOQu6JuTbZcctMpIAySAhZHsQon6Kql2ELRxoCVI3GR4949flXcyjas7qLTImBy4QWkJuOAVDkJSR8hX42Nkr5jzGRRuYHHnrJwq+L31XybUUq5bV0F2K1IbbfZBLbgCk5GDg+PnVRNhAHlT3BZhn7dgHAqqkQyM7VtpMTsq2qjlRsZ2pWUZSTFIzVe+xjNaSUwd8iquQzzpDTM+8xzqFIZwKvHWsk5qDJawOVIqyoU1t7KjLb7Rq0U3vy7qhuo7RpBZCWjs00U1LcT2aZI2FA7Iygc02RT6xg02oUgsaojSjSSfOgLCHI70WfOgOVFmgLFE0AedIKqIK50DsUVUCrsimyrzoFXZG9AWLCt6JSt6bCt+dEVb0BY4V9nnSeKkFXZpIVQKxxSvOiSrbnTal+dEle3OgVjhVQUrcU1xbigpW4pgKSvzoBfnTCV+dALqaPOokle1GF+dR+PYUYXRQqJHHvS+Ps1F496Xx9mlQqHwugV70wlfnRle9FCof4tqAVTIXtQCqY6HyqlBVMFW4pQVQFDoVSs00lVKCqYUPpNKSd6aQqlpVvTHQ8DTiOdMpNOoNMdD6akN/FqMk1IbPZoHRJaG9SkDf2VFaNS0GmOiZFHZqc0nlUKMdqnNHlQVRPjjlVlETVdHPLlVlEURigdFpHQNqu4SBtVNGPKrqGvlyoHRfQGhmtFAZSVAHYZrPQHMEbitDBdGeYoKNNpRGLT1qk4U8++4ryPWKSPoSkeyrhQwKotNSUtKk28ntBapLeT8ZC1ZVj8lZI9Sk+NX6hkUFnnzpHuc60a41nMt0x+HJEWztpeYWULSlROQCNxnG9Zi26i1lfWXUR9WXdL7J43OvmuNMoZxu4p3iwkJI3BGTkcOTtXVelfo7uV4uA1BZI4nrXGTDuFsLgbVJaSorQ40s7JdQo7Z2I233B42iykSpNv+02opExXClLKba6hxk53K2xkLPIABQSc5yOVaxqj5z2lDMsylG9r8m/6G46OZz0zXWj3HrlIuS/Rbw36U/wAXG6hKk4+N2sb7A7+rlXoEE91cq6Kuju52u5tX+8RvQRGgm32+ApQW60hS+N154p7IdWo/FTnhG2TXWQgCs2e3pISjjSl1OM3a76k090mLnaonarh2R65sx7Y/bFMuWrqVcKUtSW+EuJWpZIK/FQxjFVc7peUx018H3UoTamLs3pxVl4wCsqaPHKKfxXyhGfAGumK6JNGm/wD29VaVKmGV6dwGU8WPSc567qeLq+PO+cc96lr6ONLvaZf0y5akKtchxTzrZcXxqcU71pX1mePi49857h3UHSc30vMu9+6Tr+3Lumv1x4OolR2E29bf2saaQlC+re4hxYJJBA7lDxzTPQpNv2o7hEu10mdIT4VJm5ddkMG0LSh1xCU8P4TYAD8pPhXYrLpy12B24O26P1K7lLVOlK41KLjygAVbk42SNhttVHYeijSOmrm1cbTBlxX2XFuoSm4SC0FLzxfBFfAc8R7ue9ICx1RqeVpxUVMbTF9vvpHHxG2IaUGeHHx+scRjOdsZ5GpcafMudh9OagvW2Y6wpaI1w4QpleDwhzgJGM4JwTtVnjPhTMuGxOiPRJLSHo76FNOtrGUrQoYIPkQaAOAWPU+orBGvcDVN11nD1Q9p+dKaRNejvW+Q622VF6IttOUFPMJ5AHfJFLkdIuobJqvo+mybu8qx/cvCm3tLznZWH1pZMhW3NK3G1E7bZ866daOh3RNjEoQrOrEqIuArrpTz3Vx1jCmm+NR6tJHcnFTj0c6XUtCl2ll0ItIsYQ6pS0ehAghopJwRlI357c6YHA7p0kazuFj6Tr59tp8Bj0W3T7K0y7wqixnZJQlQGOypbaQo+PFVnfNW6otulNSrst81XIscZdtEG7XdlUeX6QuSlLzSFKQhTjfAdyU7HblXZ7n0aaVvDd0bm2lC0XViPGlpQ4tAcbYOWkgAjhCT4Yqy1Ppa0ayszlmvkX0yA6pCltFxaMlKgpJ4kkHYgHnQBh+ni6XO32/S7Fsl36OZ19bivJsjiW5TzZZdPAgr7PNIO+21aro8iyI2mGBKXqUurccUU6hdbcmI7WMKLfZ4dsjHcagu9EGjn7Wm1vwZr0VEtM5AduUla0PBBQFJWXOJPZUdgcb5rQae07b9L24W+1ofRGC1LAekOPqyefacUpXszSArdP6um325OQ39H6js7aEKWJVwQwGl4IHCOBxRyc5GRyBrCdIVjux6S9L2+JrfVlviakemiQxFloSiOGY3GkNAoPD2hvnPM8q6/jB7qrrhp22XO8Wu8S43WTrSXVQ3eNQ6ouI4F7A4OU7b5oA89X/VeqI2ur/bbRqLVpvTV6j26zR1cCrY7lptS0PlaeEKKesVgEHvArUzdWX1nRfTHJN3molWi5SW4DhcwqKgNNqQEfNGSceuujXDo10tdW7o3LtYc+20pubKUHXEqU+2AEOJUFZQoADBTiol56ItF3+8rvFyswflultT49IdS1KLeOAvNhQQ6RgfGB5UAc31ZeNU2W8pvmpbpq6HpdDMMxp1hdZUzFyhHWemNKTxklRyVbjBGBV0zYLqOmhyxHXOr125u1NXoMmYjCnFS1ILZ+D/AAXCkDh5+da68dEGi79enbzcLOXpL7iHX0ekupYkLRjhU40FBCyMDmO4VoRp62jUKtRCMPtoqIIJkcR3ZCysIxnHxiTnGaAOMdDFwv8AqO5pn3ad0gPgS5yA+p5k2paELWhKSPwnEMYGMDiAqBorUOp7FpLQWsJGrLzeF6jubNtnWy4LQ62tLrjiAtnshSFI4QrmQe+ur2Ton0lp26N3O1QZcaQ26t5ITcJBb4154iWyvgOcnmKRp7oe0Tpe4xrja7NwSYnF6KXpLryY3F8bqkrUUoJzzSBTAyXTHdLw1rjSlpgzdWNwpcSc7IY02pAkuKR1fArt7YBVvnxrNRtf63sOj9Na1elyL6/JRIsNwtZwjhnda4IyynCQHAtKW3MbEHIzXYdV9HenNayIcq9w33n4SVojusS3Y60JXjiGW1JODwigro60v9z8HTyLS0za4EhuVHjsrUgIdQvjSrIOSeLc5JznekBltUzdS9HnQ+grvapmoSqPGeukrCw09IfShbgGw4UcZ4QdgEjNV+t2L30U6Ius+36zv10kyVxYqHbutt/0FTrwbU+nCEkDBOEns5ArqN3s8C/2yTa7rEZmQpSC28w6MpWk9xrNWzoi0ZaYdxhtWf0hq5MiPK9NkOyVOtA5SjicUSEg7gDGDuKAOfaqmah6N5d7scbV95vDMvSlyuba7i6lyVBksJ7LqFpSnCFZwAflJyKvNVagvMPQ/RvLYuMxmVcbtZmJbqVYXIS4j4RKjjcKPOtNauiXR1miXKLGtS1pucVUGU5IlOvurjkEFoOLUVJRg8kkVGHQpodNtVbPtbMXDLzL6Wl3OSrq1tBQbKCXMoxxK+Lju8BQBnOmi6XpjWGjbVbJeqG485u4LkxtPONIkvdWlooI63s4BJznuJxUSJbb3qnW0XTa9X6xssK3aejzlNGS2ie+8664CX1BJSSgJAIAxy38dlI6HdHTI0GNIhT3UwFvORnFXOT1rZd4eP4TrOLB4E7Zxt505ceiXSN0iW+NIgyv+zkKajvtz325CW1HKkF5K+NSSTyUSKAMZrfT17i6n0Xb/vgasQu8vqgTFRJDbCFhqMtfWoQEEJWpSUk8xzwBVfPk6lu1q13fmtb3m1r0Y8/DgRWi11b3ozCV9bJCkZdLpPkB3V1ZrRGn44sSWbahpGnyo21KFqAj8SCg4Ge12SRvnnVbf+iTRmp7u5drpZw/Kf4PSQmQ623L4Pidc2lQS5jAxxA0AcW1p0jXtV5euBverbW8vT1tmQo1oSlcRqfISrhQ+FpKQlSuEbkZ378VoNW3bXNlu7d11fcNT2qzx4EVQl6YSy7GhyerHpBltKSpSk8Z2OOEJx5mur3Lo/01d3Lsuda2nzeIrcOaFKVwutN54EgA4Tw5JBGDnHhVPO6FtE3KX6XMtsp9xaGkPhc+RwSg2kJR1yePDpASBlQOcb5oA2iHUOsIcbcDiFJCkqHJQIyD7aMAkZpXVAIASAABgAbAUzKlM2+I7JkrCGWUla1eAFAGGVGS0/cGEo4UtTn0pHkSF/Ws1TzmQM1eMBaYynH0Bt6Q65IdR81S1FXD7AQPZVVcMZPKkBnJTXZVjxqgmN4zWmkfEVy51npvfyoGUEtB3qpkI3NXczvqok99AyodRucVClp7NWT2xOKgSx2aQyuUn6qgup7RxVioDOPKoLoAWaAsiOjs0wRgVJd+LUdQoGR1jemlDanl86aWaAsZNJVRqO9IWaACzzpOaGedIJoCwyqk8VJUqkcVAClKoFXZG9NKVQKuyKAsWF70kr3psK350RVvQFjpX2aQF0kq7NJCqAscK/OiCtqbUqiCtqAHCqgpXnTXFQUqgAgqhxU2FUAaDjoe4tqMKprioBVAqHuPel8fZpji3o+Ls0hUPJXRlW9MpVQKt6AofCtqMKpkK2owqgKHyqlBVMcXKlBVAUPJVTgVUdKqWFUwokJVS0r3phKqWlW9A6JKVU8he9RUqp1Ct6Y6JaVVIbV2ahpVUhtWE0BRNaVUptWTUBpW9S0K+qmOiyjK2qa0rcVXRVbVNaVkigZax1cqsYzh2qpjq5VYRlcqBl0w58XlVxFd5cqzzK+XKrWM5ypDNNCeweYq7iSig5yKysN7CqtmJGPDnQM1CHQ+WnAtTTzKuNp5B7TasYOO4gjYg7EVfRdUOtI4Z8Nasfz0JJcSR4lHx0+ziHnWNjSuXKrJmX6qBmp+6+z8lOyB5GG9+5QOrrOOz6TJx4eiv4/0VRJmK4T2j76eRLVj4x99Ay5TrGzJGA/I/Q3/ANyjGsbOd+vkfob/AO5VSJSvnH30pMpXzj76YFr92NnP89I/Q3/3KH3Y2cfz0n9Cf/cqs9KV84++j9IPzj76ALH7sbMP5+T+hv8A7lKGsbP/AE0n9Df/AHKrfSCflH30YkH5x99AFl92Nn/ppP6G/wDuUPuwtH9NJ/Q3/wByq70g/OPvoekKPyj76AssPuxs/wDTSf0N/wDcofdjZ/6aT+hP/uVX+kK+cffQ9IOPjH30AT/uxs/9PJ/Q3/3KP7sbPkfDyP0N/wDcqu9IPzle+j9IVn4x99AFgdY2f+nk/ob/AO5QTrOzY/Dyf0J/9yoHpB+cffRB8gfGPvoAsfuxs/8ATyP0N/8AcojrKzj+fk/ob/7lV/Xn5x99AyD84++gCw+7Kzj+fk/ob/7lH92Fn/p5H6G/+5VeHz84++iEhXzj76ALE6ys/wDTSf0J/wDcoDWVn/p5P6G/+5UAyFfOPvodefnH30ATvuxs+fw8n9Cf/co/uxs+Pw8n9Df/AHKgB9WfjH30fXq+cffQBO+7Gz4/DSf0J/8Acovuxs/9NJ/Qn/3Khh9Xzj76HXq+cffQMm/djZx/PSf0J/8AcofdlZ/6aT+hP/uVBL6vnH30XXq+cffQInfdlZ/6aT+hP/uUPuxs/wDTyf0N/wDcqD16vnH30C+r5x99AE77srMP5+T+hP8A7lD7srOOb0n9Cf8A3Kg9er5x99JL6vnH30AWB1jZ/wCmk/ob/wC5Q+7Gz4/DSf0J/wDcquMg/OPvoekH5x99AFh92dmz+Gk/oT/7lD7s7N/TSf0J/wDcqsXJIHxj76QZSsfGPvoAtlavguN5iszpJ8ERVox6ysJA99VE6dJupQqWG2GG1BaI7a+LiUOSlqwM4O4SNs75O2GXZJPM59dRHpG3dQMVIk921U857J7qdfkdruqrmPZPdSAjPr7CuXOs/OXuatnnewrlVDLczmgZWTVc6qpCvjVYTHM5qqkL50AQXjzqDKV2alPK3NQpSuzQMhrVv7KhOntmpS1fVUJ1XaNADLp7NR1HanXDtUdR2oAaWremVqpazvTK1UhiFGm1Ko1KptaqABxbGm1KoZ502pVMAKVSOLnRE0ji3NIA1KoFXZFNqNEVdkUwFBW9EVb0gHeiJ3oAWVdmi4qRns0QNACyqiCtqQTQB2oEL4qJSqQVUFKoAANDNJBoZoMKF8VGFU2TRg0CoczvSirs01nelZ7NIKFpVRlW9Ng0ZO9AqHArY0YVSAdqANAUOlVKCqaJpQNMKHUqpYNMpNLCqAofBpaVb0yk0pJ3oHRJSqnUK3qMk06g0BRKSqpDauzUNKqkNq7NAExpe9S0L+qoDa+6pKVb+ymMsoy9qnNL5VVxl7VNaXyoAto6+VToznKquO5nFTYy8UDLhpzlVlGd5VSoVgJ3qwju4xSAvoj2FVaNSNvbWfjPYVVg0/QMv48jep7Uqs6y/vUxuRvQM0TcvsGn25dUKJHZNPtP8qALwSd6cTJqnEjNOIkYoAt/SaWJNVHX5xTvpFAFmJFH6RVYl+lB+gZZ+kUBIqtD9H1+9AFj6RR9fVb19H19AFh6RQ9Iqu6+jD9AFj6RRh/aq7r9qAf2oAsPSKBfquD1AvUAWQfoB+q9L1GHqALAv0A/UDrqPrqAJ/X70fX1Xh6lddvQBPD9Dr6gdbQ66gCf1+9EX6gF7ejL21AE0vUC/UDrqIv0AWBfpBfqEXqbU9QBOVIxRGRVcp+kF/agCwVKwKaVJ2zUBcjamlP9kUDJrkqoT0qozkiojr+1ADz0rcbDn41XS5OTTbr+/tqDKe3oAD0jsK2qllP86lOO9hVU8h3nQBHlO5zVa+5zqRJczUB9fOgZGeXuagyl9mpDqtzUKUrs0AMLX9VQnVds1JUr6qhuHtGgY04rao6jtTjp2qOpVADbh3phaqW4remFqoASpVNrVQUqm1GgAZ2NNqNGVc6bUqgAlKpHFuaBNIzvQAFKoFXZFIJoE9kUAHnekk70QO9ETvQArO1J4qInak5oAWTRA0kmiBoELzQUaRmiUaBixQBogaFBlQomgDRUBQArNK+TTffSvk0CoUDR53pIoHnQKhwHagDSc7UAaAHCaUDSKMUAOJNKBptNLBoAdSaWk700k0tJ3oAeSadSaYSadSaBkhKtqebO1RknanmztTAltqqS2uoaFVJQqgCawupiFYIqAwdqmIPKkBZR14qewvlVXHVU5lfKgC0bXsKnR3MYqrSrZNTY684oGXDDu9Tm3dqqWHO1U1DnZoAs2X+1UxD29VDTnaqUh3tYoGXDb/YNPtPZHOqxDvYNPtObUAWQfp1t/aoAcpxtzagCeH+VOddVeHOVO9ZigCal6lddUJLlKDlAyYHaPrqiByjDlAEvrqHW1G49qAXQBJ62jDtRePej46AJXW7UA7UbjoBdAEkO0ZdqKHKMroAlJdpQdqKF0OsoAldbR9btUTrKV1m1AEoO7UYd3qKHNs0Os3oAl9bQ66onHQ46AJRe3oF6opc3oFygCR11Ep6o3HQK6AJBepovc6bK+dMqcoAfW9SC9UdbmaR1lAx1x6mlvdgU045TK3OwKADceqK69tQW5UV1zagBDrtQZDu9POOb1BkOjNADLrnZVVW+5nNTXHQUqqsfXzoAivOZzUF9XOpD6sVDfVQMjOq51Ckq2qS4rnUSSrs0ARVqqI4e0akrNRHD2jQAw4dqYUdqecO1R1nagBhZ3plZ3pxZ3xTCzvQAhRpCqNRpsmgAicZptRo886Qo0AETSM70ZNI8aACUaLOwolGgTsKYAzvSSd6Gd6I86ADztSc0M7UVABk0QNA0QNAB0CaKgaAFihQoUiQzyoChQoEHSvk0KFAmBNH30KFAgxyNGKFCgQqjFChQAtNKFChQAsUpPOhQoAcSadTzoUKYx5FPIoUKQEhFSEcqFCmBJYNTWzyoUKAJsaprPdQoUATUHYVNYPKhQpATWD2qmoVtQoUDH2ieKpSFHNChQCJjZ7FSGlcqFCgY+FHNPIVtQoUAKCjtToUaFCgYpJpwE0KFIQYJowTmhQpjFA0YNChQAM0YNChQAedqGaFCgAA0OKhQoAUDRFVChQArNGTtQoUgC4jRgmhQpgHxUedqFCgBHEeIUajQoUAEFbUCqhQpAJJNMqJoUKYDayaQVGhQoAbcO1MLPZoUKAIyzvUdw0KFAyG8agvHOaFCgCIs9hVVbx50KFAEJ7vqE+aFCgCG4ahyuVChQMiL5eyojnM0KFAEd07VHXyoUKAIy+dMr50KFADKjvSDyoUKAG+40g0KFMBBpHeaFCgBCqHcKFCgBI50RoUKACPKioUKABQFChQAVGaFCgD/2Q=="
          alt="How it works — 4 simple steps"
          style={{ width: '100%', maxWidth: 640, borderRadius: 'var(--radius-md)', display: 'block', margin: '0 auto' }}
        />
      </div>

      {/* Auth form */}
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img
              src="data:image/png;base64,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"
              alt="Got One Spare? logo"
              style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 10, display: 'block', margin: '0 auto 10px' }}
            />
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Got One Spare?</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>World Cup 2026 sticker swaps</div>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20, marginTop: 0 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>

          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <>
                <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
                {inviteRequired && (
                  <input
                    type="text"
                    placeholder="Invite code (e.g. A3F9C2B1)"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.1em' }}
                  />
                )}
              </>
            )}
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={inputStyle} />
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontSize: 15, fontWeight: 600, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              {mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInviteRequired(false); }}
            style={{ width: '100%', textAlign: 'center', fontSize: 13, marginTop: 16, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>

          {mode === 'login' && (
            <button
              onClick={() => setMode('forgot')}
              style={{ width: '100%', textAlign: 'center', fontSize: 13, marginTop: 8, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Forgot your password?
            </button>
          )}
        </div>
      </div>
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

  if (loading) return <Spinner />;

  const totalSpares = duplicates.reduce((s, d) => s + d.quantity, 0);
  const totalNeeds = needs.length;
  const totalStickers = 980;
  const completionPct = Math.round(((totalStickers - totalNeeds) / totalStickers) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 20px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Spares listed</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{totalSpares}</div>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 20px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Still needed</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--primary)', lineHeight: 1 }}>{totalNeeds}</div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '16px 20px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Album completion</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{totalStickers - totalNeeds} / {totalStickers} · {completionPct}%</span>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
          <div style={{ background: 'var(--blue)', height: '100%', width: `${completionPct}%`, borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }} />
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
          Based on stickers not listed as needs. Add needs to keep this accurate.
        </p>

        {/* Per-team progress */}
        {needs.length > 0 && (() => {
          // Group needs by team and calculate progress per team
          const teamNeeds = {};
          needs.forEach(s => {
            if (!teamNeeds[s.team_name]) teamNeeds[s.team_name] = 0;
            teamNeeds[s.team_name]++;
          });
          const teamsWithNeeds = Object.entries(teamNeeds)
            .map(([team, needCount]) => {
              const total = team === 'FWC' ? 19 : team.startsWith('Coca-Cola') ? 12 : 20;
              const have = total - needCount;
              return { team, have, total, needCount, pct: Math.round((have / total) * 100) };
            })
            .sort((a, b) => b.pct - a.pct);
          return (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>▸</span> Progress by team
              </summary>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {teamsWithNeeds.map(({ team, have, total, pct }) => (
                  <div key={team}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{team}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{have}/{total}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })()}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: duplicatesOpen ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setDuplicatesOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>
              {duplicatesOpen ? '▾' : '▸'}
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'inline' }}>Your duplicates</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Spares · {duplicates.length}</span>
          </div>
          <Btn variant="navy" size="sm" onClick={() => setPicker('duplicate')}><Plus size={14} /> Add</Btn>
        </div>
        {duplicatesOpen && (
          duplicates.length === 0
            ? <EmptyState text="No duplicates listed yet. Add the stickers you've got spare so others can find them." />
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {duplicates.map((s) => <StickerCard key={s.sticker_id} sticker={s} mode="duplicate" onRemove={() => removeDuplicate(s.sticker_id)} onUpdateQty={async (newQty) => {
                  await api.updateDuplicateQty(token, s.sticker_id, newQty);
                  setDuplicates(d => d.map(x => x.sticker_id === s.sticker_id ? { ...x, quantity: newQty } : x));
                }} />)}
              </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: needsOpen ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setNeedsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>
              {needsOpen ? '▾' : '▸'}
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'inline' }}>Your needs</h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Wanted · {needs.length}</span>
          </div>
          <Btn variant="outline" size="sm" onClick={() => setPicker('need')}><Plus size={14} /> Add</Btn>
        </div>
        {needsOpen && (
          needs.length === 0
            ? <EmptyState text="No needs listed yet. Add what you're missing so we can match you up." />
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {needs.map((s) => <StickerCard key={s.sticker_id} sticker={s} mode="need" onRemove={() => removeNeed(s.sticker_id)} />)}
              </div>
        )}
      </div>

      {/* Donate prompt at the very bottom — after all sticker cards so it never jumps */}
      {duplicates.length + needs.length > 0 && (
        <DonateButton location="dashboard" variant="full" />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matches.map((m) => (
            <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <button
                  onClick={() => setViewingRatingsFor({ id: m.other_user_id, name: m.other_user_name })}
                  style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}
                >
                  {m.other_user_name.split(' ').map((p) => p[0]).join('')}
                </button>
                <button onClick={() => setViewingRatingsFor({ id: m.other_user_id, name: m.other_user_name })} style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{m.other_user_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <StarRating value={m.rating_avg} size={12} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({m.rating_count})</span>
                  </div>
                </button>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{m.a_gives_b_count} give</span>
                  <span style={{ color: 'var(--text-muted)' }}>↔</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{m.b_gives_a_count} get</span>
                </div>
                <Btn variant="primary" size="sm" onClick={() => setPreviewingMatch(m)}>
                  Preview swap
                </Btn>
              </div>
            </div>
          ))}
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
            return (
              <button
                key={s.id}
                onClick={() => onOpenSwap(s.id)}
                style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {s.other_user_name.split(' ').map((p) => p[0]).join('')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{s.other_user_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Swap #{s.id}</span>
                    {(s.display_give_count > 0 || s.display_get_count > 0) && (
                        <>
                          <span>·</span>
                          <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{s.display_give_count} give</span>
                          <span>↔</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{s.display_get_count} get</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)', background: colors.bg, color: colors.text, flexShrink: 0 }}>
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
            {swap.decline_reason && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(153,27,27,0.08)', borderRadius: 6, fontSize: 13, color: '#7F1D1D', fontStyle: 'italic' }}>
                "{swap.decline_reason}"
              </div>
            )}
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

      {(swap.status === 'accepted') && (isUserA ? swap.user_a_posted : swap.user_b_posted) && (
        <button onClick={() => act(() => api.markReceived(token, swap.id), '✓ Marked as received — swap complete! Please leave a rating for your swap partner.')} disabled={busy} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--warning)', color: 'var(--text-primary)' }}>
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
              <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} autoFocus
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box' }} />
              <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, boxSizing: 'border-box' }} />
              <button onClick={submit} disabled={status === 'loading'}
                style={{ width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
        style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        title="What's new"
      >
        <span style={{ fontSize: 16 }}>📋</span>
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--surface)' }} />
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
  const [checkingSession, setCheckingSession] = useState(Boolean(localStorage.getItem('authToken')));
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

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

  return (
    <ThemeContext.Provider value={themeCtx}>
    <AuthContext.Provider value={{ token, user }}>
      <style>{DESIGN_TOKENS}</style>
      <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        <header style={{ position: 'sticky', top: 0, zIndex: 10, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={32} />
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Got One Spare?</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <WhatsNewPanel />
            <NotificationPanel />
            <button
              onClick={() => setShowProfile(true)}
              title="Your profile"
              style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: 'none', cursor: 'pointer' }}
            >
              {user.profile_photo ? (
                <img src={user.profile_photo} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                  {(user.name || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            <button onClick={logout} title="Log out" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
              <LogOut size={18} color="var(--text-secondary)" />
            </button>
          </div>
        </header>

        {!user.email_verified && <VerificationBanner />}
        {user.email_verified && !(user.address_line1 && user.city && user.postcode) && (
          <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--warning-light)', borderBottom: '1px solid #FDE68A', fontSize: 13, color: '#92400E' }}>
            <span>Add your address so you're ready to accept swaps.</span>
            <button onClick={() => setShowProfile(true)} style={{ fontWeight: 600, color: '#92400E', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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

        <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 88px' }}>
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

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', background: 'var(--surface)', borderTop: '1px solid var(--border)', boxShadow: '0 -1px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', width: '100%', maxWidth: 640 }}>
            {tabs.map((t) => {
              const active = tab === t.id || (tab === 'swap' && t.id === 'mySwaps');
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: '12px 0', fontSize: 13, fontWeight: active ? 600 : 400,
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    borderTop: active ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'none', border: 'none', borderTop: active ? `2px solid var(--primary)` : '2px solid transparent',
                    cursor: 'pointer', transition: 'color 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {active && t.id === 'dashboard' && <Package size={14} />}
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        <FeedbackWidget />

        {/* Footer donate link — sits at the bottom of content, above the nav */}
        <div style={{ textAlign: 'center', padding: '8px 16px 4px', marginBottom: 4 }}>
          <DonateButton location="footer" variant="link" />
        </div>
      </div>
    </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
