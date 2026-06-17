import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Search, Plus, X, Star, ArrowRightLeft, Package, CheckCircle2, Clock, MapPin, LogOut, Loader2 } from 'lucide-react';

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
  signup: (name, email, password) => request('/auth/signup', { method: 'POST', body: { name, email, password } }),
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
  removeDuplicate: (token, stickerId) =>
    request(`/stickers/me/duplicates/${stickerId}`, { method: 'DELETE', token }),
  getMyNeeds: (token) => request('/stickers/me/needs', { token }),
  addNeed: (token, stickerId) => request('/stickers/me/needs', { method: 'POST', body: { stickerId }, token }),
  removeNeed: (token, stickerId) => request(`/stickers/me/needs/${stickerId}`, { method: 'DELETE', token }),

  getMatches: (token) => request('/swaps/matches', { token }),
  createSwap: (token, matchId) => request('/swaps', { method: 'POST', body: { matchId }, token }),
  getSwap: (token, swapId) => request(`/swaps/${swapId}`, { token }),
  acceptSwap: (token, swapId) => request(`/swaps/${swapId}/accept`, { method: 'POST', token }),
  declineSwap: (token, swapId) => request(`/swaps/${swapId}/decline`, { method: 'POST', token }),
  markPosted: (token, swapId) => request(`/swaps/${swapId}/posted`, { method: 'POST', token }),
  markReceived: (token, swapId) => request(`/swaps/${swapId}/received`, { method: 'POST', token }),

  submitRating: (token, swapId, stars, comment) =>
    request('/ratings', { method: 'POST', body: { swapId, stars, comment }, token }),
  getUserRatings: (token, userId) => request(`/ratings/user/${userId}`, { token }),
};

// =================================================================
// Shared UI pieces
// =================================================================
function StickerCard({ sticker, onAdd, onRemove, qtyOverride }) {
  const isShiny = sticker.is_shiny;
  const qty = qtyOverride ?? sticker.quantity;
  return (
    <div
      className="relative group"
      style={{
        background: isShiny
          ? 'linear-gradient(135deg, #D6A419 0%, #F0D584 25%, #D6A419 50%, #F0D584 75%, #D6A419 100%)'
          : '#E8E2D2',
        clipPath:
          'polygon(0% 4px, 4px 4px, 4px 0%, calc(100% - 4px) 0%, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0% calc(100% - 4px))',
        padding: '12px 14px',
        minHeight: '72px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-[11px] font-bold tracking-wider"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: isShiny ? '#3D2E0B' : '#0B3D2E' }}
          >
            {sticker.sticker_number}
          </div>
          <div className="text-sm font-semibold leading-tight mt-0.5 truncate" style={{ color: '#1A1A1A' }} title={sticker.description}>
            {sticker.description}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: isShiny ? '#5C4711' : '#5A6B5F' }}>
            {sticker.team_name}
          </div>
        </div>
      </div>
      {qty > 1 && (
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: '#C8102E', color: '#FAF6EC' }}
        >
          ×{qty}
        </div>
      )}
      {onAdd && (
        <button onClick={onAdd} className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
          <Plus size={14} />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#C8102E', color: '#FAF6EC' }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function StarRating({ value, size = 14, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange && onChange(i)}
          style={{ cursor: onChange ? 'pointer' : 'default', lineHeight: 0 }}
        >
          <Star size={size} fill={i <= Math.round(value) ? '#D6A419' : 'none'} stroke={i <= Math.round(value) ? '#D6A419' : '#9A9486'} />
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <div className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: '#0B3D2E', fontFamily: "'JetBrains Mono', monospace" }}>
          {eyebrow}
        </div>
        <h2 className="text-2xl font-black tracking-tight" style={{ color: '#1A1A1A', fontFamily: "'Archivo Black', sans-serif" }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="rounded p-3 mb-4 flex items-center justify-between text-sm" style={{ background: '#FBEAEA', color: '#9A1F1F', border: '1px solid #E8B4B4' }}>
      <span>{message}</span>
      <button onClick={onDismiss}><X size={14} /></button>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="animate-spin" size={24} color="#0B3D2E" />
    </div>
  );
}

