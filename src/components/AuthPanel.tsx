import React, { useState, useEffect } from 'react';
import { getSupabase, getAuthState } from '../lib/supabase';
import { getAll, clearAll } from '../storage';
import { autoSync, syncAll } from '../lib/sync';
import type { AuthState } from '../types';

interface Props {
  onAuthChange: () => void;
  onEntriesChanged?: () => void;
  onShowProfile?: () => void;
}

export default function AuthPanel({ onAuthChange, onEntriesChanged, onShowProfile }: Props) {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false });
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
        const state = await getAuthState();
        setAuth(state);
        setPendingMerge(true);
        onAuthChange();
        return;
      }
      const state = await getAuthState();
      setAuth(state);
      await autoSync();
      onAuthChange();
      onEntriesChanged?.();
      return;
    }

    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (err) { setError(err.message); return; }

    setEmail('');
    setPassword('');
    const local = await getAll();
    if (local.length > 0) {
      const state = await getAuthState();
      setAuth(state);
      setPendingMerge(true);
      onAuthChange();
      return;
    }
    const state = await getAuthState();
    setAuth(state);
    await autoSync();
    onAuthChange();
    onEntriesChanged?.();
  }

  async function handleLogout() {
    try {
      await autoSync();
      await clearAll();
    } catch {}
    const sb = getSupabase();
    await sb?.auth.signOut();
    setAuth({ isAuthenticated: false });
    onAuthChange();
    onEntriesChanged?.();
  }

  async function handleMerge() {
    setMergeBusy(true);
    try { await autoSync(); } catch {}
    setPendingMerge(false);
    setMergeBusy(false);
    const state = await getAuthState();
    setAuth(state);
    onAuthChange();
    onEntriesChanged?.();
  }

  function handleForgotPassword() {
    setResetMode(true);
    setError('');
    setMessage('');
  }

  function handleBackToLogin() {
    setResetMode(false);
    setResetSent(false);
    setError('');
    setMessage('');
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
          redirect_to: `${backendUrl}/auth/reset-password`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.msg || 'Failed to send reset email.');
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
    onAuthChange();
    onEntriesChanged?.();
  }

  if (pendingMerge) {
    return (
      <div style={{ padding: '10px', borderTop: '1px solid #eee' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#333' }}>
          Local entries found
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', lineHeight: 1.4 }}>
          You have saved entries locally. What would you like to do with them?
        </div>
        <button
          onClick={handleMerge}
          disabled={mergeBusy}
          style={{
            width: '100%', padding: '8px', borderRadius: '6px', border: 'none',
            background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 500,
            cursor: mergeBusy ? 'default' : 'pointer', marginBottom: '4px', opacity: mergeBusy ? 0.7 : 1,
          }}
        >
          {mergeBusy ? 'Working...' : 'Merge with account'}
        </button>
        <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px', lineHeight: 1.3 }}>
          Keeps your local entries and syncs them to your account.
        </div>
        <button
          onClick={handleReplace}
          disabled={mergeBusy}
          style={{
            width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e0e0e0',
            background: '#fff', color: '#666', fontSize: '12px', fontWeight: 500,
            cursor: mergeBusy ? 'default' : 'pointer', opacity: mergeBusy ? 0.5 : 1,
          }}
        >
          Replace with cloud data
        </button>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px', lineHeight: 1.3 }}>
          Removes local entries and downloads from your account.
        </div>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', borderTop: '1px solid #eee',
        fontSize: '12px', color: '#666',
      }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#22c55e', display: 'inline-block',
        }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {auth.email}
        </span>
        {onShowProfile && (
          <button
            onClick={onShowProfile}
            style={{
              background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
              fontSize: '11px', textDecoration: 'underline', padding: 0, marginRight: '4px',
            }}
          >
            Profile
          </button>
        )}
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: 'none', color: '#999', cursor: 'pointer',
            fontSize: '11px', textDecoration: 'underline', padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  if (resetMode) {
    return (
      <form onSubmit={handleSendReset} style={{
        padding: '8px 14px', borderTop: '1px solid #eee',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {resetSent ? (
          <>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
              Check your email
            </div>
            <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.4, marginBottom: '8px' }}>
              We've sent a password reset link to <strong>{email}</strong>. Check spam if you don't see it.
            </div>
            <button
              type="button"
              onClick={handleBackToLogin}
              style={{
                background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
                fontSize: '12px', textDecoration: 'underline', padding: 0, alignSelf: 'flex-start',
              }}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '4px' }}>
              Reset your password
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                padding: '6px 8px', borderRadius: '6px', border: '1px solid #d0d0d0',
                fontSize: '12px', outline: 'none',
              }}
            />
            {error && <div style={{ color: '#ef4444', fontSize: '11px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: '#2563eb', color: '#fff', fontSize: '12px',
                  cursor: 'pointer', fontWeight: 500, opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? '...' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={handleBackToLogin}
                style={{
                  background: 'none', border: 'none', color: '#666', cursor: 'pointer',
                  fontSize: '11px', textDecoration: 'underline', padding: 0,
                }}
              >
                Back to sign in
              </button>
            </div>
          </>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '8px 14px', borderTop: '1px solid #eee',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid #d0d0d0',
          fontSize: '12px', outline: 'none',
        }}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        minLength={6}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid #d0d0d0',
          fontSize: '12px', outline: 'none',
        }}
      />
      {mode === 'login' && (
        <button
          type="button"
          onClick={handleForgotPassword}
          style={{
            background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
            fontSize: '11px', textDecoration: 'underline', padding: 0, alignSelf: 'flex-end',
            marginTop: '-4px',
          }}
        >
          Forgot password?
        </button>
      )}
      {message && <div style={{ color: '#22c55e', fontSize: '11px' }}>{message}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: '11px' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: '#2563eb', color: '#fff', fontSize: '12px',
            cursor: 'pointer', fontWeight: 500, opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '...' : mode === 'login' ? 'Sign in' : 'Sign up'}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
          style={{
            background: 'none', border: 'none', color: '#666', cursor: 'pointer',
            fontSize: '11px', textDecoration: 'underline', padding: 0,
          }}
        >
          {mode === 'login' ? 'Create account' : 'Sign in instead'}
        </button>
      </div>
    </form>
  );
}
