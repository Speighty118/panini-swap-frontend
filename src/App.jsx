import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { Search, Plus, X, Star, ArrowRightLeft, Package, CheckCircle2, Clock, MapPin, LogOut, Loader2, Bell, MessageCircle, Send } from 'lucide-react';

// =================================================================
// API CLIENT
// Point API_BASE at your deployed backend. Every call goes through
// `request()`, which attaches the auth token and normalizes errors.
// =================================================================
const API_BASE = 'https://panini-swap-production-69ef.up.railway.app/api';

const AuthContext = createContext(null);

function useAuth() {
  return useContext(AuthContext);
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
    throw new Error(data?.error || `Request failed (${res.status})`);
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
  createSwap: (token, matchId) => request('/swaps', { method: 'POST', body: { matchId }, token }),
  getSwap: (token, swapId) => request(`/swaps/${swapId}`, { token }),
  acceptSwap: (token, swapId) => request(`/swaps/${swapId}/accept`, { method: 'POST', token }),
  declineSwap: (token, swapId) => request(`/swaps/${swapId}/decline`, { method: 'POST', token }),
  markPosted: (token, swapId) => request(`/swaps/${swapId}/posted`, { method: 'POST', token }),
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
};

// =================================================================
// DESIGN TOKENS
// New palette matching the modern teal/blue/white reference design.
// Injected as CSS custom properties so every component can use them
// without prop-drilling colors through every element.
// =================================================================
const DESIGN_TOKENS = `
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
  body { background: var(--bg); color: var(--text-primary); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  * { box-sizing: border-box; }
  button { cursor: pointer; border: none; background: none; padding: 0; font: inherit; }
  input, textarea, select { font: inherit; }
`;

