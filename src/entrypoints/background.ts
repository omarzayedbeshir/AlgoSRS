import { defineBackground } from 'wxt/utils/define-background';
import { getSupabase } from '../lib/supabase';
import { syncAll } from '../lib/sync';

function maybeSync() {
  const s = getSupabase();
  if (!s) return;
  s.auth.getSession().then(({ data }) => {
    if (data.session) syncAll().catch(() => {});
  });
}

export default defineBackground({
  main() {
    let sb = getSupabase();

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      sb = getSupabase();
      switch (message.type) {
        case 'AUTH_SIGNUP':
          if (!sb) { sendResponse({ error: 'Supabase not configured' }); return; }
          sb.auth
            .signUp({ email: message.payload.email, password: message.payload.password })
            .then(({ data, error }) => {
              if (error) sendResponse({ error: error.message });
              else sendResponse({ session: data.session, user: data.user });
            });
          return true;

        case 'AUTH_LOGIN':
          if (!sb) { sendResponse({ error: 'Supabase not configured' }); return; }
          sb.auth
            .signInWithPassword({ email: message.payload.email, password: message.payload.password })
            .then(({ data, error }) => {
              if (error) sendResponse({ error: error.message });
              else sendResponse({ session: data.session, user: data.user });
            });
          return true;

        case 'AUTH_LOGOUT':
          sb?.auth.signOut().then(() => sendResponse({ ok: true }));
          return true;

        case 'AUTH_GET_SESSION':
          sb?.auth.getSession().then(({ data }) => {
            sendResponse({ session: data.session });
          });
          return true;

        case 'SYNC_NOW':
          syncAll()
            .then(() => sendResponse({ ok: true }))
            .catch(err => sendResponse({ error: err.message }));
          return true;
      }
    });

    setInterval(maybeSync, 30 * 60 * 1000);

    maybeSync();
  },
});
