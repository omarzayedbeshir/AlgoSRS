import React, { useState, useEffect } from 'react';
import { getSupabase, getAuthState } from '../lib/supabase';
import { getAll, clearAll } from '../storage';
import { autoSync, syncAll } from '../lib/sync';
import type { AuthState } from '../types';
import { colors, fontFamily, button, input as inputStyle } from '../styles';

interface Props {
  onAuthChange: () => void;
  onEntriesChanged?: () => void;
  onShowProfile?: () => void;
}

export default function AuthPanel({ onAuthChange, onEntriesChanged, onShowProfile }: Props) {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false });
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingMerge, setPendingMerge] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    getAuthState().then(setAuth);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const sb = getSupabase();
    if (!sb) {
      setError('Supabase not configured. Check .env file.');
      setLoading(false);
      return;
    }

    if (mode === 'signup') {
      const { data, error: err } = await sb.auth.signUp({ email, password });
      setLoading(false);

      if (err) { setError(err.message); return; }

      if (!data.session) {
        setMessage("Account created! Check your email (and spam) to confirm.");
        setEmail('');
        setPassword('');
        setMode('login');
        return;
      }

      setEmail('');
      setPassword('');
      const local = await getAll();
      if (local.length > 0) {
        setPendingMerge(true);
        return;
      }

      try { await autoSync(); } catch {}
      const state = await getAuthState();
      setAuth(state);
      setShowModal(false);
      onAuthChange();
      onEntriesChanged?.();
      return;
    }

    const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (err) {
      if (err.message.includes('Email not confirmed')) {
        setError('Please confirm your email before logging in.');
      } else {
        setError(err.message);
      }
      return;
    }

    if (!data.session) {
      setError('Login failed. Please try again.');
      return;
    }

    setEmail('');
    setPassword('');
    const local = await getAll();
    if (local.length > 0) {
      setPendingMerge(true);
      return;
    }

    try { await autoSync(); } catch {}
    const state = await getAuthState();
    setAuth(state);
    setShowModal(false);
    onAuthChange();
    onEntriesChanged?.();
  }

  async function handleLogout() {
    const sb = getSupabase();
    if (sb) {
      try { await autoSync(); } catch {}
    }
    await clearAll();
    await sb?.auth.signOut();
    const state = await getAuthState();
    setAuth(state);
    onAuthChange();
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabaseUrl = import.meta.env.WXT_PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY;
    const backendUrl = import.meta.env.WXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({
          email,
          redirect_to: `${backendUrl}/auth/callback`,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || `Error ${res.status}`);
      }

      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReplace() {
    setMergeBusy(true);
    await clearAll();
    try { await syncAll(); } catch {}
    setPendingMerge(false);
    setMergeBusy(false);
    const state = await getAuthState();
    setAuth(state);
    setShowModal(false);
    onAuthChange();
    onEntriesChanged?.();
  }

  async function closeModal() {
    setShowModal(false);
    setResetMode(false);
    setResetSent(false);
    setError('');
    setMessage('');
    setMode('login');
    const state = await getAuthState();
    if (state.isAuthenticated) {
      setAuth(state);
      onAuthChange();
    }
  }

  function renderForm() {
    if (pendingMerge) {
      return (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 8 }}>Local entries found</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 12 }}>
            You have saved entries locally. What would you like to do with them?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleReplace} disabled={mergeBusy} style={{ ...button('primary'), fontSize: 13, padding: '8px 16px', opacity: mergeBusy ? 0.6 : 1 }}>
              {mergeBusy ? 'Working...' : 'Replace with cloud'}
            </button>
            <button onClick={() => { try { autoSync(); } catch {}; setPendingMerge(false); closeModal(); }} disabled={mergeBusy} style={{ ...button('secondary'), fontSize: 13, padding: '8px 16px', opacity: mergeBusy ? 0.5 : 1 }}>
              Merge
            </button>
          </div>
        </div>
      );
    }

    if (resetMode) {
      return (
        <form onSubmit={handleSendReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resetSent ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>
                We've sent a password reset link to <strong style={{ color: colors.text }}>{email}</strong>. Check spam if you don't see it.
              </div>
              <button type="button" onClick={() => { setResetMode(false); setResetSent(false); }} style={{ ...button('plain'), alignSelf: 'flex-start' }}>
                Back to login
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>Enter your email to receive a password reset link.</div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={inputStyle} />
              {error && <div style={{ fontSize: 12, color: colors.red }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...button('primary'), opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => { setResetMode(false); setError(''); }} style={{ ...button('plain'), alignSelf: 'center' }}>
                Back to login
              </button>
            </>
          )}
        </form>
      );
    }

    return (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', background: colors.bgSecondary, borderRadius: 10, padding: 2, marginBottom: 4 }}>
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500,
                background: mode === m ? colors.bg : 'transparent', color: mode === m ? colors.text : colors.textSecondary,
                fontFamily, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={inputStyle} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required minLength={6} style={inputStyle} />

        {error && <div style={{ fontSize: 12, color: colors.red }}>{error}</div>}
        {message && <div style={{ fontSize: 12, color: colors.green }}>{message}</div>}

        <button type="submit" disabled={loading} style={{ ...button('primary'), opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {mode === 'login' && (
          <button type="button" onClick={() => setResetMode(true)} style={{ ...button('plain'), alignSelf: 'center', fontSize: 12 }}>
            Forgot password?
          </button>
        )}
      </form>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div style={{ display: 'flex', gap: 8, padding: '6px 16px 10px', borderTop: `1px solid ${colors.separator}` }}>
        {onShowProfile && (
          <button onClick={onShowProfile} style={button('plain')}>Profile</button>
        )}
        <button onClick={handleLogout} style={{ ...button('plain'), color: colors.red }}>Log out</button>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 16px 10px', borderTop: `1px solid ${colors.separator}` }}>
        <button onClick={() => setShowModal(true)} style={{ background: 'none', border: 'none', color: colors.accent, fontSize: 14, fontWeight: 500, fontFamily, cursor: 'pointer', padding: '4px 8px' }}>
          Sign in
        </button>
      </div>

      {showModal && (
        <div
          onClick={() => closeModal()}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483646,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 280, background: colors.bg, borderRadius: 14, padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              fontFamily,
            }}
          >
            <div style={{
              width: 36, height: 4, background: colors.bgTertiary, borderRadius: 2,
              margin: '0 auto 16px',
            }} />
            {renderForm()}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={closeModal} style={{ ...button('plain'), color: colors.textSecondary, fontSize: 13 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
