import { useState, useEffect } from 'react';
import { getAll, clearAll } from '../storage';
import { getSupabase } from '../lib/supabase';
import { api } from '../lib/api-client';
import type { LeetCodeEntry } from '../types';
import { colors, fontFamily, button, sectionHeader } from '../styles';

interface Props {
  onBack: () => void;
  onAuthChange: () => void;
  onEntriesChanged?: () => void;
  onShowStats?: () => void;
}

const RATING_EMOJI: Record<number, string> = { 1: '😰', 2: '😅', 3: '🙂', 4: '😎' };
const RATING_COLORS: Record<number, string> = { 1: '#ff3b30', 2: '#ff9500', 3: '#34c759', 4: '#0071e3' };

export default function ProfilePanel({ onBack, onAuthChange, onEntriesChanged, onShowStats }: Props) {
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
      await api.deleteUser();
    } catch (e) {
      setBusy(false);
      setConfirmAction(null);
      setConfirmText('');
      return;
    }

    const sb = getSupabase();
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: `1px solid ${colors.separator}`,
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', color: colors.accent, fontSize: 15, padding: 0, fontFamily, cursor: 'pointer' }}>
          ‹ Back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 600, color: colors.text }}>Profile</span>
        <span style={{ flex: 1 }} />
      </div>

      {!confirmAction ? (
        <>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px 16px 12px' }}>
              <div style={{ background: colors.bgSecondary, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>{total}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Problems</div>
              </div>
              <div style={{ background: colors.bgSecondary, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>{avgRatingPct}%</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Avg Rating</div>
              </div>
              <div style={{ background: colors.bgSecondary, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>{avgStability}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Stability</div>
              </div>
              <div style={{ background: colors.bgSecondary, borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>{entries.length}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Reviews</div>
              </div>
            </div>

            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ background: colors.bg, borderRadius: 10, padding: 12 }}>
                {[1, 2, 3, 4].map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r === 4 ? 0 : 6 }}>
                    <span style={{ fontSize: 14, minWidth: 24 }}>{RATING_EMOJI[r]}</span>
                    <div style={{ flex: 1, height: 8, background: colors.bgTertiary, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: total > 0 ? `${(ratingCounts[r] / total) * 100}%` : '0%',
                        height: '100%', background: RATING_COLORS[r], borderRadius: 4,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: colors.textSecondary, minWidth: 20, textAlign: 'right' }}>{ratingCounts[r]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0, padding: '0 16px 16px' }}>
            <div style={{ background: colors.bg, borderRadius: 10, overflow: 'hidden' }}>
              {[
                { label: 'Statistics', action: () => onShowStats?.(), danger: false },
                { label: 'Reset all data', action: () => setConfirmAction('reset'), danger: false },
                { label: 'Delete account', action: () => setConfirmAction('delete'), danger: true },
              ].map((item, i, arr) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '12px 14px', border: 'none', background: colors.bg,
                    borderBottom: i < arr.length - 1 ? `1px solid ${colors.separator}` : 'none',
                    fontFamily, fontSize: 14, color: item.danger ? colors.red : colors.text, cursor: 'pointer',
                  }}
                >
                  {item.label}
                  <span style={{ color: colors.textTertiary, fontSize: 16 }}>&gt;</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 16 }}>
          <div style={{ background: colors.bgSecondary, borderRadius: 10, padding: 14 }}>
            {confirmAction === 'reset' ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>Reset all data?</div>
                <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
                  This will permanently delete all your saved problems and review history.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.red, marginBottom: 6 }}>Delete account?</div>
                <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, marginBottom: 10 }}>
                  This will permanently delete all your data and your account. This cannot be undone.
                </div>
              </>
            )}
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
              Type <strong style={{ color: colors.text }}>DELETE</strong> to confirm:
            </div>
            <input
              type="text" value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{
                fontFamily, fontSize: 14, padding: '10px 12px', borderRadius: 8, border: 'none',
                background: colors.bg, color: colors.text, outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            {busy && <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>Working...</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button
                onClick={confirmAction === 'reset' ? handleReset : handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || busy}
                style={{
                  ...button(confirmAction === 'delete' ? 'danger' : 'primary'),
                  flex: 1, opacity: confirmText !== 'DELETE' || busy ? 0.5 : 1,
                }}
              >
                {confirmAction === 'reset' ? 'Reset' : 'Delete'}
              </button>
              <button onClick={cancelConfirm} disabled={busy} style={{ ...button('secondary'), opacity: busy ? 0.5 : 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
