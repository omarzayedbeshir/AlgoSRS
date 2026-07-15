import React, { useState } from 'react';

interface Props {
  isAuthenticated: boolean;
  onSync: () => Promise<void>;
}

export default function SyncStatus({ isAuthenticated, onSync }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);

  if (!isAuthenticated) return null;

  async function handleSync() {
    setSyncing(true);
    try {
      await onSync();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // silent
    }
    setSyncing(false);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 14px', fontSize: '11px', color: '#999',
    }}>
      <button
        onClick={handleSync}
        disabled={syncing}
        style={{
          background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer',
          fontSize: '11px', padding: 0, textDecoration: 'underline',
        }}
      >
        {syncing ? 'Syncing...' : done ? '✓ Synced' : 'Sync now'}
      </button>
    </div>
  );
}
