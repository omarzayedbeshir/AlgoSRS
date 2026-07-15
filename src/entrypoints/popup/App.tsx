import React, { useState, useEffect } from 'react';
import type { ProblemData } from '../../types';
import SavePanel from '../../components/SavePanel';
import SavedList from '../../components/SavedList';

type View = 'loading' | 'save' | 'browse';

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [onLeetCode, setOnLeetCode] = useState(false);

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

  if (view === 'loading') {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>Loading...</div>;
  }

  if (view === 'save' && problem) {
    return (
      <SavePanel
        problem={problem}
        onSaved={() => setView('browse')}
        onBrowse={() => setView('browse')}
      />
    );
  }

  return <SavedList onSaveNew={detectProblem} showNewButton={onLeetCode} />;
}
