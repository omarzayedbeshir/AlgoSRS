import React, { useState, useEffect } from 'react';
import { getAll, clearAll } from '../storage';
import { getSupabase } from '../lib/supabase';
import { api } from '../lib/api-client';
import type { LeetCodeEntry } from '../types';

interface Props {
  onBack: () => void;
  onAuthChange: () => void;
  onEntriesChanged?: () => void;
}

const RATING_EMOJI: Record<number, string> = { 1: '😰', 2: '😅', 3: '🙂', 4: '😎' };

export default function ProfilePanel({ onBack, onAuthChange, onEntriesChanged }: Props) {
  const [entries, setEntries] = useState<LeetCodeEntry[]>([]);
  const [confirmAction, setConfirmAction] = useState<'reset' | 'delete' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAll().then(setEntries);
  }, []);

  const total = entries.length;

  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let ratingSum = 0;
  for (const e of entries) {
    ratingCounts[e.rating] = (ratingCounts[e.rating] || 0) + 1;
    ratingSum += e.rating;
  }
  const avgRatingPct = total > 0 ? Math.round((ratingSum / total / 4) * 100) : 0;

  const stabilities = entries.filter(e => e.stability != null).map(e => e.stability!);
  const avgStability = stabilities.length > 0
    ? (stabilities.reduce((a, b) => a + b, 0) / stabilities.length).toFixed(1)
    : '—';

  async function handleReset() {
    setBusy(true);
    try {
      await api.deleteAllEntries();
    } catch {}
    await clearAll();
    setConfirmAction(null);
    setConfirmText('');
    setBusy(false);
    onEntriesChanged?.();
    onBack();
  }

  async function handleDeleteAccount() {
    setBusy(true);
    try {
      await api.deleteAllEntries();
    } catch {}

    const sb = getSupabase();
    if (sb) {
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        try {
          await fetch(
            `${import.meta.env.WXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.WXT_PUBLIC_SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
              },
            },
          );
        } catch {}
      }
    }

    await clearAll();
    await sb?.auth.signOut();
    setConfirmAction(null);
    setConfirmText('');
    setBusy(false);
    onAuthChange();
    onBack();
  }

  function cancelConfirm() {
    setConfirmAction(null);
    setConfirmText('');
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 8px', borderRadius: '6px', border: '1px solid #d0d0d0',
    fontSize: '12px', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px',
    cursor: 'pointer', fontWeight: 500, opacity: busy ? 0.7 : 1,
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', borderBottom: '1px solid #eee',
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2563eb', fontSize: '13px', padding: 0,
        }}>
          ← Back
        </button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>
          Profile
        </span>
      </div>

      {!confirmAction ? (
        <>
          <div style={{ padding: '10px 14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
              📊 Your Stats
            </div>
            <div style={{
              background: '#f5f6f8', borderRadius: '8px', padding: '10px',
              fontSize: '12px', color: '#444', lineHeight: 1.8,
            }}>
              <div>Total problems: <strong>{total}</strong></div>
              <div style={{ marginTop: '6px' }}>
                {[1, 2, 3, 4].map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ minWidth: '60px' }}>{RATING_EMOJI[r]}</span>
                    <div style={{
                      flex: 1, height: '14px', background: '#e0e0e0', borderRadius: '7px',
                      overflow: 'hidden', position: 'relative',
                    }}>
                      <div style={{
                        width: total > 0 ? `${(ratingCounts[r] / total) * 100}%` : '0%',
                        height: '100%', background: '#2563eb', borderRadius: '7px',
                      }} />
                    </div>
                    <span style={{ minWidth: '24px', textAlign: 'right', color: '#666' }}>{ratingCounts[r]}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '6px' }}>
                Average rating: <strong>{avgRatingPct}%</strong>
              </div>
              <div>
                Average stability: <strong>{avgStability}</strong>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 14px 10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>
              ⚙️ Actions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => setConfirmAction('reset')}
                style={{
                  ...btnStyle, background: '#f5f6f8', color: '#333',
                  textAlign: 'left', border: '1px solid #e0e0e0',
                }}
              >
                Reset all data
              </button>
              <button
                onClick={() => setConfirmAction('delete')}
                style={{
                  ...btnStyle, background: '#fef2f2', color: '#dc2626',
                  textAlign: 'left', border: '1px solid #fecaca',
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '10px 14px' }}>
          <div style={{
            background: '#f5f6f8', borderRadius: '8px', padding: '10px',
            fontSize: '12px', color: '#444',
          }}>
            {confirmAction === 'reset' ? (
              <>
                <div style={{ fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                  Reset all data?
                </div>
                <div style={{ lineHeight: 1.4, marginBottom: '8px' }}>
                  This will permanently delete all your saved problems and review history.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                  Delete account?
                </div>
                <div style={{ lineHeight: 1.4, marginBottom: '8px' }}>
                  This will permanently delete all your data and your account. This cannot be undone.
                </div>
              </>
            )}
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
              Type <strong>DELETE</strong> to confirm:
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              style={inputStyle}
            />
            {busy && (
              <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>
                Working...
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                onClick={confirmAction === 'reset' ? handleReset : handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || busy}
                style={{
                  ...btnStyle,
                  background: confirmAction === 'delete' ? '#dc2626' : '#2563eb',
                  color: '#fff',
                  opacity: confirmText !== 'DELETE' || busy ? 0.5 : 1,
                  cursor: confirmText !== 'DELETE' || busy ? 'default' : 'pointer',
                }}
              >
                {confirmAction === 'reset' ? 'Reset' : 'Delete'}
              </button>
              <button
                onClick={cancelConfirm}
                disabled={busy}
                style={{
                  ...btnStyle, background: '#e0e0e0', color: '#666',
                  opacity: busy ? 0.5 : 1,
                  cursor: busy ? 'default' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
