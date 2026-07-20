import { useState, useEffect, useRef } from 'react';
import type { ProblemData } from '../types';
import SavePanel from './SavePanel';
import PracticeList from './PracticeList';
import AuthPanel from './AuthPanel';
import ProfilePanel from './ProfilePanel';
import SyncStatus from './SyncStatus';
import { getAuthState } from '../lib/supabase';
import { autoSync } from '../lib/sync';
import { colors, fontFamily } from '../styles';
import { extractTitle, extractUrl, tryExtractDifficulty, extractProblemData, waitForProblemData } from '../lib/leetcode';

type View = 'loading' | 'save' | 'browse' | 'minimized' | 'profile';

const T = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

export default function WidgetApp({ defaultMinimized }: { defaultMinimized?: boolean }) {
  const [view, setView] = useState<View>(defaultMinimized ? 'minimized' : 'loading');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const loadedUrlRef = useRef('');
  const viewRef = useRef(view);
  viewRef.current = view;
  const problemRef = useRef(problem);
  problemRef.current = problem;

  useEffect(() => {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView('minimized');
    };
    window.addEventListener('keydown', escHandler);
    return () => window.removeEventListener('keydown', escHandler);
  }, []);

  useEffect(() => {
    const handler = (msg: any) => {
      if (msg.type === 'TOGGLE_WIDGET') {
        if (viewRef.current === 'minimized') {
          setView(problemRef.current ? 'save' : 'browse');
        }
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    function onNavigate() {
      if (viewRef.current === 'minimized') return;
      loadedUrlRef.current = '';
      extractProblemData().then(data => {
        if (data) {
          loadedUrlRef.current = window.location.href;
          setProblem(data);
          if (!defaultMinimized) setView('save');
        }
      });
    }

    const origPushState = history.pushState.bind(history) as (data: any, title: string, url?: string | null) => void;
    const origReplaceState = history.replaceState.bind(history) as (data: any, title: string, url?: string | null) => void;

    history.pushState = (data: any, title: string, url?: string | null) => {
      origPushState(data, title, url);
      onNavigate();
    };
    history.replaceState = (data: any, title: string, url?: string | null) => {
      origReplaceState(data, title, url);
      onNavigate();
    };

    window.addEventListener('popstate', onNavigate);

    return () => {
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      window.removeEventListener('popstate', onNavigate);
    };
  }, [defaultMinimized]);

  useEffect(() => {
    getAuthState().then(s => {
      setAuthenticated(s.isAuthenticated);
      if (s.isAuthenticated) {
        autoSync().then(() => setSyncKey(k => k + 1)).catch(() => {});
      }
    }).catch(() => {});
    if (defaultMinimized) return;
    waitForProblemData().then(data => {
      if (data) { setProblem(data); setView('save'); return; }
      setView('browse');
    }).catch(() => setView('browse'));
  }, [defaultMinimized]);

  useEffect(() => {
    const poll = setInterval(() => {
      const url = window.location.href;
      if (url === loadedUrlRef.current) return;
      extractProblemData().then(data => {
        if (data) {
          loadedUrlRef.current = window.location.href;
          setProblem(data);
          if (!defaultMinimized) setView('save');
        }
      });
    }, 2000);
    return () => clearInterval(poll);
  }, [defaultMinimized]);

  const handleRefresh = () => {
    extractProblemData().then(data => {
      if (data) { setProblem(data); setView('save'); }
    });
  };

  const detectProblem = () => {
    const title = extractTitle();
    const url = extractUrl();
    if (!title || !url) return;
    setProblem({ title, url, difficulty: tryExtractDifficulty() ?? 'medium' });
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

  function handleShowProfile() {
    setView('profile');
  }

  if (view === 'profile') {
    return (
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 2147483647, background: colors.bg, borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ width: 300, height: 480, display: 'flex', flexDirection: 'column', fontFamily, fontSize: 14, color: colors.text }}>
          <ProfilePanel
            onBack={() => setView('browse')}
            onAuthChange={handleAuthChange}
            onEntriesChanged={() => setSyncKey(k => k + 1)}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 2147483647 }}>
      <div style={{
        width: isMinimized ? 0 : 300, height: isMinimized ? 0 : 480,
        borderRadius: 14, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: isMinimized ? 'transparent' : 'rgba(255,255,255,0.85)',
        backdropFilter: isMinimized ? 'none' : 'blur(20px)',
        WebkitBackdropFilter: isMinimized ? 'none' : 'blur(20px)',
        boxShadow: isMinimized ? 'none' : '0 8px 40px rgba(0,0,0,0.18)',
        fontFamily, fontSize: 14, color: colors.text,
        transition: T, opacity: isMinimized ? 0 : 1,
        pointerEvents: isMinimized ? 'none' : 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', borderBottom: `1px solid ${colors.separator}`,
          position: 'sticky', top: 0, zIndex: 1,
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: colors.textSecondary }}>LC FSRS</span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={handleRefresh} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary,
                fontSize: 16, padding: '0 4px', lineHeight: 1, fontFamily,
              }} title="Refresh">↻</button>
              <button onClick={() => setView('minimized')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary,
                fontSize: 18, padding: '0 4px', lineHeight: 1, fontFamily,
              }} title="Minimize">⌄</button>
            </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {view === 'loading' ? (
            <div style={{ padding: '24px', textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>Loading...</div>
          ) : view === 'save' && problem ? (
            <SavePanel key={problem.url} problem={problem} onSaved={() => setView('browse')} onBrowse={() => setView('browse')} />
          ) : (
            <PracticeList onSaveNew={detectProblem} showNewButton isAuthenticated={authenticated} syncKey={syncKey} />
          )}
        </div>
        <div>
          <SyncStatus isAuthenticated={authenticated} />
          <AuthPanel onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} onShowProfile={handleShowProfile} />
        </div>
      </div>

      <div
        onClick={handleBadgeClick}
        style={{
          position: 'absolute', bottom: 0, right: 0, zIndex: 1,
          width: 40, height: 40, borderRadius: '50%',
          background: colors.accent, color: colors.bg, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
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
