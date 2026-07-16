import React, { useState, useEffect } from 'react';
import { getSupabase, getAuthState } from '../lib/supabase';
import type { AuthState } from '../types';

interface Props {
  onAuthChange: () => void;
}

export default function AuthPanel({ onAuthChange }: Props) {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
        setMessage('Account created! Check your email to confirm.');
        setEmail('');
        setPassword('');
        setMode('login');
        return;
      }

      setEmail('');
      setPassword('');
      const state = await getAuthState();
      setAuth(state);
      onAuthChange();
      return;
    }

    const { error: err } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (err) { setError(err.message); return; }

    setEmail('');
    setPassword('');
    const state = await getAuthState();
    setAuth(state);
    onAuthChange();
  }

  async function handleLogout() {
    const sb = getSupabase();
    await sb?.auth.signOut();
    setAuth({ isAuthenticated: false });
    onAuthChange();
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

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '12px 14px', borderTop: '1px solid #eee',
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
