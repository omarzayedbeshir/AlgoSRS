import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { createRoot } from 'react-dom/client';
import WidgetApp from '../components/WidgetApp';
import { waitForProblemData } from '../lib/leetcode';

export default defineContentScript({
  matches: ['*://leetcode.com/*'],
  main(ctx) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'GET_PROBLEM_DATA') {
        waitForProblemData()
          .then(sendResponse)
          .catch(() => sendResponse(null));
        return true;
      }
    });

    const isProblemPage = !!window.location.href.match(/leetcode\.com\/problems\/[^/?#]+/);

    createShadowRootUi(ctx, {
      name: 'algo-srs',
      position: 'overlay',
      alignment: 'bottom-right',
      zIndex: 2147483647,
      onMount: (container) => {
        const style = document.createElement('style');
        style.textContent = `
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(60,60,67,0.18); border-radius: 3px; }
        `;
        container.prepend(style);
        const root = createRoot(container);
        root.render(<WidgetApp defaultMinimized={!isProblemPage} />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    }).then((ui) => {
      ui.mount();
    });
  },
});
