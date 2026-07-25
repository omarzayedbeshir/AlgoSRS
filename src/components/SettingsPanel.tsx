import { useState, useEffect } from 'react';
import { clearAll } from '../storage';
import { getSupabase } from '../lib/supabase';
import { api } from '../lib/api-client';
import { colors, fontFamily, button } from '../styles';

interface Props {
  onBack: () => void;
  onAuthChange: () => void;
  onEntriesChanged?: () => void;
}

type DeleteStep = 'none' | 'confirm' | 'final';

export default function SettingsPanel({ onBack, onAuthChange, onEntriesChanged }: Props) {
  const [confirmAction, setConfirmAction] = useState<'reset' | 'delete' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('none');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [marketingError, setMarketingError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth
      .getUser()
      .then(({ data }) => {
        const val = data.user?.user_metadata?.marketing_consent;
        if (typeof val === 'boolean') setMarketingConsent(val);
      })
      .catch(() => {});
  }, []);

  async function handleToggleMarketing() {
    setMarketingLoading(true);
    setMarketingError(null);
    const sb = getSupabase();
    if (!sb) {
      setMarketingLoading(false);
      return;
    }
    const next = !marketingConsent;
    try {
      const { error } = await sb.auth.updateUser({ data: { marketing_consent: next } });
      if (error) throw error;
      setMarketingConsent(next);
    } catch (err) {
      setMarketingError(err instanceof Error ? err.message : 'Failed to update preference');
    } finally {
      setMarketingLoading(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAllEntries();
    } catch (err) {
      console.error('deleteAllEntries:', err);
    }
    await clearAll();
    setConfirmAction(null);
    setConfirmText('');
    setBusy(false);
    onEntriesChanged?.();
    onBack();
  }

  async function handleDeleteRequest() {
    setBusy(true);
    setError(null);
    try {
      await api.requestDeleteUser();
      setDeleteStep('final');
      setConfirmText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate deletion');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFinal() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteUser(true);
      const sb = getSupabase();
      await clearAll();
      await sb?.auth.signOut();
      setDeleteStep('none');
      setConfirmAction(null);
      setConfirmText('');
      setBusy(false);
      onAuthChange();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setBusy(false);
    }
  }

  function cancelConfirm() {
    setConfirmAction(null);
    setConfirmText('');
    setDeleteStep('none');
    setError(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: `1px solid ${colors.separator}`,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            flex: 1,
            textAlign: 'left',
            background: 'none',
            border: 'none',
            color: colors.accent,
            fontSize: 15,
            padding: 0,
            fontFamily,
            cursor: 'pointer',
          }}
        >
          ‹ Back
        </button>
        <span
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 15,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Settings
        </span>
        <span style={{ flex: 1 }} />
      </div>

      {!confirmAction ? (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '16px' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Preferences
          </div>
          <div
            style={{
              background: colors.bg,
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, color: colors.text }}>
              Receive product updates and tips
            </span>
            <div
              onClick={marketingLoading ? undefined : handleToggleMarketing}
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: marketingConsent ? colors.accent : colors.bgTertiary,
                position: 'relative',
                flexShrink: 0,
                cursor: marketingLoading ? 'default' : 'pointer',
                opacity: marketingLoading ? 0.5 : 1,
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
          </div>
          {marketingError && (
            <div style={{ fontSize: 12, color: colors.red, marginBottom: 12 }}>
              {marketingError}
            </div>
          )}
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            Danger Zone
          </div>
          <div style={{ background: colors.bg, borderRadius: 10, overflow: 'hidden' }}>
            {[
              { label: 'Reset all data', action: () => setConfirmAction('reset'), danger: false },
              { label: 'Delete account', action: () => setConfirmAction('delete'), danger: true },
            ].map((item, i, arr) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  background: colors.bg,
                  borderBottom: i < arr.length - 1 ? `1px solid ${colors.separator}` : 'none',
                  fontFamily,
                  fontSize: 14,
                  color: item.danger ? colors.red : colors.text,
                  cursor: 'pointer',
                }}
              >
                {item.label}
                <span style={{ color: colors.textTertiary, fontSize: 16 }}>&gt;</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: 16 }}>
          <div style={{ background: colors.bgSecondary, borderRadius: 10, padding: 14 }}>
            {confirmAction === 'reset' ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
                  Reset all data?
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  This will permanently delete all your saved problems and review history.
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                  Type <strong style={{ color: colors.text }}>DELETE</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  style={{
                    fontFamily,
                    fontSize: 14,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: colors.bg,
                    color: colors.text,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                {busy && (
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                    Working...
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    onClick={handleReset}
                    disabled={confirmText !== 'DELETE' || busy}
                    style={{
                      ...button('primary'),
                      flex: 1,
                      opacity: confirmText !== 'DELETE' || busy ? 0.5 : 1,
                    }}
                  >
                    Reset
                  </button>
                  <button
                    onClick={cancelConfirm}
                    disabled={busy}
                    style={{ ...button('secondary'), opacity: busy ? 0.5 : 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : deleteStep === 'none' ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.red, marginBottom: 6 }}>
                  Delete account?
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  This will permanently delete all your data and your account. This cannot be
                  undone.
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                  Type <strong style={{ color: colors.text }}>DELETE</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  style={{
                    fontFamily,
                    fontSize: 14,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: colors.bg,
                    color: colors.text,
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                {error && (
                  <div style={{ fontSize: 12, color: colors.red, marginTop: 6 }}>{error}</div>
                )}
                {busy && (
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                    Working...
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    onClick={handleDeleteRequest}
                    disabled={confirmText !== 'DELETE' || busy}
                    style={{
                      ...button('danger'),
                      flex: 1,
                      opacity: confirmText !== 'DELETE' || busy ? 0.5 : 1,
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={cancelConfirm}
                    disabled={busy}
                    style={{ ...button('secondary'), opacity: busy ? 0.5 : 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.red, marginBottom: 6 }}>
                  Final confirmation
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  Are you absolutely sure? This action is permanent and cannot be undone. All your
                  data will be lost.
                </div>
                {error && (
                  <div style={{ fontSize: 12, color: colors.red, marginTop: 6 }}>{error}</div>
                )}
                {busy && (
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
                    Deleting...
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <button
                    onClick={handleDeleteFinal}
                    disabled={busy}
                    style={{ ...button('danger'), flex: 1, opacity: busy ? 0.5 : 1 }}
                  >
                    Yes, delete everything
                  </button>
                  <button
                    onClick={cancelConfirm}
                    disabled={busy}
                    style={{ ...button('secondary'), opacity: busy ? 0.5 : 1 }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
