import React, { useState, useEffect } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { getAll, remove } from '../storage';
import { api } from '../lib/api-client';
import ReviewPanel from './ReviewPanel';

const RATING_EMOJI: Record<Rating, string> = {
  1: '😰', 2: '😅', 3: '🙂', 4: '😎',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#00b8a3',
  medium: '#ffc01e',
  hard: '#ff375f',
};

interface Props {
  onSaveNew: () => void;
  showNewButton?: boolean;
  isAuthenticated?: boolean;
  syncKey?: number;
}

export default function PracticeList({ onSaveNew, showNewButton, isAuthenticated, syncKey }: Props) {
  const [entries, setEntries] = useState<LeetCodeEntry[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, [isAuthenticated, syncKey]);

  async function loadEntries() {
    const all = await getAll();
    setEntries(all);
  }

  async function handleDelete(id: string) {
    await remove(id);
    if (isAuthenticated) {
      api.deleteEntry(id).catch(() => {});
    }
    const all = await getAll();
    setEntries(all);
  }

  function formatDueDate(dateStr: string | undefined): string {
    if (!dateStr) return 'Due now';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((d.getTime() - now.getTime()) / 86400000);
    if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (reviewingId) {
    const entry = entries.find(e => e.id === reviewingId);
    if (entry) {
      return (
        <ReviewPanel
          entry={entry}
          onComplete={() => {
            setReviewingId(null);
            loadEntries();
          }}
        />
      );
    }
    setReviewingId(null);
  }

  const now = new Date();
  const dueEntries = entries.filter(e => !e.dueDate || new Date(e.dueDate) <= now);
  const upcomingEntries = entries.filter(e => e.dueDate && new Date(e.dueDate) > now);

  dueEntries.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return da - db;
  });

  upcomingEntries.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return da - db;
  });

  return (
    <div style={{ padding: '16px', minHeight: '300px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px'
      }}>
        <h1 style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
          Practice ({dueEntries.length + upcomingEntries.length})
        </h1>
        {showNewButton && (
          <button
            onClick={onSaveNew}
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px',
              padding: '4px 12px', fontSize: '12px', cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            + New
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div style={{
          textAlign: 'center', color: '#aaa', marginTop: '60px', fontSize: '13px'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
          No saved problems yet.<br />
          Open a LeetCode problem to rate it.
        </div>
      ) : (
        <>
          {dueEntries.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e53e3e', marginBottom: '6px' }}>
                Due Now
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dueEntries.map(entry => renderEntry(entry))}
              </div>
            </div>
          )}

          {upcomingEntries.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#888', marginBottom: '6px' }}>
                Upcoming
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {upcomingEntries.map(entry => renderEntry(entry))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  function renderEntry(entry: LeetCodeEntry) {
    const diffColor = DIFFICULTY_COLORS[entry.difficulty] || '#888';
    return (
      <div
        key={entry.id}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 10px', borderRadius: '6px',
          background: '#f5f6f8',
          borderLeft: `4px solid ${diffColor}`,
          fontSize: '13px',
        }}
      >
        <a
          href={entry.url}
          target="_blank"
          title={entry.title}
          style={{
            flex: 1, color: '#1a1a1a', textDecoration: 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {entry.title}
        </a>
        <span style={{ fontSize: '15px', lineHeight: 1 }} title={entry.difficulty}>
          {RATING_EMOJI[entry.rating]}
        </span>
        <span style={{ fontSize: '11px', color: '#999', whiteSpace: 'nowrap' }}>
          {formatDueDate(entry.dueDate)}
        </span>
        <button
          onClick={() => setReviewingId(entry.id)}
          title="Review"
          style={{
            background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px',
            padding: '2px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 500,
          }}
        >
          {RATING_EMOJI[entry.rating]}
        </button>
        <button
          onClick={() => handleDelete(entry.id)}
          title="Delete"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#ccc',
            fontSize: '14px', padding: '0 2px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    );
  }
}