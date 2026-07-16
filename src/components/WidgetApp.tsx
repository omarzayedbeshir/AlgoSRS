import React, { useState, useEffect, useRef } from 'react';
import type { ProblemData, Difficulty } from '../types';
import SavePanel from './SavePanel';
import PracticeList from './PracticeList';
import AuthPanel from './AuthPanel';
import SyncStatus from './SyncStatus';
import { getAuthState } from '../lib/supabase';
import { autoSync } from '../lib/sync';

type View = 'loading' | 'save' | 'browse' | 'minimized';

const T = 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

export default function WidgetApp() {
  const [view, setView] = useState<View>('loading');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const prevUrlRef = useRef('');

  useEffect(() => {
    getAuthState().then(s => {
      setAuthenticated(s.isAuthenticated);
      if (s.isAuthenticated) {
        autoSync().then(() => setSyncKey(k => k + 1));
      }
    });
    waitForProblemData().then(data => {
      if (data) { setProblem(data); setView('save'); return; }
      setView('browse');
    });
  }, []);

  useEffect(() => {
    const poll = setInterval(() => {
      extractProblemData().then(data => {
        const currentUrl = window.location.href;
        if (data && data.url !== prevUrlRef.current) {
          prevUrlRef.current = data.url;
          setProblem(data);
          setView('save');
        }
      });
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  const detectProblem = () => {
    const title = extractTitle();
    const url = extractUrl();
    if (!title || !url) return;
    setProblem({ title, url, difficulty: tryExtractDifficulty() });
    setView('save');
  };

  const isMinimized = view === 'minimized';
  const handleBadgeClick = () => {
    if (problem) setView('save');
    else setView('browse');
  };

  function handleAuthChange() {
    getAuthState().then(s => setAuthenticated(s.isAuthenticated));
  }

  return (
    <div style={{ margin: '16px', position: 'relative' }}>
      <div style={{
        width: '300px', maxHeight: '480px', borderRadius: '12px',
        background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px', color: '#1a1a1a', overflowY: 'auto',
        scrollbarWidth: 'thin', scrollbarColor: '#d0d0d0 transparent',
        transition: T,
        opacity: isMinimized ? 0 : 1,
        transform: isMinimized ? 'scale(0.85)' : 'scale(1)',
        transformOrigin: 'bottom right',
        pointerEvents: isMinimized ? 'none' : 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: '1px solid #eee',
          position: 'sticky', top: 0, zIndex: 1, background: '#fff',
        }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: '#555' }}>LC FSRS</span>
          <button onClick={() => setView('minimized')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#999',
            fontSize: '16px', padding: '0 4px', lineHeight: 1,
          }} title="Minimize">—</button>
        </div>
        {view === 'loading' ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>Loading...</div>
        ) : view === 'save' && problem ? (
          <SavePanel key={problem.url} problem={problem} onSaved={() => setView('browse')} />
        ) : (
          <PracticeList onSaveNew={detectProblem} showNewButton isAuthenticated={authenticated} syncKey={syncKey} />
        )}
        <div style={{ position: 'sticky', bottom: 0, background: '#fff', zIndex: 1 }}>
          <SyncStatus isAuthenticated={authenticated} />
          <AuthPanel onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} />
        </div>
      </div>

      <div
        onClick={handleBadgeClick}
        style={{
          position: 'absolute', bottom: '0', right: '0', zIndex: 1,
          width: '40px', height: '40px', borderRadius: '50%',
          background: '#2563eb', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          userSelect: 'none', transition: T,
          opacity: isMinimized ? 1 : 0,
          transform: isMinimized ? 'scale(1)' : 'scale(0.3)',
          pointerEvents: isMinimized ? 'auto' : 'none',
        }}
        title="Open LC FSRS"
      >
        ⭐
      </div>
    </div>
  );
}

async function waitForProblemData(): Promise<ProblemData | null> {
  for (let i = 0; i < 30; i++) {
    const data = await extractProblemData();
    if (data) return data;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

async function extractProblemData(): Promise<ProblemData | null> {
  const title = extractTitle();
  const url = extractUrl();
  if (!title || !url) return null;
  const difficulty = await extractDifficulty();
  if (!title || !url) return null;
  return { title, url, difficulty };
}

function extractTitle(): string | null {
  const og = document.querySelector('meta[property="og:title"]');
  if (og) {
    const c = og.getAttribute('content')?.replace(/ - LeetCode.*$/, '').trim();
    if (c) return c;
  }
  const titleEl = document.querySelector('[data-cy="question-title"]');
  if (titleEl?.textContent) return titleEl.textContent.trim();
  const t = document.title.replace(/ - LeetCode(?: - \w+)?$/, '').trim();
  if (t) return t;
  return null;
}

function extractUrl(): string | null {
  const match = window.location.href.match(/^https?:\/\/leetcode\.com\/problems\/[^/?#]+/);
  return match ? match[0] : null;
}

function tryExtractDifficulty(): Difficulty {
  const badge = document.querySelector('[data-difficulty]');
  if (badge) {
    const d = badge.getAttribute('data-difficulty')?.toLowerCase();
    if (d === 'easy' || d === 'medium' || d === 'hard') return d;
  }
  const diffEl = document.querySelector('.text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard, [class*="difficulty"]');
  if (diffEl?.textContent) {
    const t = diffEl.textContent.trim().toLowerCase();
    if (t === 'easy' || t === 'medium' || t === 'hard') return t;
  }
  const diffMatch = document.documentElement.innerHTML.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/);
  if (diffMatch) {
    return diffMatch[1].toLowerCase() as Difficulty;
  }
  return 'medium';
}

async function extractDifficulty(): Promise<Difficulty> {
  for (let i = 0; i < 10; i++) {
    const d = tryExtractDifficulty();
    if (d !== 'medium') return d;
    await new Promise(r => setTimeout(r, 200));
  }
  return tryExtractDifficulty();
}
