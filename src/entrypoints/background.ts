import { defineBackground } from 'wxt/utils/define-background';
import { supabase } from '../lib/supabase';
import { syncAll } from '../lib/sync';

export default defineBackground({
  main() {
    supabase.auth.getSession();

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'AUTH_SIGNUP':
          supabase.auth
            .signUp({ email: message.payload.email, password: message.payload.password })
            .then(({ data, error }) => {
              if (error) sendResponse({ error: error.message });
              else sendResponse({ session: data.session, user: data.user });
            });
          return true;

        case 'AUTH_LOGIN':
          supabase.auth
            .signInWithPassword({ email: message.payload.email, password: message.payload.password })
            .then(({ data, error }) => {
              if (error) sendResponse({ error: error.message });
              else sendResponse({ session: data.session, user: data.user });
            });
          return true;

        case 'AUTH_LOGOUT':
          supabase.auth.signOut().then(() => sendResponse({ ok: true }));
          return true;

        case 'AUTH_GET_SESSION':
          supabase.auth.getSession().then(({ data }) => {
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

    setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        try {
          await syncAll();
        } catch {
          // silent background sync failure
        }
      }
    }, 30 * 60 * 1000);
  },
});
