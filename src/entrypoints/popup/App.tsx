import { useState, useEffect } from 'react';
import { colors, fontFamily, button } from '../../styles';

export default function App() {
  const [tabChecked, setTabChecked] = useState(false);
  const [onLeetCode, setOnLeetCode] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      const isProblem = !!tab?.url?.match(/leetcode\.com\/problems\/[^/?#]+/);
      setOnLeetCode(isProblem);
      setTabChecked(true);

      if (isProblem && tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_WIDGET' }).catch(() => {});
        window.close();
      }
    });
  }, []);

  if (!tabChecked) {
    return (
      <div style={{ width: 320, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily, fontSize: 14, color: colors.textSecondary, background: colors.bg }}>
        Loading...
      </div>
    );
  }

  if (onLeetCode) return null;

  return (
    <div style={{ width: 320, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32, fontFamily, fontSize: 14, color: colors.text, background: colors.bg, textAlign: 'center' }}>
      <span style={{ fontSize: 40 }}>📝</span>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Not on LeetCode</div>
      <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Open a LeetCode problem to start reviewing with spaced repetition.
      </div>
      <a
        href="https://leetcode.com/problemset"
        target="_blank"
        style={{ ...button('primary'), textDecoration: 'none', display: 'inline-block', marginTop: 8 }}
      >
        Go to LeetCode
      </a>
    </div>
  );
}
