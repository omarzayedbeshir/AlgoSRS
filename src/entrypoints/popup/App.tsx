import React, { useState, useEffect } from 'react';
import type { ProblemData } from '../../types';
import SavePanel from '../../components/SavePanel';
import PracticeList from '../../components/PracticeList';
import ProfilePanel from '../../components/ProfilePanel';
import AuthPanel from '../../components/AuthPanel';
import SyncStatus from '../../components/SyncStatus';
import { getAuthState } from '../../lib/supabase';
import { colors, fontFamily } from '../../styles';

type View = 'loading' | 'save' | 'browse' | 'profile';

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [onLeetCode, setOnLeetCode] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  useEffect(() => {
    getAuthState().then(s => setAuthenticated(s.isAuthenticated));
  }, []);

  useEffect(() => {
    detectProblem();
  }, []);

  async function detectProblem() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url) {
      setView('browse');
      return;
    }

    const match = tab.url.match(/leetcode\.com\/problems\/([^/?#]+)/);
    if (!match || ['list', 'tag', 'solution', ''].includes(match[1])) {
      setView('browse');
      return;
    }

    setOnLeetCode(true);

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PROBLEM_DATA' });
      if (response?.title) {
        setProblem(response);
        setView('save');
        return;
      }
    } catch {
      // content script not injected yet
    }

    setView('browse');
  }

  function handleAuthChange() {
    getAuthState().then(s => setAuthenticated(s.isAuthenticated));
  }

  function handleShowProfile() {
    setView('profile');
  }

  const authPanel = (
    <AuthPanel onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} onShowProfile={handleShowProfile} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 480, fontFamily, fontSize: 14, color: colors.text, background: colors.bg }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${colors.separator}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>LC FSRS</span>
        {authenticated && (
          <button onClick={handleShowProfile} style={{
            background: 'none', border: 'none', color: colors.accent, cursor: 'pointer',
            fontSize: 13, fontWeight: 500, fontFamily, padding: 0,
          }}>
            Profile
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {view === 'loading' && (
          <div>
            <div style={{ padding: '24px', textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>Loading...</div>
            {authPanel}
          </div>
        )}

        {view === 'save' && problem && (
          <div>
            <SavePanel problem={problem} onSaved={() => setView('browse')} onBrowse={() => setView('browse')} />
            <SyncStatus isAuthenticated={authenticated} />
            {authPanel}
          </div>
        )}

        {view === 'browse' && (
          <div>
            <PracticeList onSaveNew={detectProblem} showNewButton={onLeetCode} isAuthenticated={authenticated} syncKey={syncKey} />
            <SyncStatus isAuthenticated={authenticated} />
            {authPanel}
          </div>
        )}

        {view === 'profile' && (
          <ProfilePanel onBack={() => setView('browse')} onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} />
        )}
      </div>
    </div>
  );
}