// =================================================================
// AUTH SCREENS
// =================================================================
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = mode === 'login' ? await api.login(email, password) : await api.signup(name, email, password);
      onAuthed(result.token, result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#FAF6EC' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded flex items-center justify-center font-black text-sm" style={{ background: '#0B3D2E', color: '#D6A419' }}>26</div>
          <span className="font-black text-xl" style={{ color: '#1A1A1A', fontFamily: "'Archivo Black', sans-serif" }}>SwapShelf</span>
        </div>

        <div className="rounded-lg p-6" style={{ background: '#E8E2D2', border: '1px solid #D4CCB8' }}>
          <h1 className="text-lg font-bold mb-4" style={{ color: '#1A1A1A' }}>
            {mode === 'login' ? 'Log in' : 'Create your account'}
          </h1>

          <ErrorBanner message={error} onDismiss={() => setError(null)} />

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: '#FAF6EC', border: '1px solid #D4CCB8' }}
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: '#FAF6EC', border: '1px solid #D4CCB8' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: '#FAF6EC', border: '1px solid #D4CCB8' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: '#0B3D2E', color: '#FAF6EC' }}
            >
              {loading && <Loader2 className="animate-spin" size={14} />}
              {mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="w-full text-center text-xs mt-4 font-medium"
            style={{ color: '#5A6B5F' }}
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await api.searchStickers(token, { search: query });
        setResults(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300); // debounce
    return () => clearTimeout(handle);
  }, [query, token]);

  const confirm = async () => {
    if (!selected) return;
    try {
      if (mode === 'duplicate') {
        await api.addDuplicate(token, selected.id, quantity);
      } else {
        await api.addNeed(token, selected.id);
      }
      onPicked();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(11,61,46,0.4)' }}>
      <div className="w-full sm:max-w-md sm:rounded-lg rounded-t-lg max-h-[85vh] flex flex-col" style={{ background: '#FAF6EC' }}>
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #D4CCB8' }}>
          <h3 className="font-bold" style={{ color: '#1A1A1A' }}>
            {mode === 'duplicate' ? 'Add a duplicate' : 'Add to your needs'}
          </h3>
          <button onClick={onClose}><X size={18} color="#5A6B5F" /></button>
        </div>

        <div className="p-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" color="#9A9486" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name, team, or code (e.g. MEX2)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded text-sm"
              style={{ background: '#E8E2D2', border: '1px solid #D4CCB8' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading && <Spinner />}
          {!loading && query && results.length === 0 && (
            <div className="text-center text-sm py-8" style={{ color: '#9A9486' }}>No stickers found for "{query}"</div>
          )}
          <div className="space-y-2">
            {results.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full text-left p-3 rounded flex items-center justify-between"
                style={{
                  background: selected?.id === s.id ? '#D6A419' : '#E8E2D2',
                  border: selected?.id === s.id ? '2px solid #0B3D2E' : '1px solid #D4CCB8',
                }}
              >
                <div>
                  <span className="text-xs font-bold font-mono mr-2" style={{ color: '#0B3D2E' }}>{s.sticker_number}</span>
                  <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.description}</span>
                  <div className="text-xs" style={{ color: '#5A6B5F' }}>{s.team_name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="p-4" style={{ borderTop: '1px solid #D4CCB8' }}>
            {mode === 'duplicate' && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Quantity:</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="w-7 h-7 rounded flex items-center justify-center font-bold" style={{ background: '#E8E2D2' }}>-</button>
                  <span className="w-6 text-center font-bold">{quantity}</span>
                  <button onClick={() => setQuantity((q) => q + 1)} className="w-7 h-7 rounded flex items-center justify-center font-bold" style={{ background: '#E8E2D2' }}>+</button>
                </div>
              </div>
            )}
            <button onClick={confirm} className="w-full py-2.5 rounded text-sm font-semibold" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
              Add {selected.sticker_number}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =================================================================
// RATING MODAL
// =================================================================
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(11,61,46,0.4)' }}>
      <div className="w-full max-w-sm rounded-lg p-6" style={{ background: '#FAF6EC' }}>
        <h3 className="font-bold mb-1" style={{ color: '#1A1A1A' }}>Rate your swap</h3>
        <p className="text-sm mb-4" style={{ color: '#5A6B5F' }}>How was trading with {otherUserName}?</p>

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
          style={{ background: '#E8E2D2', border: '1px solid #D4CCB8' }}
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: '#E8E2D2', color: '#1A1A1A' }}>
            Skip
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
            {loading && <Loader2 className="animate-spin" size={14} />}
            Submit
          </button>
        </div>
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

  return (
    <div className="space-y-8">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="rounded-lg p-5 flex items-center justify-between" style={{ background: '#0B3D2E' }}>
        <div>
          <div className="text-xs font-medium tracking-wide uppercase" style={{ color: '#A8C4B4' }}>Duplicates listed</div>
          <div className="text-3xl font-black mt-1" style={{ color: '#FAF6EC', fontFamily: "'Archivo Black', sans-serif" }}>
            {duplicates.reduce((s, d) => s + d.quantity, 0)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium tracking-wide uppercase" style={{ color: '#A8C4B4' }}>Needs listed</div>
          <div className="text-3xl font-black mt-1" style={{ color: '#D6A419', fontFamily: "'Archivo Black', sans-serif" }}>
            {needs.length}
          </div>
        </div>
      </div>

      <div>
        <SectionHeader
          eyebrow="Spares"
          title="Your duplicates"
          action={
            <button onClick={() => setPicker('duplicate')} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
              <Plus size={15} /> Add
            </button>
          }
        />
        {duplicates.length === 0 ? (
          <EmptyState text="No duplicates listed yet. Add the stickers you've got spare so others can find them." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {duplicates.map((s) => (
              <StickerCard key={s.sticker_id} sticker={s} onRemove={() => removeDuplicate(s.sticker_id)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader
          eyebrow="Wanted"
          title="Your needs"
          action={
            <button onClick={() => setPicker('need')} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold border-2" style={{ borderColor: '#0B3D2E', color: '#0B3D2E' }}>
              <Plus size={15} /> Add
            </button>
          }
        />
        {needs.length === 0 ? (
          <EmptyState text="No needs listed yet. Add what you're missing so we can match you up." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {needs.map((s) => (
              <StickerCard key={s.sticker_id} sticker={s} onRemove={() => removeNeed(s.sticker_id)} />
            ))}
          </div>
        )}
      </div>

      {picker && <StickerPickerModal mode={picker} onClose={() => setPicker(null)} onPicked={load} />}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-lg p-6 text-center text-sm" style={{ background: '#E8E2D2', color: '#5A6B5F', border: '1px dashed #B8AE94' }}>
      {text}
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
      <SectionHeader eyebrow="Found for you" title="Potential swaps" />
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {matches.length === 0 ? (
        <EmptyState text="No matches yet — list more duplicates and needs to improve your chances." />
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <div key={m.id} className="rounded-lg p-4 flex items-center justify-between" style={{ background: '#E8E2D2', border: '1px solid #D4CCB8' }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
                  {m.other_user_name.split(' ').map((p) => p[0]).join('')}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: '#1A1A1A' }}>{m.other_user_name}</div>
                  <div className="flex items-center gap-1.5">
                    <StarRating value={m.rating_avg} size={12} />
                    <span className="text-xs" style={{ color: '#5A6B5F' }}>({m.rating_count})</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm font-bold mb-1.5" style={{ color: '#0B3D2E' }}>
                  <span>You give {m.a_gives_b_count}</span>
                  <ArrowRightLeft size={13} />
                  <span>You get {m.b_gives_a_count}</span>
                </div>
                <button
                  onClick={() => proposeSwap(m.id)}
                  disabled={creatingId === m.id}
                  className="px-4 py-1.5 rounded text-sm font-semibold flex items-center gap-2"
                  style={{ background: '#D6A419', color: '#1A1A1A' }}
                >
                  {creatingId === m.id && <Loader2 className="animate-spin" size={13} />}
                  Review swap
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =================================================================
// SWAP DETAIL SCREEN
// =================================================================
function SwapDetailScreen({ swapId, onRated }) {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showRating, setShowRating] = useState(false);

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

  if (loading) return <Spinner />;
  if (!data) return <ErrorBanner message={error || 'Swap not found'} onDismiss={() => {}} />;

  const { swap, items, otherUserAddress } = data;
  const isUserA = swap.user_a_id === user.id;
  const youGive = items.filter((i) => i.from_user_id === user.id);
  const youReceive = items.filter((i) => i.to_user_id === user.id);
  const otherName = otherUserAddress?.name || (isUserA ? `User #${swap.user_b_id}` : `User #${swap.user_a_id}`);

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

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: '#0B3D2E', fontFamily: "'JetBrains Mono', monospace" }}>
            Swap #{swap.id}
          </div>
          <h2 className="text-2xl font-black" style={{ color: '#1A1A1A', fontFamily: "'Archivo Black', sans-serif" }}>
            with {otherName}
          </h2>
        </div>
      </div>

      {swap.status !== 'declined' && (
        <div className="flex items-center">
          {['Proposed', 'Accepted', 'Posted', 'Done'].map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex flex-col items-center gap-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: i <= currentStep ? '#0B3D2E' : '#E8E2D2', color: i <= currentStep ? '#FAF6EC' : '#9A9486' }}>
                  {i < currentStep ? <CheckCircle2 size={15} /> : i === currentStep ? <Clock size={14} /> : i + 1}
                </div>
                <span className="text-[10px] font-medium" style={{ color: i <= currentStep ? '#0B3D2E' : '#9A9486' }}>{label}</span>
              </div>
              {i < 3 && <div className="flex-1 h-0.5 mb-4" style={{ background: i < currentStep ? '#0B3D2E' : '#D4CCB8' }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#C8102E' }}>You send</div>
          <div className="grid grid-cols-1 gap-2">
            {youGive.map((s) => <StickerCard key={s.sticker_id} sticker={s} qtyOverride={1} />)}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="w-10 h-10 rounded-full flex items-center justify-center rotate-90 md:rotate-0" style={{ background: '#D6A419' }}>
            <ArrowRightLeft size={18} color="#1A1A1A" />
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#0B3D2E' }}>You receive</div>
          <div className="grid grid-cols-1 gap-2">
            {youReceive.map((s) => <StickerCard key={s.sticker_id} sticker={s} qtyOverride={1} />)}
          </div>
        </div>
      </div>

      {swap.status === 'proposed' && (
        <div className="flex gap-2">
          <button onClick={() => act(() => api.declineSwap(token, swap.id))} disabled={busy} className="flex-1 py-2.5 rounded text-sm font-semibold" style={{ background: '#E8E2D2', color: '#1A1A1A' }}>
            Decline
          </button>
          <button onClick={() => act(() => api.acceptSwap(token, swap.id))} disabled={busy} className="flex-1 py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
            {busy && <Loader2 className="animate-spin" size={14} />} Accept swap
          </button>
        </div>
      )}

      {swap.status === 'accepted' && otherUserAddress && (
        <div className="rounded-lg p-4" style={{ background: '#E8E2D2', border: '1px solid #D4CCB8' }}>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={16} color="#0B3D2E" />
            <span className="text-sm font-bold" style={{ color: '#0B3D2E' }}>Post to</span>
          </div>
          <div className="text-sm" style={{ color: '#1A1A1A' }}>
            {otherUserAddress.name}<br />
            {otherUserAddress.address_line1}<br />
            {otherUserAddress.city}, {otherUserAddress.postcode}
          </div>
          <button onClick={() => act(() => api.markPosted(token, swap.id))} disabled={busy} className="mt-3 w-full py-2 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: '#0B3D2E', color: '#FAF6EC' }}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Package size={15} />} Mark as posted
          </button>
        </div>
      )}

      {(swap.status === 'accepted') && (isUserA ? swap.user_a_posted : swap.user_b_posted) && (
        <button onClick={() => act(() => api.markReceived(token, swap.id))} disabled={busy} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: '#D6A419', color: '#1A1A1A' }}>
          {busy && <Loader2 className="animate-spin" size={14} />} Mark stickers as received
        </button>
      )}

      {swap.status === 'completed' && (
        <button onClick={() => setShowRating(true)} className="w-full py-2.5 rounded text-sm font-semibold flex items-center justify-center gap-2" style={{ background: '#D6A419', color: '#1A1A1A' }}>
          <Star size={15} /> Rate this swap
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
    <div className="min-h-screen w-full flex items-center justify-center px-5" style={{ background: '#FAF6EC', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded mx-auto mb-5 flex items-center justify-center font-black text-lg" style={{ background: '#0B3D2E', color: '#D6A419' }}>26</div>

        {status === 'verifying' && (
          <>
            <Loader2 className="animate-spin mx-auto mb-4" size={28} color="#0B3D2E" />
            <p style={{ color: '#5A6B5F' }}>Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto mb-4" size={36} color="#0B3D2E" />
            <h2 className="font-black text-xl mb-2" style={{ color: '#1A1A1A', fontFamily: "'Archivo Black', sans-serif" }}>Email verified!</h2>
            <p className="mb-5" style={{ color: '#5A6B5F' }}>Your account is fully active. You can head back to SwapShelf and start swapping.</p>
            <a
              href="/"
              className="inline-block px-6 py-3 rounded font-semibold text-sm"
              style={{ background: '#0B3D2E', color: '#FAF6EC' }}
            >
              Go to SwapShelf
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <X className="mx-auto mb-4" size={36} color="#C8102E" />
            <h2 className="font-black text-xl mb-2" style={{ color: '#1A1A1A', fontFamily: "'Archivo Black', sans-serif" }}>Verification failed</h2>
            <p className="mb-5" style={{ color: '#5A6B5F' }}>{errorMsg}</p>
            <p className="text-sm" style={{ color: '#5A6B5F' }}>
              Log in to SwapShelf and use "Resend verification email" from there if your link expired.
            </p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-3 rounded font-semibold text-sm"
              style={{ background: '#0B3D2E', color: '#FAF6EC' }}
            >
              Go to SwapShelf
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// =================================================================
// APP SHELL
// =================================================================
export default function PaniniSwapApp() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [activeSwapId, setActiveSwapId] = useState(null);

  // Check for the verify-email route before anything else — this
  // page must work even for a logged-out visitor clicking an email link.
  // Placed after hook declarations so hook call order stays consistent
  // across renders (Rules of Hooks).
  if (window.location.pathname === '/verify-email') {
    return <VerifyEmailScreen />;
  }

  const handleAuthed = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setTab('dashboard');
  };

  if (!token || !user) {
    return <AuthScreen onAuthed={handleAuthed} />;
  }

  return (
    <AuthContext.Provider value={{ token, user }}>
      <div className="min-h-screen w-full" style={{ background: '#FAF6EC', fontFamily: "'Inter', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');`}</style>

        <header className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between" style={{ background: '#FAF6EC', borderBottom: '3px solid #0B3D2E' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center font-black text-sm" style={{ background: '#0B3D2E', color: '#D6A419' }}>26</div>
            <span className="font-black text-lg" style={{ color: '#1A1A1A', fontFamily: "'Archivo Black', sans-serif" }}>SwapShelf</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium" style={{ color: '#5A6B5F' }}>{user.name}</span>
            <button onClick={logout} title="Log out"><LogOut size={16} color="#5A6B5F" /></button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
          {tab === 'dashboard' && <DashboardScreen />}
          {tab === 'matches' && (
            <MatchesScreen
              onOpenSwap={(swapId) => {
                setActiveSwapId(swapId);
                setTab('swap');
              }}
            />
          )}
          {tab === 'swap' && activeSwapId && (
            <SwapDetailScreen swapId={activeSwapId} onRated={() => setTab('dashboard')} />
          )}
          {tab === 'swap' && !activeSwapId && (
            <EmptyState text="No active swap selected. Pick one from your matches." />
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 flex justify-center" style={{ background: '#FAF6EC', borderTop: '1px solid #D4CCB8' }}>
          <div className="flex w-full max-w-2xl">
            {[
              { id: 'dashboard', label: 'My album' },
              { id: 'matches', label: 'Matches' },
              { id: 'swap', label: 'Active swap' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-3 text-sm font-semibold"
                style={{ color: tab === t.id ? '#0B3D2E' : '#9A9486', borderTop: tab === t.id ? '2px solid #0B3D2E' : '2px solid transparent' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </AuthContext.Provider>
  );
}
