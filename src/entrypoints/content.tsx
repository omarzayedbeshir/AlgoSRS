import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createRoot } from 'react-dom/client';
import WidgetApp from '../components/WidgetApp';
import type { ProblemData, Difficulty } from '../types';

export default defineContentScript({
  matches: ['*://leetcode.com/*'],
  main(ctx) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PROBLEM_DATA') {
        waitForProblemData().then(sendResponse);
        return true;
      }
    });

    const isProblemPage = !!window.location.href.match(/leetcode\.com\/problems\/[^/?#]+/);

    createShadowRootUi(ctx, {
      name: 'lc-fsrs',
      position: 'overlay',
      alignment: 'bottom-right',
      zIndex: 2147483647,
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<WidgetApp defaultMinimized={!isProblemPage} />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    }).then(ui => {
      ui.mount();
    });
  },
});

async function waitForProblemData(): Promise<ProblemData | null> {
  for (let i = 0; i < 30; i++) {
    const data = extractProblemData();
    if (data) return data;
    await new Promise(r => setTimeout(r, 200));
  }
  return null;
}

function extractProblemData(): ProblemData | null {
  const title = extractTitle();
  const url = extractUrl();
  const difficulty = extractDifficulty();
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

function extractDifficulty(): Difficulty {
  const diffMatch = document.documentElement.innerHTML.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/);
  if (diffMatch) {
    return diffMatch[1].toLowerCase() as Difficulty;
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text === 'Easy') return 'easy';
    if (text === 'Medium') return 'medium';
    if (text === 'Hard') return 'hard';
  }
  return 'medium';
}