// =================================================================
// LOGO — square rounded mark with two overlapping stickers
// =================================================================
function Logo({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: 'var(--navy)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 72 72">
        <rect x="14" y="12" width="30" height="38" rx="4" fill="rgba(255,255,255,0.2)" transform="rotate(-10 29 31)" />
        <rect x="28" y="22" width="30" height="38" rx="4" fill="var(--primary)" transform="rotate(8 43 41)" />
        <path d="M38 30 L38 36 M35 33 L41 33" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// =================================================================
// Shared UI pieces
// =================================================================
function StickerCard({ sticker, onAdd, onRemove, qtyOverride, mode = 'duplicate' }) {
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

        {/* Top-right: quantity badge (when >1) and/or remove button */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {qty > 1 && (
            <div style={{
              background: 'var(--navy)', color: 'white',
              fontSize: 11, fontWeight: 700, padding: '2px 7px',
              borderRadius: 'var(--radius-full)',
            }}>
              ×{qty}
            </div>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              style={{
                background: 'var(--danger)', color: 'white',
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <X size={11} />
            </button>
          )}
        </div>
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
  const [mode, setMode] = useState('login');
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
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '14px 16px', border: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{step.emoji}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 2 }}>Step {step.step}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{step.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth form */}
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 28, border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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
        </div>
      </div>
    </div>
  );
}

// =================================================================
// STICKER SEARCH PICKER (modal) — used for adding to duplicates/needs
// =================================================================
function StickerPickerModal({ mode, onClose, onPicked }) {
  const { token } = useAuth();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [teamStickers, setTeamStickers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Basket persists across team changes — maps sticker id → { sticker object, quantity }
  const [basket, setBasket] = useState({});

  useEffect(() => {
    api.getTeams(token).then(setTeams).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!selectedTeam) { setTeamStickers([]); return; }
    setTeamLoading(true);
    api.searchStickers(token, { team: selectedTeam })
      .then(setTeamStickers)
      .catch(() => {})
      .finally(() => setTeamLoading(false));
  }, [selectedTeam, token]);

  const toggleSticker = (sticker) => {
    setBasket((prev) => {
      const next = { ...prev };
      if (next[sticker.id]) {
        delete next[sticker.id];
      } else {
        next[sticker.id] = { sticker, quantity: 1 };
      }
      return next;
    });
  };

  const setQty = (id, val) => {
    const n = Math.max(1, Math.min(99, parseInt(val) || 1));
    setBasket((prev) => ({
      ...prev,
      [id]: { ...prev[id], quantity: n },
    }));
  };

  const basketItems = Object.values(basket);
  const totalCount = basketItems.reduce((sum, item) => sum + item.quantity, 0);

  const confirmAll = async () => {
    if (basketItems.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === 'duplicate') {
        const singleQty = basketItems.filter((item) => item.quantity === 1).map((item) => item.sticker.id);
        const multiQty = basketItems.filter((item) => item.quantity > 1);
        if (singleQty.length > 0) await api.addDuplicatesBulk(token, singleQty);
        for (const item of multiQty) {
          await api.addDuplicate(token, item.sticker.id, item.quantity);
        }
      } else {
        await api.addNeedsBulk(token, basketItems.map((item) => item.sticker.id));
      }
      onPicked();
      setBasket({});
      setSelectedTeam('');
      setTeamStickers([]);
      setSuccess(`✓ Added ${totalCount} sticker${totalCount > 1 ? 's' : ''}!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[90vh] flex flex-col" style={{ background: 'var(--surface)' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', margin: 0 }}>
              {mode === 'duplicate' ? 'Add duplicates' : 'Add needs'}
            </h3>
            {basketItems.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2 }}>
                {basketItems.length} sticker{basketItems.length > 1 ? 's' : ''} selected across {new Set(basketItems.map(i => i.sticker.team_name)).size} team{new Set(basketItems.map(i => i.sticker.team_name)).size > 1 ? 's' : ''}
              </div>
            )}
          </div>
          <button onClick={onClose}><X size={18} color="var(--text-secondary)" /></button>
        </div>

        {/* Success / error */}
        {success && (
          <div style={{ background: 'var(--success-light)', color: '#065F46', fontSize: 13, fontWeight: 500, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            {success}
          </div>
        )}
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        {/* Team selector */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 14, color: selectedTeam ? 'var(--text-primary)' : 'var(--text-muted)' }}
          >
            <option value="">Select a team…</option>
            {teams.map((t) => {
              const teamSelectedCount = basketItems.filter(i => i.sticker.team_name === t.team_name).length;
              const codeRange = t.first_number === t.last_number
                ? t.first_number
                : `${t.first_number}–${t.last_number}`;
              return (
                <option key={t.team_name} value={t.team_name}>
                  {t.team_name} ({codeRange}){teamSelectedCount > 0 ? ` · ${teamSelectedCount} selected` : ''}
                </option>
              );
            })}
          </select>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
            Tick stickers from as many teams as you like — they'll all be added together at the end.
          </p>
        </div>

        {/* Sticker list for selected team */}
        {selectedTeam && (
          <>
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {teamStickers.filter(s => basket[s.id]).length} of {teamStickers.length} selected from this team
              </span>
              <button
                onClick={() => {
                  const allSelected = teamStickers.every(s => basket[s.id]);
                  setBasket((prev) => {
                    const next = { ...prev };
                    if (allSelected) {
                      teamStickers.forEach(s => delete next[s.id]);
                    } else {
                      teamStickers.forEach(s => { if (!next[s.id]) next[s.id] = { sticker: s, quantity: 1 }; });
                    }
                    return next;
                  });
                }}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {teamStickers.every(s => basket[s.id]) ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {teamLoading ? <Spinner /> : teamStickers.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', background: basket[s.id] ? 'var(--primary-light)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={() => toggleSticker(s)}
                    style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: basket[s.id] ? 'var(--primary)' : 'transparent', border: `2px solid ${basket[s.id] ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {basket[s.id] && <span style={{ color: 'white', fontSize: 13, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace', marginRight: 8 }}>{s.sticker_number}</span>
                      <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{s.description}</span>
                    </div>
                  </button>
                  {mode === 'duplicate' && basket[s.id] && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingRight: 12, flexShrink: 0 }}>
                      <button onClick={() => setQty(s.id, (basket[s.id]?.quantity || 1) - 1)} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: 13, fontWeight: 600, width: 20, textAlign: 'center', color: 'var(--text-primary)' }}>{basket[s.id]?.quantity || 1}</span>
                      <button onClick={() => setQty(s.id, (basket[s.id]?.quantity || 1) + 1)} style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Basket summary + add button */}
        {basketItems.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Ready to add: {basketItems.map(i => `${i.sticker.sticker_number}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).slice(0, 6).join(', ')}{basketItems.length > 6 ? ` + ${basketItems.length - 6} more` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="outline" size="sm" onClick={() => setBasket({})} style={{ flexShrink: 0 }}>Clear all</Btn>
              <Btn variant="primary" onClick={confirmAll} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : `Add ${totalCount} sticker${totalCount > 1 ? 's' : ''}`
                }
              </Btn>
            </div>
          </div>
        )}
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
      setDuplicates(dups);
      setNeeds(needsList);
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
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: duplicatesOpen ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setDuplicatesOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>
              {duplicatesOpen ? '▾' : '▸'}
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'inline' }}>
              Your duplicates
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Spares · {duplicates.length}</span>
          </div>
          <Btn variant="navy" size="sm" onClick={() => setPicker('duplicate')}>
            <Plus size={14} /> Add
          </Btn>
        </div>
        {duplicatesOpen && (
          duplicates.length === 0 ? (
            <EmptyState text="No duplicates listed yet. Add the stickers you've got spare so others can find them." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {duplicates.map((s) => (
                <StickerCard key={s.sticker_id} sticker={s} mode="duplicate" onRemove={() => removeDuplicate(s.sticker_id)} />
              ))}
            </div>
          )
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: needsOpen ? 12 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setNeedsOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>
              {needsOpen ? '▾' : '▸'}
            </button>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'inline' }}>
              Your needs
            </h2>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Wanted · {needs.length}</span>
          </div>
          <Btn variant="outline" size="sm" onClick={() => setPicker('need')}>
            <Plus size={14} /> Add
          </Btn>
        </div>
        {needsOpen && (
          needs.length === 0 ? (
            <EmptyState text="No needs listed yet. Add what you're missing so we can match you up." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {needs.map((s) => (
                <StickerCard key={s.sticker_id} sticker={s} mode="need" onRemove={() => removeNeed(s.sticker_id)} />
              ))}
            </div>
          )
        )}
      </div>

      {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={load} />}
    </div>
  );
}

// =================================================================
// MATCHES SCREEN
// =================================================================
function MatchesScreen({ onOpenSwap }) {
  const { token } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creatingId, setCreatingId] = useState(null);
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

  const proposeSwap = async (matchId) => {
    setCreatingId(matchId);
    setError(null);
    try {
      const { swap } = await api.createSwap(token, matchId);
      onOpenSwap(swap.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingId(null);
    }
  };

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
                  <span>{m.a_gives_b_count} ↔ {m.b_gives_a_count}</span>
                </div>
                <Btn variant="primary" size="sm" onClick={() => proposeSwap(m.id)} disabled={creatingId === m.id}>
                  {creatingId === m.id && <Loader2 className="animate-spin" size={12} />}
                  View swap
                </Btn>
              </div>
            </div>
          ))}
        </div>
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

const SWAP_STATUS_COLORS = {
  proposed: { bg: 'var(--warning-light)', text: '#92400E' },
  accepted: { bg: 'var(--success-light)', text: '#065F46' },
  posted: { bg: 'var(--success-light)', text: '#065F46' },
  completed: { bg: 'var(--primary)', text: 'white' },
  declined: { bg: 'var(--bg)', text: 'var(--text-muted)' },
  disputed: { bg: 'var(--danger-light)', text: '#991B1B' },
};

function MySwapsScreen({ onOpenSwap }) {
  const { token } = useAuth();
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
            const colors = SWAP_STATUS_COLORS[s.status] || SWAP_STATUS_COLORS.proposed;
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
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Swap #{s.id}</div>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)', background: colors.bg, color: colors.text, flexShrink: 0 }}>
                  {SWAP_STATUS_LABELS[s.status] || s.status}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeFiled, setDisputeFiled] = useState(false);
  const [showOtherRatings, setShowOtherRatings] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const messagesEndRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.getSwap(token, swapId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, swapId]);

  useEffect(() => { load(); }, [load]);

  // Light polling while waiting on the other party. Importantly we do NOT
  // call setLoading(true) here — that would cause the whole screen to
  // re-render as a spinner and reset the page scroll position every 5
  // seconds, which is the "jumping to the bottom" issue users reported.
  // Background polls silently update data without any visual disruption.
  useEffect(() => {
    if (!data || ['completed', 'declined', 'disputed'].includes(data.swap.status)) {
      return;
    }
    const interval = setInterval(() => {
      api.getSwap(token, swapId).then(setData).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [data?.swap?.status, token, swapId]);

  // Load and poll messages every 10 seconds
  useEffect(() => {
    const loadMessages = () =>
      api.getMessages(token, swapId).then(setMessages).catch(() => {});
    loadMessages();
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [token, swapId]);

  // Scroll to bottom when new messages arrive — but only if the
  // user is already near the bottom, so we don't hijack their scroll
  // position while they're reading older messages or doing other things.
  useEffect(() => {
    const el = messagesEndRef.current?.parentElement;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const body = messageInput.trim();
    if (!body) return;
    setSendingMessage(true);
    setMessageInput('');
    try {
      const msg = await api.sendMessage(token, swapId, body);
      setMessages((m) => [...m, msg]);
    } catch (err) {
      setMessageInput(body); // restore on failure
      setError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <ErrorBanner message={error || 'Swap not found'} onDismiss={() => {}} />;

  const { swap, items, otherUserAddress } = data;
  const isUserA = swap.user_a_id === user.id;
  const youGive = items.filter((i) => i.from_user_id === user.id);
  const youReceive = items.filter((i) => i.to_user_id === user.id);
  const otherName = otherUserAddress?.name || (isUserA ? `User #${swap.user_b_id}` : `User #${swap.user_a_id}`);
  const otherUserId = isUserA ? swap.user_b_id : swap.user_a_id;

  const steps = ['proposed', 'accepted', 'posted', 'completed'];
  const currentStep = steps.indexOf(swap.status === 'declined' ? 'proposed' : swap.status);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

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
              {isUserA
                ? `${otherName} declined this swap. You can propose a new one if you're still matched, or look for other swap partners.`
                : `You declined this swap. If you change your mind, you can propose a new swap from the Matches tab.`
              }
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
          {['Proposed', 'Accepted', 'Posted', 'Done'].map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: i <= currentStep ? 'var(--primary-dark)' : 'var(--bg)', color: i <= currentStep ? 'var(--surface)' : 'var(--text-muted)' }}>
                  {i < currentStep ? <CheckCircle2 size={15} /> : i === currentStep ? <Clock size={14} /> : i + 1}
                </div>
                <span className="text-[10px] font-medium" style={{ color: i <= currentStep ? 'var(--primary-dark)' : 'var(--text-muted)' }}>{label}</span>
              </div>
              {i < 3 && <div className="flex-1 h-0.5 mb-4" style={{ background: i < currentStep ? 'var(--primary-dark)' : 'var(--border)' }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
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
      </div>

      {swap.status === 'proposed' && (() => {
        const myAccepted = isUserA ? swap.user_a_accepted : swap.user_b_accepted;
        const theirAccepted = isUserA ? swap.user_b_accepted : swap.user_a_accepted;

        if (myAccepted) {
          return (
            <div className="rounded-lg p-4 text-sm flex items-center gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <Clock size={16} color="var(--primary-dark)" />
              {theirAccepted
                ? "You've both accepted — loading next steps..."
                : `You've accepted. Waiting for ${otherName} to accept too — this page will update automatically.`}
            </div>
          );
        }

        return (
          <div className="flex gap-2">
            <button onClick={() => act(() => api.declineSwap(token, swap.id))} disabled={busy} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
              Decline
            </button>
            <button onClick={() => act(() => api.acceptSwap(token, swap.id))} disabled={busy} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
              {busy && <Loader2 className="animate-spin" size={14} />} Accept swap
            </button>
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
          <button onClick={() => act(() => api.markPosted(token, swap.id))} disabled={busy} className="mt-3 w-full py-2 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--primary-dark)', color: 'var(--surface)' }}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Package size={15} />} Mark as posted
          </button>
        </div>
      )}

      {swap.status === 'accepted' && !(otherUserAddress?.address_line1 && otherUserAddress?.city) && (
        <div className="rounded-lg p-4 text-sm" style={{ background: '#FBF1D9', border: '1px solid #E8D9A8', color: '#5C4711' }}>
          Waiting for {otherName} to add their address before you can post. This page will update automatically.
        </div>
      )}

      {(swap.status === 'accepted') && (isUserA ? swap.user_a_posted : swap.user_b_posted) && (
        <button onClick={() => act(() => api.markReceived(token, swap.id))} disabled={busy} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: 'var(--warning)', color: 'var(--text-primary)' }}>
          {busy && <Loader2 className="animate-spin" size={14} />} Mark stickers as received
        </button>
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
  const [form, setForm] = useState({
    name: user.name || '',
    address_line1: user.address_line1 || '',
    address_line2: user.address_line2 || '',
    city: user.city || '',
    postcode: user.postcode || '',
    country: user.country || '',
    profile_photo: user.profile_photo || null,
  });
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

  const submit = async () => {
    if (!form.address_line1 || !form.city || !form.postcode) {
      setError('Address line 1, city, and postcode are required so swap partners can post to you.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await api.updateMe(token, form);
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
            placeholder="Postcode"
            value={form.postcode}
            onChange={set('postcode')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
          <input
            placeholder="Country"
            value={form.country}
            onChange={set('country')}
            className="w-full px-3 py-2 rounded text-sm"
            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
          />
        </div>

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

  // Check for the verify-email route before anything else — this
  // page must work even for a logged-out visitor clicking an email link.
  // Placed after hook declarations so hook call order stays consistent
  // across renders (Rules of Hooks).
  if (window.location.pathname === '/verify-email') {
    return <VerifyEmailScreen />;
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
  ];

  return (
    <AuthContext.Provider value={{ token, user }}>
      <style>{DESIGN_TOKENS}</style>
      <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

        <header style={{ position: 'sticky', top: 0, zIndex: 10, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={32} />
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Got One Spare?</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
      </div>
    </AuthContext.Provider>
  );
}
