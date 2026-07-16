import React from 'react';

interface Props {
  isAuthenticated: boolean;
}

export default function SyncStatus({ isAuthenticated }: Props) {
  if (!isAuthenticated) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '4px 14px',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#22c55e', display: 'inline-block',
      }} />
      <span style={{ fontSize: '11px', color: '#999' }}>Auto-sync</span>
    </div>
  );
}
