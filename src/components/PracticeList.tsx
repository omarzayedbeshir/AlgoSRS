import React, { useState, useEffect } from 'react';
import type { LeetCodeEntry, Rating } from '../types';
import { getAll, remove } from '../storage';
import { api } from '../lib/api-client';
import { colors, fontFamily, difficultyDot, sectionHeader, emptyState } from '../styles';

const RATING_EMOJI: Record<Rating, string> = {
  1: '😰', 2: '😅', 3: '🙂', 4: '😎',
};

interface Props {
  onSaveNew: () => void;
  showNewButton?: boolean;
  isAuthenticated?: boolean;
  syncKey?: number;
}

export default function PracticeList({ onSaveNew, showNewButton, isAuthenticated, syncKey }: Props) {
  const [entries, setEntries] = useState<LeetCodeEntry[]>([]);

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
    if (!dateStr) return 'Now';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = (d.getTime() - now.getTime()) / 86400000;
    if (diffDays < 0) {
      if (diffDays > -1) return 'Today';
      return `${Math.ceil(Math.abs(diffDays))}d`;
    }
    if (diffDays < 1) return 'Today';
    if (diffDays < 2) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const totalCount = dueEntries.length + upcomingEntries.length;

  return (
    <div style={{ fontFamily, paddingBottom: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 16px 8px',
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Practice</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>{totalCount}</span>
          {showNewButton && (
            <button
              onClick={onSaveNew}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: colors.accent, color: colors.bg, fontSize: 18, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily, fontWeight: 400,
              }}
            >
              +
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={emptyState}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          No saved problems yet.<br />
          Open a LeetCode problem to rate it.
        </div>
      ) : (
        <>
          {dueEntries.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <div style={sectionHeader}>Due Now</div>
              <div style={{ background: colors.bg }}>
                {dueEntries.map((entry, i) => renderEntry(entry, i === 0, i === dueEntries.length - 1))}
              </div>
            </div>
          )}

          {upcomingEntries.length > 0 && (
            <div>
              <div style={sectionHeader}>Upcoming</div>
              <div style={{ background: colors.bg }}>
                {upcomingEntries.map((entry, i) => renderEntry(entry, i === 0, i === upcomingEntries.length - 1))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  function renderEntry(entry: LeetCodeEntry, first: boolean, last: boolean) {
    return (
      <a
        key={entry.id}
        href={entry.url}
        target="_blank"
        style={{
          display: 'block', textDecoration: 'none', color: 'inherit',
          borderTopLeftRadius: first ? 10 : 0,
          borderTopRightRadius: first ? 10 : 0,
          borderBottomLeftRadius: last ? 10 : 0,
          borderBottomRightRadius: last ? 10 : 0,
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', background: colors.bg, fontSize: 14,
          borderBottom: last ? 'none' : `1px solid ${colors.separator}`,
        }}>
          <span style={difficultyDot(entry.difficulty)} />
          <span style={{ flex: 1, fontWeight: 400, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.title}
          </span>
          <span style={{ fontSize: 14, lineHeight: 1 }}>{RATING_EMOJI[entry.rating]}</span>
          <span style={{ fontSize: 12, color: colors.textSecondary, whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}>
            {formatDueDate(entry.dueDate)}
          </span>
          <button
            onClick={e => { e.preventDefault(); handleDelete(entry.id); }}
            style={{
              background: 'none', border: 'none', color: colors.textTertiary,
              fontSize: 14, padding: 0, lineHeight: 1, fontFamily,
            }}
          >
            ✕
          </button>
        </div>
      </a>
    );
  }
}
