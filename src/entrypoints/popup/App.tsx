import React, { useState, useEffect } from 'react';
import type { ProblemData } from '../../types';
import SavePanel from '../../components/SavePanel';
import PracticeList from '../../components/PracticeList';
import AuthPanel from '../../components/AuthPanel';
import SyncStatus from '../../components/SyncStatus';
import { getAuthState } from '../../lib/supabase';

type View = 'loading' | 'save' | 'browse';

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

  if (view === 'loading') {
    return (
      <div>
        <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>Loading...</div>
        <AuthPanel onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} />
      </div>
    );
  }

  if (view === 'save' && problem) {
    return (
      <div>
        <SavePanel
          problem={problem}
          onSaved={() => setView('browse')}
          onBrowse={() => setView('browse')}
        />
        <SyncStatus isAuthenticated={authenticated} />
        <AuthPanel onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} />
      </div>
    );
  }

  return (
    <div>
        <PracticeList onSaveNew={detectProblem} showNewButton={onLeetCode} isAuthenticated={authenticated} syncKey={syncKey} />
      <SyncStatus isAuthenticated={authenticated} />
      <AuthPanel onAuthChange={handleAuthChange} onEntriesChanged={() => setSyncKey(k => k + 1)} />
    </div>
  );
}
