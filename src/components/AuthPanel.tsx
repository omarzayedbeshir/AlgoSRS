import React, { useState, useEffect, useCallback } from 'react';
import { getSupabase, getAuthState } from '../lib/supabase';
import { getAll, clearAll } from '../storage';
import { autoSync, syncAll } from '../lib/sync';
import type { AuthState } from '../types';
import { fontFamily, button, input as inputStyle } from '../styles';
import { useTheme } from './ThemeContext';

interface Props {
  onAuthChange: () => void;
  onEntriesChanged?: () => void;
  onShowProfile?: () => void;
}

export default function AuthPanel({ onAuthChange, onEntriesChanged, onShowProfile }: Props) {
  const { colors } = useTheme();
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
  const [loggingOut, setLoggingOut] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    getAuthState().then(setAuth);
  }, []);

  const onAuthSuccess = useCallback(async () => {
    setEmail('');
    setPassword('');
    const local = await getAll();
    if (local.length > 0) {
      setPendingMerge(true);
      return;
    }
    try {
      await autoSync();
    } catch (err) {
      console.error('autoSync on auth change:', err);
    }
    const state = await getAuthState();
    setAuth(state);
    setShowModal(false);
    onAuthChange();
    onEntriesChanged?.();
  }, [onAuthChange, onEntriesChanged]);

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

    const backendUrl = import.meta.env.WXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

    if (mode === 'signup') {
      const { data, error: err } = await sb.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${backendUrl}/auth/callback`,
          data: { marketing_consent: marketingConsent },
        },
      });
      setLoading(false);

      if (err) {
        setError(err.message);
        return;
      }

      if (!data.session) {
        setMessage('Account created! Check your email (and spam) to confirm.');
        setMode('login');
        return;
      }

      await onAuthSuccess();
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

    await onAuthSuccess();
  }

  async function handleLogout() {
    setLoggingOut(true);
    const sb = getSupabase();
    if (sb) {
      try {
        await autoSync();
      } catch (err) {
        console.error('logout autoSync:', err);
      }
    }
    await clearAll();
    await sb?.auth.signOut();
    const state = await getAuthState();
    setAuth(state);
    onAuthChange();
    setLoggingOut(false);
  }

  async function handleSendReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const sb = getSupabase();
    if (!sb) {
      setError('Supabase not configured.');
      setLoading(false);
      return;
    }

    const backendUrl = import.meta.env.WXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

    const { error: err } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${backendUrl}/auth/callback`,
    });

    if (err) {
      setError(err.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  }

  async function handleReplace() {
    setMergeBusy(true);
    await clearAll();
    try {
      await syncAll();
    } catch (err) {
      console.error('replace syncAll:', err);
    }
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
          <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
            Local entries found
          </div>
          <div
            style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 12 }}
          >
            You have saved entries locally. What would you like to do with them?
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleReplace}
              disabled={mergeBusy}
              style={{
                ...button('primary', colors),
                fontSize: 13,
                padding: '8px 16px',
                opacity: mergeBusy ? 0.6 : 1,
              }}
            >
              {mergeBusy ? 'Working...' : 'Replace with cloud'}
            </button>
            <button
              onClick={async () => {
                try {
                  await autoSync();
                } catch (err) {
                  console.error('merge autoSync:', err);
                }
                onEntriesChanged?.();
                setPendingMerge(false);
                closeModal();
              }}
              disabled={mergeBusy}
              style={{
                ...button('secondary', colors),
                fontSize: 13,
                padding: '8px 16px',
                opacity: mergeBusy ? 0.5 : 1,
              }}
            >
              Merge
            </button>
          </div>
        </div>
      );
    }

    if (resetMode) {
      return (
        <form
          onSubmit={handleSendReset}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {resetSent ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
                Check your email
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                  marginBottom: 8,
                }}
              >
                We've sent a password reset link to{' '}
                <strong style={{ color: colors.text }}>{email}</strong>. Check spam if you don't see
                it.
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setResetSent(false);
                }}
                style={{ ...button('plain', colors), alignSelf: 'flex-start' }}
              >
                Back to login
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>
                Enter your email to receive a password reset link.
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                style={inputStyle(colors)}
              />
              {mode === 'signup' && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    lineHeight: 1.4,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    style={{ accentColor: colors.accent, flexShrink: 0 }}
                  />
                  I'd like to receive updates and tips via email
                </label>
              )}

              {error && <div style={{ fontSize: 12, color: colors.red }}>{error}</div>}
              <button
                type="submit"
                disabled={loading}
                style={{ ...button('primary', colors), opacity: loading ? 0.6 : 1 }}
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setError('');
                }}
                style={{ ...button('plain', colors), alignSelf: 'center' }}
              >
                Back to login
              </button>
            </>
          )}
        </form>
      );
    }

    return (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            background: colors.bgSecondary,
            borderRadius: 10,
            padding: 2,
            marginBottom: 4,
          }}
        >
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                background: mode === m ? colors.bg : 'transparent',
                color: mode === m ? colors.text : colors.textSecondary,
                fontFamily,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          style={inputStyle(colors)}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={6}
          style={inputStyle(colors)}
        />

        {mode === 'signup' && (
          <div
            onClick={() => setMarketingConsent(!marketingConsent)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: colors.textSecondary,
              cursor: 'pointer',
              lineHeight: 1.4,
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: marketingConsent ? colors.accent : colors.bgTertiary,
                position: 'relative',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: colors.bg,
                  position: 'absolute',
                  top: 2,
                  left: marketingConsent ? 16 : 2,
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }}
              />
            </div>
            Receive updates and tips
          </div>
        )}

        {error && <div style={{ fontSize: 12, color: colors.red }}>{error}</div>}
        {message && <div style={{ fontSize: 12, color: colors.green }}>{message}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ ...button('primary', colors), opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => setResetMode(true)}
            style={{ ...button('plain', colors), alignSelf: 'center', fontSize: 12 }}
          >
            Forgot password?
          </button>
        )}
      </form>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 16px 10px',
          borderTop: `1px solid ${colors.separator}`,
          alignItems: 'center',
        }}
      >
        {onShowProfile && (
          <button
            onClick={onShowProfile}
            disabled={loggingOut}
            style={{
              ...button('plain', colors),
              opacity: loggingOut ? 0.5 : 1,
              color: colors.text,
            }}
          >
            Profile
          </button>
        )}
        {loggingOut ? (
          <span
            style={{ fontSize: 13, color: colors.textSecondary, fontFamily, padding: '4px 8px' }}
          >
            Signing out…
          </span>
        ) : (
          <button onClick={handleLogout} style={{ ...button('plain', colors), color: colors.red }}>
            Log out
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() =>
            window.open('https://github.com/omarzayedbeshir/AlgoSRS/issues/new', '_blank')
          }
          style={{ ...button('plain', colors), fontSize: 12, color: colors.textTertiary }}
        >
          Report Bug
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 16px 10px',
          borderTop: `1px solid ${colors.separator}`,
          alignItems: 'center',
        }}
      >
        <button onClick={() => setShowModal(true)} style={{ ...button('plain', colors) }}>
          Sign in
        </button>
        {onShowProfile && (
          <button
            onClick={onShowProfile}
            style={{ ...button('plain', colors), color: colors.text }}
          >
            Profile
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() =>
            window.open('https://github.com/omarzayedbeshir/AlgoSRS/issues/new', '_blank')
          }
          style={{ ...button('plain', colors), fontSize: 12, color: colors.textTertiary }}
        >
          Report Bug
        </button>
      </div>

      {showModal && (
        <div
          onClick={() => closeModal()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2147483646,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280,
              background: colors.bg,
              borderRadius: 14,
              padding: 20,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              fontFamily,
            }}
          >
            <div
              style={{
                width: 36,
                height: 4,
                background: colors.bgTertiary,
                borderRadius: 2,
                margin: '0 auto 16px',
              }}
            />
            {renderForm()}
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={closeModal}
                style={{ ...button('plain', colors), color: colors.textSecondary, fontSize: 13 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
