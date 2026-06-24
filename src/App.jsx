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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.2px' }}>{title}</h2>
        {eyebrow && <span style={{ fontSize: 11, fontWeight: 700, background: '#1AAB8A', color: 'white', borderRadius: 4, padding: '2px 6px' }}>{eyebrow}</span>}
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

  const LEDGER = [
    ['FWC1','FWC','World Cup Trophy — FOIL'],['FWC2','FWC','FIFA World Cup 2026 Logo'],['FWC3','FWC','Host Cities — North America'],
    ['MEX1','Mexico','Team Photo'],['MEX2','Mexico','Omar Govea'],['MEX3','Mexico','Santiago Giménez'],['MEX4','Mexico','Edson Álvarez'],
    ['ENG1','England','Team Photo'],['ENG2','England','Jude Bellingham — FOIL'],['ENG3','England','Harry Kane'],['ENG4','England','Phil Foden'],
    ['ARG1','Argentina','Team Photo'],['ARG2','Argentina','Lionel Messi — FOIL'],['ARG3','Argentina','Julián Álvarez'],['ARG4','Argentina','Rodrigo De Paul'],
    ['FRA1','France','Team Photo'],['FRA2','France','Kylian Mbappé — FOIL'],['FRA3','France','Antoine Griezmann'],['FRA4','France','Aurélien Tchouaméni'],
    ['BRA1','Brazil','Team Photo'],['BRA2','Brazil','Vinicius Jr — FOIL'],['BRA3','Brazil','Rodrygo'],['BRA4','Brazil','Casemiro'],
    ['GER1','Germany','Team Photo'],['GER2','Germany','Florian Wirtz — FOIL'],['GER3','Germany','Kai Havertz'],['GER4','Germany','Joshua Kimmich'],
    ['ESP1','Spain','Team Photo'],['ESP2','Spain','Pedri — FOIL'],['ESP3','Spain','Gavi'],['ESP4','Spain','Rodri'],
    ['POR1','Portugal','Team Photo'],['POR2','Portugal','Cristiano Ronaldo — FOIL'],['POR3','Portugal','Bruno Fernandes'],['POR4','Portugal','Rúben Dias'],
    ['NED1','Netherlands','Team Photo'],['NED2','Netherlands','Virgil van Dijk — FOIL'],['NED3','Netherlands','Xavi Simons'],['NED4','Netherlands','Frenkie de Jong'],
    ['BEL1','Belgium','Team Photo'],['BEL2','Belgium','Kevin De Bruyne — FOIL'],['BEL3','Belgium','Romelu Lukaku'],['BEL4','Belgium','Thibaut Courtois'],
    ['USA1','USA','Team Photo'],['USA2','USA','Christian Pulisic — FOIL'],['USA3','USA','Weston McKennie'],['USA4','USA','Tyler Adams'],
    ['MOR1','Morocco','Team Photo'],['MOR2','Morocco','Achraf Hakimi — FOIL'],['MOR3','Morocco','Youssef En-Nesyri'],['MOR4','Morocco','Romain Saïss'],
    ['SEN1','Senegal','Team Photo'],['SEN2','Senegal','Sadio Mané — FOIL'],['SEN3','Senegal','Édouard Mendy'],['SEN4','Senegal','Kalidou Koulibaly'],
    ['COL1','Colombia','Team Photo'],['COL2','Colombia','Luis Díaz — FOIL'],['COL3','Colombia','James Rodríguez'],['COL4','Colombia','Davinson Sánchez'],
    ['JPN1','Japan','Team Photo'],['JPN2','Japan','Takefusa Kubo — FOIL'],['JPN3','Japan','Daichi Kamada'],['JPN4','Japan','Wataru Endo'],
  ];

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#fafaf8', display: 'flex', flexDirection: 'column', fontFamily: "'Nunito', -apple-system, sans-serif", overflow: 'hidden' }}>
      <style>{DESIGN_TOKENS}</style>
      <style>{`
        @keyframes scrollLedger {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
        .ledger-scroll { animation: scrollLedger 40s linear infinite; }
      `}</style>

      {/* Forgot password mode */}
      {(mode === 'forgot' || mode === 'forgot_sent') && (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8', padding: 24 }}>
          <div style={{ width: '100%', maxWidth: 340 }}>
            <img src="data:image/png;base64,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" alt="Got One Spare?" style={{ width: 32, height: 32, marginBottom: 24 }} />
            {mode === 'forgot_sent' ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0B1120', marginBottom: 8, letterSpacing: '-0.5px' }}>Check your inbox</div>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>If an account exists for {email}, we sent a reset link.</p>
                <button onClick={() => setMode('login')} style={{ fontSize: 13, fontWeight: 700, color: '#1AAB8A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Back to access</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0B1120', marginBottom: 8, letterSpacing: '-0.5px' }}>Reset access</div>
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
                <input type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box', outline: 'none' }} autoFocus />
                <button onClick={async () => { if (!email.trim()) { setError('Enter your email'); return; } setLoading(true); setError(null); try { await api.forgotPassword(email.trim()); setMode('forgot_sent'); } catch(err) { setError(err.message); } finally { setLoading(false); } }} disabled={loading} style={{ width: '100%', padding: 12, background: '#0B1120', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
                <button onClick={() => setMode('login')} style={{ fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer', marginTop: 14, fontFamily: 'inherit', display: 'block' }}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main login/signup — catalogue portal layout */}
      {(mode === 'login' || mode === 'signup') && (
        <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>

          {/* LEFT — scrolling sticker ledger (60% width) */}
          <div style={{ flex: '0 0 60%', overflow: 'hidden', borderRight: '2px solid #0B1120', position: 'relative', background: '#fafaf8' }}>
            {/* Header strip on ledger */}
            <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#0B1120', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '2px solid #0B1120' }}>
              <img src="data:image/png;base64,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" alt="" style={{ width: 22, height: 22, objectFit: 'contain' }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: 'white', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Got One Spare? — WC2026 Catalogue</span>
            </div>
            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: 0, padding: '6px 20px', background: '#f0efed', borderBottom: '1px solid #ddd' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CODE</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>TEAM</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>DESCRIPTION</span>
            </div>
            {/* Scrolling rows */}
            <div className="ledger-scroll">
              {[...LEDGER, ...LEDGER].map(([code, team, desc], i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 1fr', gap: 0, padding: '7px 20px', borderBottom: '1px solid #ebebeb', background: i % 2 === 0 ? '#fafaf8' : '#f7f6f4' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#1AAB8A', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{code}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{team}</span>
                  <span style={{ fontSize: 12, color: '#666', fontStyle: desc.includes('FOIL') ? 'italic' : 'normal' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — access panel (40% width), left-anchored within its column */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', padding: '0', background: '#fafaf8', position: 'relative' }}>
            {/* Top strip matching ledger header height */}
            <div style={{ height: 46, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', padding: '0 28px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {mode === 'login' ? 'Collector access' : 'New collector'}
              </span>
            </div>

            <div style={{ padding: '32px 28px', flex: 1 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0B1120', lineHeight: 1.1, marginBottom: 6, letterSpacing: '-0.8px' }}>
                {mode === 'login' ? 'Access your
collection.' : 'Join the
exchange.'}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 28, lineHeight: 1.5 }}>
                {mode === 'login' ? 'Collectors exchange WC2026 stickers by post.' : 'List spares, add needs, get matched automatically.'}
              </div>

              <ErrorBanner message={error} onDismiss={() => setError(null)} />

              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {mode === 'signup' && (
                  <>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Your name</label>
                    <input type="text" placeholder="First name" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderTop: 'none', fontSize: 14, fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box', outline: 'none', background: 'white', borderRadius: '0 0 6px 6px' }} />
                    {inviteRequired && (
                      <>
                        <label style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Invite code</label>
                        <input type="text" placeholder="e.g. A3F9C2B1" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', fontSize: 14, fontFamily: 'monospace', marginBottom: 16, boxSizing: 'border-box', outline: 'none', background: 'white', borderRadius: 6, letterSpacing: '0.1em' }} />
                      </>
                    )}
                  </>
                )}

                <label style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Email</label>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: '6px 6px 0 0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'white' }} />

                <label style={{ fontSize: 10, fontWeight: 800, color: '#999', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '16px 0 4px' }}>Password</label>
                <input type="password" placeholder="8+ characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #e0e0e0', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', marginBottom: 20, boxSizing: 'border-box', outline: 'none', background: 'white' }} />

                <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px 0', background: '#0B1120', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 900, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.3px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading && <Loader2 className="animate-spin" size={14} />}
                  {mode === 'login' ? 'Enter collection →' : 'Create account →'}
                </button>
              </form>

              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setInviteRequired(false); }} style={{ fontSize: 12, fontWeight: 700, color: '#1AAB8A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}>
                  {mode === 'login' ? '+ New to Got One Spare? Sign up' : '← Already a collector? Log in'}
                </button>
                {mode === 'login' && (
                  <button onClick={() => setMode('forgot')} style={{ fontSize: 12, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, textAlign: 'left' }}>
                    Forgot access?
                  </button>
                )}
              </div>
            </div>

            {/* Bottom catalogue index strip */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#bbb', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Catalogue index</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[['980', 'stickers'], ['48', 'teams'], ['Free', 'to use']].map(([n, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#0B1120' }}>{n}</div>
                    <div style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
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

  const [activeTeam, setActiveTeam] = useState('All');
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
                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#1AAB8A' : '#0B1120', borderRadius: 2, transition: 'width 0.4s' }} />
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

      {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={() => {      {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={() => {
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
              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAgF0lEQVR42u17eXhV1dX+u/cZ7s29NzfzBCFhSAIEESGAIEqSVlvFoVpN6mxtLZ/az6rV2upXhbS11qFa6tCWOlunxFmwYNEYRWQKkEACGcicXEKGmzsP5+y9fn8kwYjUgPTrr8/zsZ7n/nHvOXefvd+z1rvWXmtt4ISckBNyQk7If6yw/4Vx6Ai/0/9FYPkJDTqycABy7HdbclaaRddU1bC4gT5wzgkAejVNpkScCtCHPpvNRDTKU0yTAynoS0EUgQBHu10iO8ARDivQNAkhhufkckWBQiCnW4FhMGgapfl8ai/nBNcEA6gWyMy0QAgGXR/+n9UqEQ7zDCGYy5UXHZ5eFQCY/w6A2KipONJzUpg0chiJPkZKrOB0AQgh4rQ20Nu5FwBPSUmxBpk+FdB7A05lCM3NAigYfl5+iKG+XowZkw1fcxDgH5lTtRjzQkbMtICPuUZAoTJ8fzWNMeWRsaoFUMgzM/droZBdHRhoCAIQ/1sAHbrPmTapBMQVEtIPzs4FYRDAJgLSOckaYjREUtEYRKxQ1EiQh5vQ2xsAwJCREQOXK3yYBh7Py6VjuJc5MzPjvUAIXV2hYzGXoxocADmTJ5VKwc4mST6oykEi6MTgAcO5jDEBAiOmnMI4y+ZcMYN9yXXo7Q0CUIfNZoIxZrzDx/+c5YnYyIcTkUpECmPAyPfDiZ8DUI40zmFASgCwhXn8sfAnO1rOcaZNfpikXEqg14ix7ZAyhTNeQky+IEltUSNmp4jBhECstSlxEJawYky1I9jc19cXRk6Ogubm6JHe+MiCxy6OGGPyqzSGiBhjjL5Ck75Ku1hCwlSn293iPxqTU8e5rgAQsWlTzicpbiTQBxzIAJceguKHpI8Y0R7NkP0eb5cHXnhgzdZMRaQyqeQLimsB+gjNzSYAvmLFCgLAV65ceQiAETAOW0yhunbtL6empyfOnpCeOttq1ecSZB5jltaNn265jzH2CRHxMf89HJDDwWNjv7uTeNhhzUjwu1wD45kpG1/D8jVHqu8HTPLo8IJksQTr5YyaCbyGkYwlsDRfnF7uHAzPkRbRIk1d1RWWlzU7t3p6fDw7/fTTjaeffiOmpqYqCCA69gFnn32TZcWKy7OcCc5ZdqtlgdPhmKNbtFkxVutkrtrG3CklwHnQPziwfcee2UuXLj1QUVHBS0oAxkrFP5s7UG8MO4Z8LcPtVl0uV2gEFHVEg742QAwAxSRNmqApmEWSTwKTiwGWAkYNkDjAGN4hxhZDws0Y7VMVri8784yOadOmRcrKyrQRu1dGPuHZC89Ou/2Wq9Nnz5qRmxQfNyfWbp9jseizbDbrJPCYsWAEQgFPb2Nzm3tXzR7fx5u26G3tXcpTj98fP3nq9OnNjY3X5E6f/vzo3StWrOArV85ijJXKIwSqY7mKj3H5DDk5OpqbI8ejQTwpabo9woNzOHAnEdsNYn1SFetBxFWmeoUQWaQY+wJWqxftbhvg9QGIueiK5fYl82efvHjhvOz0tJSTHA7bKbF2W26Mw54O6GMeIQIBv6e3taVjcMuOmvCWbTuodk+9raOzx+n1+eKlFM4Yq9Xi9nhw+09u2PbAb389v6+36/HU9Ek3dXRsyknQJ2THpk/+YJibVnBgJf4Jh31JEhKmxrndLb6v8qrjcRCF1dACFbxFCPk7xugqxmBhpOQySZMEIxdjcGiwDzrCAaQW5Ke99coLl8fHO4ssVjXP7ohPPMxheH3e/tbWtq7+rdW7Qpu37qTddfXOzm5XrNfny5bCdKqqarFaLNA0DYkJcSNEDsk4Yztq9uiAQTE26+kA0ButyzNTO9cOerdUKp74hxib/h5QBiLiY/jtnxOw6hNAvgrUR782SWuCDEmUzBRugqiJiA0wbvZIcI2DdStQA6rGJvZ2Dfn37V1zV3xC0qUjZjLkHuxva2nt6K/eVRvZsm2XrK2ri+ns7EnwBfyTSQinqmkWi65D13Ukxo+CIUlKSUQEwzAZGBgDmKpqbO++Jrs0wgf6+vrzCgsLkxfc+aP1v7/7G43Ts6cXT4k9rdgb2PG+HLI+xBj7x/BY5QpQR4yVySMDpErkA6j/ml4sJydHGfCGhxh4gEyWwlV6XahRrzR1NdjfvmXU/st+82Da8ht/PM1ht1wCIPT8317a/NsHVzk8Pl+K1+ubQkSxmqbqFosOTdOQlBA/QruSpCQCiAkp2AhbMACMQCA6RCeSM059AwPOvY37A+/+fYO+ffumdATQH7pFebyhr+Hh6qFakZM6+1snOZZ8a8i7dY0eSriPsdxNo0AdichdABAI8OPhIDU+dWK+EFpEqkJViYVIl0Peri73KAESrWCMlTmfefHF9EsvXLbbanOE8ued4eruceU57HZwzsE5gxCSAKKRABAEMBDAOEMoFIYQwqMoihqNRk3DMHmM1WKLiYkhAJwrCmeMwe/3yZTUlDe9QWNz3/7ah1ord8ZviX+qqEtpfS0UiXJf1C9NIj47cy47xbYY02x5r5huui9x0uLa4UDzsNVlZNig6xLt7eGvCVCBZkvpTwIRU4kmEpMeX3xMB5rjJFBtjAZtnDHKys62bt/2WUNySkbWlT9YXvfu2vfzHbF2kkJyKQmKwoYnOMavcM4RCAZpyeJTOx+8dwWLhAN2W0xMUFEU/1tr1sf+9dkX090ej+L1enZG3J63Z85euPWFxx6UJy+IW+iJdn3TTd0zu6JNqXsH9lKv38MCURNRKeE3fIIxzudPWsAWJywykijlgace27py5UrIL5jbUQCkjhtGC0r0D3bsjYvLDoGIjwGHjRAhqYqC9vb2sJRUCyBr/tw5kYo33pWOWLuiqhAOhx4eHIzYOR8BacybDIUjwXt+cQvlz5yZBUC2t++Pf/K5l3nFm+/6G5saX4yLTXuzprI2PH1OclEYtQ90h+pP2ixbsM/TiJaBHgx4/ZDEGWh42GHdjFGEJHzQtNHY5qzRrpj0nZ+uLLrxd4yl+Q+LwnGckXQ1SZ5tSUpKcgBWMTDQ4AW6aBgXkJQ3Olbdu+esOx/2bNVCNdBUy2cAzltYcIrCObz+gJEwM8du/PCSDHnD3XuRmmyBEIdeIBkRk6UkJ3lOXTjP2t3dEf7dw49Z//ZSRf/QgbZnCgrOfY+CW6YAnlt6olsKt4Z2YGvPNjQc6CJPOCrAFKYwjTOmMEaAlBJi2HQPeW2F29ikxCQcDNT/mhWn+cupRGGMfc5FikLHCVAB05S+ITPsUKzWIWPk3dPIW+Arf7blxu+dO+XqPz+1275vEBcnJCVtBoDcadlxMTH2SMSAuKZkuvn9Eqv16dc6g3saw1arBZzksP6FwhE6aeZ08egTTybe//ATvHt/3R9LSpa/Ul7+l4VR9Py1E6/n7Or7ANs7asnlDwpD6FzhGtcVTSUCJAhCEqQc5hdJAI2YsCApHE6rmmbad102cO2DDTSFl+IwbyYEGw+k8TRIIpzt9njaPR7P8MspKYFSUVGKJYsm3rFwcfFvZy6eissv2md8XJt6YE9Tk2d6dgYlJiYmLJw3pfm/L1Wc5y1z2ky/h1c+nc3vfKTX98xbgzEKg06SpNViURr3t036yY9vXmt1pPyOiKaaGHyuG6/nbna9jequRjEYAiOpcQaHqnIJQRKmJIyEzBIEEpIIYExKcAIxBkYmZ5hgiZVOM2Y5Ky42y8tLFJQee5plnG1/4ZhNXoG2YgV4eTmkv6tlzp9/ddJ/LbsgW0CYkZ/dPF+94tuOx1578aeugN/vUjSrM9aZbr3h57XW116pjfLokPn9n++P/G3NoJOBdCGkZFxRhBBDB1rrryIyfhfy9dzbjw3Pvd93R+6TO39v/qOhiQaCugLonBjBIAFDShjDYZIpJQgq54pdU/Q4i6rEqAo4Z0IyhExTpCU7lJgwe+iqec9te69xlaW0tOLLmqIoBE07Hg2qkjZbRtTjAQeqzbIykMtVoK1eXb0jLQFv/uHullsuvbTAvPvuT+jdj41nG9qqgzcsNxoAPqFgzuzgay+t5Y+W+/06J3r1vWBKXIICIhlVuBJwuwf+vmjO/Ps2HWgtGTLrX9hvvIxP2z42mwdMJSwUlTECkYApGYQkksOKoigxKld0hUcDJswwdYsw7ZIkq42QWQOV/4xb+SIrU1RbQNkb659yD0BYlndzZMTyvrjrP34OArlcrsiYvQpbvbraAFBU+v1fhDsPVslPN9RZOvx5ZsoMR1tD27sIG+YuAMULFszjzAJPU1s47s4noiG7Ay0g+amiqInunv2PENEAgGd68fb8j13PyJ2ufvSHoA6HiRKmAIQgkiQFqUxV7ZoqgwJmEDvNAN41w+z98D6qfefnG32jk73g9VPnc6e6II5psAr+g5uXPWo89OijP42z2wd+9IP/2g0YO74QaGgaIS5OHg9AGM4DVwugRGHsNeGIS7v68UcffOyqK6+MbatfI96q+FO9aUn2NW7/bBGA2kAgtBMA8nNzYzWrtSHgN9/pG5SDTofaNHHqxOrdGzeqFKFzvJH291rpaf2z9o1mfb+pBqIEhQGCRoEhwTSuqlZVjfjkYHSIXjPD7Pny72z89IhkUFmoRntDO5OSbQq1mQ/89rx1m6+64aZ7vrF0Sdnck0+G1+MbuO3W28/k3NwlJQ0XHpqb5XjpjnEAKuEpKXWWvj4YROWSMaac/53zfnLVlVfGQkQ8r/69qfnhZ1pipGxeaNHUgwBW9/T07MvLnYy4eMeEGdPznq3dWvVHReGBSy69Tlu9erUhQnQvdNdd9e5VqOqoFvvdpBrSAANDdNgbCaYwRbdraiQguw03PUFuevaVyz/pOZTeqCxU6/tSCeudcZz0+cFIKOPd4mefu/C5b9aEmo03puek3F1w5jmzp2Zl/dJuUQwgQiXfPTfpN/evWuQ+0LKrsLCQV1VVSRQUAA4HUFX19TWIc5VGNnYEgGdPyiQAsq29dWjlvQ9lpaYkpQCAYZrTAfD29vZ9wcCcg864hNSHH7h7+5lFVQHT/EBlrFgE3PS837rpqt0Dr5iVbfuVpqGowtmwezZNKRlnzBqnK1G/7A8N0sPB5sjqt27aNgAAJVSioAKoKK0Q+KgIFWVl4tr/vv3Hdkfsr6KRMEquWt5Ycc3qzwBcDADX3PjTJ884da4WjRoCUuFNzS1R39DBvZwxVFWlDmtNf7+CUOh4TKyCemNzTPQCL7/8slJaWmrs3F33WjDgmT8xMzN9/tw54YamZrJaLYwBU/JOXph93XXXtV504YF9YGpKfs60HKIVHzBWTL7BaHkofv3FH3T+wdjWFdR6fGFoigJDSJCEqdtVVUqGaAB/Cg/o91aUftg9ajpVRVWiglUcCvBmzZpFADB5YuoeZ1y8YRqGaJL012WlV98YEoGBBFvyL4pOm7/QabcIRVE4uAXbdtS2mmH/VlVRIEXFMCjRKD9ONw+keHQNAEpLS8E5w7q3K/6+bftOl6Y79AvOPUsGQyFwzgTjXBMkZwNAMBCqHdY6ZRFjZTLkFc+HE/5x8fttvzc2tYU0lzcClSmIGlJKgtTjNNU02E4KoOiFb3x8Y0Xph92FlYUqCKyquMoE+yJPpKSkMKJKNStr4t7cKZnanJPyrGcWL5p1asEpVSfn5tecufTUK3MnZ0ghhRIfF0emEWC7d9e/DSD00ssvK4d45yjc/HgA8ZASHc2FSiEkA1C7dv0HWwGwi87/tiU+Lt4wDBMAQzQcKQAAfzDQCBKssX3vI8FBc0U49sPL17etMja1R7S+QAicMxiGEFxTuKprPOpl9/e/6Vj8wrKNVf8MGMYYKisrVcYYiouLTcaKzWuvuGLfQH/vHZ4h9yqdy3WL583sv+Lic5RF82eBMYKqqiIxMZ67XAcGPtm8/c8MQGld3TH1CYzHQTJeDfv9Iy6/tLRUASBff+Pdt2+47qrv5OTm62ecttC9dv2GpDinE4ZhzAWAwcGBlt31O6+fPbFwkpGweeW6zlXGpraQNhiKQFUURA1hag5VFSbriXrY8ooLP1kLACXlJUpFcYV5hNIQZ4zJ4uJiEwB6e3tPSU1NnQcgBUAAQA2AtdXVnw3s29c0efLkST+Ki3OeLSXBEuOQkYjrHx2Nta1EpDLGzC9sNQyDHZeb7+pyHrL9iooKObIPe77nQN95U6bmXVT63fPw1pp1phBCNwxjVuE111iXLClc213rnRFN3lXzietR8WnrkNofjIIzhqgpTD3eopp++Um0U171xnWfthdWFqpVxVWiorTiS0mtkpJbYxhjuOmmm+SvfrXyalVVfySEmbJ23fro7rq9uYZhmnGxdpqcPSm8cP785oKCxRu3bt165+ZtO/9auOTUxwEtvbvnwN8BsI8++uiYy7fjApSZ6VW6usBHN6orV65UAJjvvLdhzakL5n33W988w56dlRk90HtQUziPd+3Z4yAi2efd8eaeyAt6VXOHOBAQTAHIIJLWOF01fPSk9E64/o3rKoSWkVFQVYyaI8UjJbfeGlPxyCOh1tbGRWlpGU9YLZa5jGvo6GzdXHL19fEKAyMpNDAGzphwOp3pd9xyfe5Vl5VsOyk/99Z3NlQtdtgcfzOM0EYAVFRUdMy1+fFEsaVkpyMzM2YMX3EiYpo97aTamuouIpJ3/vKeVm5PobTs3A0A0Nm9/fe7zfvpZ5sWGZesXUQlaxfKi99baF5WdTpd8s5pK0bG0dNyZj101gUlW8dUVw8l8c5bvtwGgA/2HbggHPaFpYiQEQlEiAQZ0ZD7smuWP7Wo6OyPc2Yv3Jw0MaclLmNKVIlNq123fv2acMhrej2D1N7S9BQAlYi0w57xecIsO9t6PBrEGFckutrHFvslANUI9O5xe4N/BvDr6394RfAPTzx50O/3PE1E0/d6n7v13T3rRZubKSAiyZnUbZoSdYubX7/wsz8Sgc06ZdEpyy44/7Y5J+WtZ4zRCM9gTDol0ty8b7Et1v46CaFIbkRVXdcMwwj29vZvfenZvywFhG5Go709B/saX3n1rQ+XLJqfuGTJaReJqE96gv7IkNf3g+7OtiHG2G1EpHyd7o5xTTApaXrsl3mhRAHAvlt69dKBflckGvGZt9/1i/8BgJaBNZUv91xD33tvvnnxmlPlxWtPNb5XeTpdsuaM/wKAFc9cYwWAR5548oL6xgbR2Fj/KgBUVlaqAJCSn+/IyMhI3lNZ6fB6+tukGSSiMBERCTNKra2t74dDoX46JObwNSMY7urq3C3MIAV9fYJkkA70tHW37G9o3b+/8bwR5JVj1aDx3LwYGEgPjblXBaCMkDXeKH9+z45du+s13aEsWXCau61t3WkHLXVFG/buFRFTUcBIqHZdjfbTz14775O/FGwv0Iomf98EgKWnnuycmZvLOWQEACsqKpLIyLApYVrqcrmsM5Ys+OmQx2uVkuoBS3MkEt7e0dnxblJiwmyLVU8SwpTCCFM07JOhwKAAI0s4HDb9/kBAVVUW9AdkcnLiBIAG7TH68u3bt2tfpxVwPIAIqDI/b7krHDUxAsAZY4PBQGiVe7AXb7xSvWHQ2n7vx12fUa+PwECm4tDV0IC4782STx8iAqueX20UFRUBAGJj7UlEDFLSEAB8+9vfjo8jbZnfPeQhoh6v13vzSxXvNJx5wRVb5iwq7szImWPe9/s/9cY6HUnRsJekGeJSRhkD44wxzgGKidEzjKjp0axOJoSQDIysVoszEAzFpacnFDLGZHl5+edapOvyeANFBhSqI4CYI2DRaNWSiNDY2FhZV7//3vtWFSR1yuaizfs7iREjxaGpkUH58jsXb7prxukL8uYtOTMDAKqrq4eJUrJ4xgBV1QYAOPc0dS9x2Ow1frdrN2CcceDgQOLjq5/vr96x89quzo5ilWPRPz78KF8KY6+qWyGEKUlKEBFIEoFxFu+0R9es++Atr2egMzY+STWGY5xJkXC0SVP0ohF6YMcSBx1FI1GV/OfaBdx+u7/zjDOW/LIj2nDjzsFG+MMwdLuiRofELr1F/hBpaalzZy5cd9ZZSxcBgNPp5MP4sjgAqNvbEAdoP40YkaJwNHoDAD8gT9u7r6mhs7mxS9fVAAADgOxxuXI+/Wy7i3Mr42x47qYppKIqHFwb+O3Dqyuv+/HteXNOO/v599ZtqDAEogcODg55/b4WKYypY5zM53KcGkRfVdgnAmOsTJJ7Z3yjv3nZno4DpOuqakbhlx52WcVtm0Pfv+Sy+y+7+MIpFy87Kw8Ay83NBQDy+bwTAGBD5cZvQo25lEgWc8bnApB+jzcXjD6M0cWDRLhXEGmmaQqLxZJ6z28eCg65+5o9vkAoGAqRpmtct9pCTz/30qsPrXpidmys3dfW3vDoueec8+gdd91ztdWi74yNdVxvmNI24ik/7xf6F2gQG0POX4ojKlDOAWCDq2JJS6Q30Rs0TYtNU8wQbl5z7Wf7QGDfPfdb/sLF82RWZtp8AGSxWCIAVJvdpgOApmv1ikXLlBJzfT7fhwAQDgft6anJdaFQyHXTdVc+LkxRzbmieYeG2s49+5sDobA5ODAU3NHeM7CxsbVr81PPvfT0T+64e5pFU/fLqPEbFgz0Kgr/5E+PPfaWqiqzQ6GwU0hTqaioYMdK1Pwo75FHaghPQR0DgM7IwdO7Ax7SbaoW8Zj/WFvy2dOrGldZwEAnz5ix1elM4EQ4OTUrd2pcelYJFNv9AwODUwGg29WrikCoJSE+vvr8886OAuBCsgPTpkwu2NHYmFhWVuY9be6Mbw10tf7s7jtve/P2W24qzUiPX5g7OWPJtKz0JbNm5Oa73d70qGewJjU19VZPf0ftPfes4EJIvmfPnoRQOJLk8QX8mqb5SktLxZgex3+VF4Mcm5Mee/GJinoCgDZf30xvJMpgsIiM0M0AmNVrlQBgCF4XDfuQlBifNilz4v/4fcHfKjbH5bGxsboQEXnXbT9e0ty41de4szLjJzf+6HdpaVOT01KSP4ixO65NtqrbhwYGSt9//313YKi/csVdt/0gFBh0eoY8IhAMkBQGQIbzexcumysJVS1127tWrFiBK664QqusrOQWizInYgirzxcIClN0D8/6I+VYtOhou1xHwfrCwBV1w6WUroAniXQOEcZT7122ZW8JlfDlBctNANi5s2m/z+d36zEOxymzZ2UYppgGkEokfYpi4SfNPiVjWu6sxaolJtEZa28rPOecTKi2z/oOHox4vb4sa4z6aldHe8Wgd2C1wikuEg4LzpiC4a4Y7nF7ZEpq0uRNn3wUkVKirKzMzMvLixQXF5v+YPDyjm6X1CwWny8c3TI86yIa09U3rjap4wKYk6MON4H/cxkIBZlpchkcpAdBYPkrK4iVsdEtg+fggc56QFtSMO/k2KeffTHoiItLvGr5LU1PPf77DyPRqGXzlm3eDR99mlTf0LSpo6F2R/mzj8PV3bZ+yBc6b29Do0xNSb7Y7fbVJ8Q5IImYNAyAMTDGIKUUcTa7FhdnLdmyZUvdhAkTUnVdmeBy9Uypb2g7PxSJtGfNyHEbYWPDl7zYyImA48oHjbTvHrmsWFTIq8qqZDAs+xASW6tuqG4rSSpRysoOpS0UAKbXH9ybkoYlc2fPtILxsC0mxr6/tX3xgtPOCsCISsDggMWMSUjwPvLEk9ObWxt8iclxZb397gvaOw8KTdcJQLDL1efOzsxICIVCEoyBCDLWYdf2NTQN+Xzh3GmTJzZ6/QGHYXAWMSV6+wcqs7MmJnFFfXfu3LlDw/3W7Jj2Y0dR9vlCS+0XiDq1bzj5bUbZy5wjHgR2cOXBL6mtz+fbBUiaNTMvwWqLqevt6ZljdTgC03JzPXNm53uXnr4wuHjhPG3alKz07bUNtV0u136LJWF2Q0P9A3aH4466fS3m5EkT8tub2is7ug8WZqQlO2w2K2wxVr6rfr8/GAx9kjc1q+hAf39sf79b+gIh5guEgikJCW0piQnB3TU1fxnTNowvmNjo2ZCvu5sf4SlxJC82muCq/P628sIVhSoYqGo42h5NsBEADAz4a81ogGm6NnXXpnWe6h01DSfPnpWQlzPFoVljsgDdPjp83tQQGve3Tzz7ou99d8aMWT+v/PjjWapuOXfH7n01D616/NUEp3NTfv7M3JTkpEkJiQlKVubEgwVzZn6jvnG/w+cPkJCMB0PBIU3V6jIyM/LNSOTKa6+9NtzW1saPSM7jVFfH7XLNzMy0dA2fbRirQUcVT4y61AsuuCz1z0/ct21C5uRMwGCANhrrY2iwD6ZpNkYikRpD0Gav17vd6w3uNk3T99FHH8mVK1fyyo83vtDR1T1jV82OK//wwAN1ACwAMgEYL77yyswYR9w6t3sIhikCDNSREO/0JybEe3XObly6dGnjEbXncwWhr0qDjB8TZGdbRzqw+BE82bhAlZeXK6WlpeLqH15/3aWlF/11alaG2dnlMptb2nqcTsdf/V5/5erVq3dUVw93rB0O8GiOaGt19fKoIa6QUu6MjbW8fcpJp+zQdd1jGAb+8vTz98XYbOfbYiz++IT4iMr5p0P9ffddeOGFvtHnH3lp2db29vboV+0W2FG6eToCBx1ufuONYQWUb0+aNsPZuX9fByBaAbSPAUMBwCoqKqikpESOdoEN9zISY4zJF154wZk5Zcr3hKBizijZMAxwxqBqWlBRFLeqaDtENLz2jDPOaDnUYFpW9hWFwXz9q1qAj+Uwy2iHOvsq0v7qCi0b3nmPtFhwRYFpmiNxGCPGxtFEIqV0jAeqrKxUo9FoorRaFauUvuLiYv9hYMuvbrUrVJHTrYzXaX+UkmPB8Z9vZUCJMpyNLFHwNY50jnTIKuWHZwZHSkOVlZXqMWwlOP51Z3ZxeFKdAQUa/j/L6Lmyr7FQ9ShDnP+T8h95IJn9Z4xVqP47wGH4/IgT/zeBy44DmJG0cb7+dczq6yxwNLCi4ZMyw5WOIxUd/0WaQ2M+/BjmP+J9C0ZAqY/iOI6H/yeZ0Ak5ISfkhJyQE3JCTsgJ+Q+Q/weBRsjtHuw7PQAAAABJRU5ErkJggg==" alt="Got One Spare?" style={{ width: 28, height: 28, objectFit: 'contain' }} />
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

        {/* Status line — one line, not a dashboard header */}
        {tab === 'dashboard' && (
          <div style={{ background: '#0B1120', padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{user.name?.split(' ')[0]}</span>
              <span style={{ fontSize: 11, color: '#1AAB8A', fontWeight: 700 }}>WC2026</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.02em' }}>
              Collector archive — {new Date().toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
            </div>
          </div>
        )}

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
                  <i className={`ti ${t.icon}`} style={{ fontSize: 18, color: active ? '#1AAB8A' : 'rgba(255,255,255,0.35)' }} aria-hidden="true" />
                  <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#1AAB8A' : 'rgba(255,255,255,0.35)', letterSpacing: '0.03em' }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <FeedbackWidget />

        <div style={{ textAlign: 'center', padding: '4px 16px 4px', marginBottom: 4 }}>
          <DonateButton location="footer" variant="link" />
        </div>
      </div>
    </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
