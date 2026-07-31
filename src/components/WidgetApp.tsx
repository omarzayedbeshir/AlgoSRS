import { useState, useEffect, useRef } from 'react';
import type { ProblemData } from '../types';
import SavePanel from './SavePanel';
import PracticeList from './PracticeList';
import AuthPanel from './AuthPanel';
import ProfilePanel from './ProfilePanel';
import StatsPanel from './StatsPanel';
import SettingsPanel from './SettingsPanel';
import ReviewSession from './ReviewSession';
import { getAuthState } from '../lib/supabase';
import { autoSync } from '../lib/sync';
import { getReviewSessionState, isActiveReviewSession } from '../storage';
import { fontFamily } from '../styles';
import { ThemeProvider, useTheme } from './ThemeContext';
import {
  extractTitle,
  extractUrl,
  tryExtractDifficulty,
  extractProblemData,
  waitForProblemData,
} from '../lib/leetcode';

type View =
  'loading' | 'save' | 'browse' | 'minimized' | 'profile' | 'stats' | 'settings' | 'review';

const T = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';

function WidgetAppInner({ defaultMinimized }: { defaultMinimized?: boolean }) {
  const { colors, isDark } = useTheme();
  const [view, setView] = useState<View>(defaultMinimized ? 'minimized' : 'loading');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [syncKey, setSyncKey] = useState(0);
  const loadedUrlRef = useRef('');
  const viewRef = useRef(view);
  const problemRef = useRef(problem);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    problemRef.current = problem;
  }, [problem]);

  useEffect(() => {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewRef.current !== 'review') setView('minimized');
    };
    window.addEventListener('keydown', escHandler);
    return () => window.removeEventListener('keydown', escHandler);
  }, []);

  useEffect(() => {
    const handler = (msg: { type: string }) => {
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
      extractProblemData().then((data) => {
        if (data) {
          loadedUrlRef.current = window.location.href;
          if (data.url === problemRef.current?.url) return;
          setProblem(data);
          if (viewRef.current !== 'review' && !defaultMinimized) setView('save');
        }
      });
    }

    const { pushState, replaceState } = history;

    history.pushState = (data: unknown, title: string, url?: string | null) => {
      pushState.call(history, data, title, url);
      onNavigate();
    };
    history.replaceState = (data: unknown, title: string, url?: string | null) => {
      replaceState.call(history, data, title, url);
      onNavigate();
    };

    window.addEventListener('popstate', onNavigate);

    return () => {
      history.pushState = pushState.bind(history);
      history.replaceState = replaceState.bind(history);
      window.removeEventListener('popstate', onNavigate);
    };
  }, [defaultMinimized]);

  useEffect(() => {
    getAuthState()
      .then((s) => {
        setAuthenticated(s.isAuthenticated);
        if (s.isAuthenticated) {
          autoSync()
            .then(() => setSyncKey((k) => k + 1))
            .catch(() => {});
        }
      })
      .catch(() => {});
    const resumeOrDetect = async () => {
      const session = await getReviewSessionState();
      if (isActiveReviewSession(session)) {
        setView('review');
        return;
      }
      if (defaultMinimized) return;
      const data = await waitForProblemData();
      if (data) {
        setProblem(data);
        setView('save');
        return;
      }
      setView('browse');
    };
    resumeOrDetect().catch(() => {
      if (!defaultMinimized) setView('browse');
    });
  }, [defaultMinimized]);

  useEffect(() => {
    const poll = setInterval(() => {
      const url = window.location.href;
      if (url === loadedUrlRef.current) return;
      extractProblemData().then((data) => {
        if (data) {
          loadedUrlRef.current = window.location.href;
          if (data.url === problemRef.current?.url) return;
          setProblem(data);
          if (viewRef.current !== 'review' && !defaultMinimized) setView('save');
        }
      });
    }, 2000);
    return () => clearInterval(poll);
  }, [defaultMinimized]);

  const handleRefresh = () => {
    extractProblemData().then((data) => {
      if (data) {
        setProblem(data);
        setView('save');
      }
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
    getAuthState().then((s) => setAuthenticated(s.isAuthenticated));
  }

  function handleShowProfile() {
    setView('profile');
  }

  function handleShowStats() {
    setView('stats');
  }

  function handleShowSettings() {
    setView('settings');
  }

  if (view === 'review') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 2147483647,
          background: colors.bg,
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 300,
            height: 480,
            display: 'flex',
            flexDirection: 'column',
            fontFamily,
            fontSize: 14,
            color: colors.text,
          }}
        >
          <ReviewSession
            onExit={() => setView('browse')}
            onEntriesChanged={() => setSyncKey((k) => k + 1)}
          />
        </div>
      </div>
    );
  }

  if (view === 'profile') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 2147483647,
          background: colors.bg,
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 300,
            height: 480,
            display: 'flex',
            flexDirection: 'column',
            fontFamily,
            fontSize: 14,
            color: colors.text,
          }}
        >
          <ProfilePanel
            onBack={() => setView('browse')}
            onShowStats={handleShowStats}
            onShowSettings={handleShowSettings}
          />
        </div>
      </div>
    );
  }

  if (view === 'stats') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 2147483647,
          background: colors.bg,
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 300,
            height: 480,
            display: 'flex',
            flexDirection: 'column',
            fontFamily,
            fontSize: 14,
            color: colors.text,
          }}
        >
          <StatsPanel onBack={() => setView('profile')} />
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 2147483647,
          background: colors.bg,
          borderRadius: 14,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 300,
            height: 480,
            display: 'flex',
            flexDirection: 'column',
            fontFamily,
            fontSize: 14,
            color: colors.text,
          }}
        >
          <SettingsPanel
            onBack={() => setView('profile')}
            onAuthChange={handleAuthChange}
            onEntriesChanged={() => setSyncKey((k) => k + 1)}
            isAuthenticated={authenticated}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes radiate{0%{box-shadow:0 0 0 0 rgba(52,199,89,0.4)}70%{box-shadow:0 0 0 6px rgba(52,199,89,0)}100%{box-shadow:0 0 0 0 rgba(52,199,89,0)}}`}</style>
      <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 2147483647 }}>
        <div
          style={{
            width: isMinimized ? 0 : 300,
            height: isMinimized ? 0 : 480,
            borderRadius: 14,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: isMinimized
              ? 'transparent'
              : isDark
                ? 'rgba(28,28,30,0.85)'
                : 'rgba(255,255,255,0.85)',
            backdropFilter: isMinimized ? 'none' : 'blur(20px)',
            WebkitBackdropFilter: isMinimized ? 'none' : 'blur(20px)',
            boxShadow: isMinimized ? 'none' : '0 8px 40px rgba(0,0,0,0.18)',
            fontFamily,
            fontSize: 14,
            color: colors.text,
            transition: T,
            opacity: isMinimized ? 0 : 1,
            pointerEvents: isMinimized ? 'none' : 'auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: `1px solid ${colors.separator}`,
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: isDark ? 'rgba(28,28,30,0.8)' : 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {authenticated && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: colors.green,
                    display: 'inline-block',
                    animation: 'radiate 2s infinite',
                  }}
                />
              )}
              AlgoSRS
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={handleRefresh}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textSecondary,
                  fontSize: 16,
                  padding: '0 4px',
                  lineHeight: 1,
                  fontFamily,
                }}
                title="Refresh"
              >
                ↻
              </button>
              <button
                onClick={() => setView('minimized')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textSecondary,
                  fontSize: 11,
                  padding: '0 4px',
                  lineHeight: 1,
                  fontFamily,
                  fontWeight: 600,
                }}
                title="Minimize (Esc)"
              >
                esc
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {view === 'loading' ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: colors.textSecondary,
                  fontSize: 13,
                }}
              >
                Loading...
              </div>
            ) : view === 'save' && problem ? (
              <SavePanel
                key={problem.url}
                problem={problem}
                onSaved={() => setView('browse')}
                onBrowse={() => setView('browse')}
              />
            ) : (
              <PracticeList
                onSaveNew={detectProblem}
                showNewButton
                isAuthenticated={authenticated}
                syncKey={syncKey}
                onStartReview={() => setView('review')}
              />
            )}
          </div>
          <div>
            <AuthPanel
              onAuthChange={handleAuthChange}
              onEntriesChanged={() => setSyncKey((k) => k + 1)}
              onShowProfile={handleShowProfile}
            />
          </div>
        </div>

        <div
          onClick={handleBadgeClick}
          title="Open AlgoSRS"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            zIndex: 1,
            width: 36,
            height: 36,
            cursor: 'pointer',
            userSelect: 'none',
            transition: T,
            opacity: isMinimized ? 1 : 0,
            transform: isMinimized ? 'scale(1)' : 'scale(0.3)',
            pointerEvents: isMinimized ? 'auto' : 'none',
          }}
        >
          <svg viewBox="0 0 33.866666 33.866666" width={36} height={36}>
            <rect x="0" y="0" width="33.866665" height="33.866665" rx="8.5" fill="#ff6600" />
            <circle cx="16.933332" cy="10.054165" r="4.2333331" fill="#fff" />
            <circle cx="8.4666662" cy="22.754168" r="4.2333331" fill="#fff" />
            <circle cx="25.4" cy="22.754168" r="4.2333331" fill="#fff" />
            <rect
              x="17.859829"
              y="1.2861266"
              width="2.4478021"
              height="13.229167"
              fill="#fff"
              transform="rotate(30)"
              rx="0"
            />
            <rect
              x="-11.462175"
              y="18.21521"
              width="2.4478021"
              height="13.229167"
              fill="#fff"
              rx="0"
              transform="matrix(-0.8660254,0.5,0.5,0.8660254,0,0)"
            />
          </svg>
        </div>
      </div>
    </>
  );
}

export default function WidgetApp(props: { defaultMinimized?: boolean }) {
  return (
    <ThemeProvider>
      <WidgetAppInner {...props} />
    </ThemeProvider>
  );
}
