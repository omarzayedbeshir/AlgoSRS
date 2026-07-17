package handler

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	"lc-fsrs-backend/db"
	"lc-fsrs-backend/middleware"
	"lc-fsrs-backend/models"
)

const cols = "id, user_id, title, url, difficulty, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at"

func sanitizeEntry(e *models.Entry) {
	if e.Date == "" {
		e.Date = time.Now().UTC().Format(time.RFC3339)
	}
	if e.DueDate == nil || *e.DueDate == "" {
		now := time.Now().UTC().Format(time.RFC3339)
		e.DueDate = &now
	}
	if e.LastReviewAt == nil || *e.LastReviewAt == "" {
		now := time.Now().UTC().Format(time.RFC3339)
		e.LastReviewAt = &now
	}
}

func scanEntry(e *models.Entry, rows interface{ Scan(...interface{}) error }) error {
	return rows.Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Rating, &e.Date,
		&e.UpdatedAt, &e.Stability, &e.DifficultyFsrs, &e.DueDate, &e.Reps, &e.Lapses, &e.FSRSState, &e.LastReviewAt)
}

type callbackPageData struct {
	SupabaseURL string
	AnonKey     string
}

func AuthCallback(w http.ResponseWriter, r *http.Request) {
	data := callbackPageData{
		SupabaseURL: os.Getenv("SUPABASE_URL"),
		AnonKey:     os.Getenv("SUPABASE_ANON_KEY"),
	}

	tmpl := template.Must(template.New("callback").Parse(callbackHTML))
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.Execute(w, data)
}

const callbackHTML = `<!DOCTYPE html>
<html>
<head>
  <title>LC FSRS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f6f8">
<div id="container" style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1);max-width:400px;width:90%">
  <div id="icon" style="font-size:48px;margin-bottom:16px">✅</div>
  <h1 id="title" style="font-size:20px;color:#1a1a1a;margin:0 0 8px">Email verified!</h1>
  <p id="subtitle" style="font-size:14px;color:#666;margin:0;line-height:1.5">You can close this tab and go back to the extension.</p>
  <div id="reset-form" style="display:none;text-align:left">
    <p style="font-size:14px;color:#666;margin:0 0 16px;line-height:1.5">Enter your new password below.</p>
    <div id="message"></div>
    <form id="form" style="display:flex;flex-direction:column;gap:12px">
      <input type="password" id="password" placeholder="New password" minlength="6" required
        style="padding:10px 12px;border-radius:8px;border:1px solid #d0d0d0;font-size:14px;outline:none;box-sizing:border-box;width:100%" />
      <input type="password" id="confirm" placeholder="Confirm password" minlength="6" required
        style="padding:10px 12px;border-radius:8px;border:1px solid #d0d0d0;font-size:14px;outline:none;box-sizing:border-box;width:100%" />
      <button type="submit"
        style="padding:10px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:14px;font-weight:500;cursor:pointer;width:100%">
        Reset password
      </button>
    </form>
    <div id="reset-success" style="display:none;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">✅</div>
      <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 8px">Password updated!</h1>
      <p style="font-size:14px;color:#666;margin:0;line-height:1.5">Your password has been reset successfully. You can close this tab and sign in to the extension with your new password.</p>
    </div>
  </div>
  <div id="error-view" style="display:none;text-align:center">
    <div style="font-size:48px;margin-bottom:16px">❌</div>
    <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 8px">Invalid link</h1>
    <p id="error-text" style="font-size:14px;color:#666;margin:0;line-height:1.5">This reset link is invalid or expired. Please request a new one from the extension.</p>
  </div>
</div>
<script>
(function() {
  var SUPABASE_URL = '{{.SupabaseURL}}';
  var ANON_KEY = '{{.AnonKey}}';

  var hash = window.location.hash.substring(1);
  var hashParams = new URLSearchParams(hash);
  var accessToken = hashParams.get('access_token');
  var type = hashParams.get('type');

  var icon = document.getElementById('icon');
  var title = document.getElementById('title');
  var subtitle = document.getElementById('subtitle');
  var resetForm = document.getElementById('reset-form');
  var errorView = document.getElementById('error-view');
  var errorText = document.getElementById('error-text');
  var form = document.getElementById('form');
  var message = document.getElementById('message');
  var resetSuccess = document.getElementById('reset-success');

  if (type === 'recovery' && accessToken) {
    icon.textContent = '🔐';
    title.textContent = 'Set new password';
    subtitle.style.display = 'none';
    resetForm.style.display = 'block';

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      var password = document.getElementById('password').value;
      var confirm = document.getElementById('confirm').value;

      if (password !== confirm) {
        message.innerHTML = '<div style="color:#ef4444;font-size:13px;margin-bottom:8px">Passwords do not match.</div>';
        return;
      }

      if (password.length < 6) {
        message.innerHTML = '<div style="color:#ef4444;font-size:13px;margin-bottom:8px">Password must be at least 6 characters.</div>';
        return;
      }

      message.innerHTML = '<div style="color:#666;font-size:13px;margin-bottom:8px">Updating password...</div>';

      try {
        var res = await fetch(SUPABASE_URL + '/auth/v1/user', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify({ password: password })
        });

        if (!res.ok) {
          var text = await res.text().catch(function() { return ''; });
          throw new Error('Error ' + res.status + ': ' + text.slice(0, 300));
        }

        form.style.display = 'none';
        message.style.display = 'none';
        resetSuccess.style.display = 'block';
      } catch (err) {
        message.innerHTML = '<div style="color:#ef4444;font-size:13px;margin-bottom:8px">' + err.message + '</div>';
      }
    });
  } else if (type && !accessToken) {
    icon.textContent = '❌';
    title.textContent = 'Invalid link';
    errorView.style.display = 'block';
  }
})();
</script>
</body>
</html>`

func Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func ListEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.Pool.Query(r.Context(),
		`SELECT `+cols+` FROM leetcode_entries WHERE user_id = $1
		 ORDER BY updated_at DESC`, userID)
	if err != nil {
		log.Printf("list entries query: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		if err := scanEntry(&e, rows); err != nil {
			log.Printf("list entries scan: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		entries = append(entries, e)
	}

	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func UpsertEntry(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var e models.Entry
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}
	sanitizeEntry(&e)

	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at)
		 VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 = '' OR $7 IS NULL THEN NOW() ELSE $7::timestamptz END, NOW(), $8, $9, CASE WHEN $10 = '' OR $10 IS NULL THEN NOW() ELSE $10::timestamptz END, $11, $12, $13, CASE WHEN $14 = '' OR $14 IS NULL THEN NOW() ELSE $14::timestamptz END)
		 ON CONFLICT (user_id, url) DO UPDATE SET
		     title = EXCLUDED.title,
		     difficulty = EXCLUDED.difficulty,
		     rating = EXCLUDED.rating,
		     date = EXCLUDED.date,
		     stability = EXCLUDED.stability,
		     difficulty_fsrs = EXCLUDED.difficulty_fsrs,
		     due_date = EXCLUDED.due_date,
		     reps = EXCLUDED.reps,
		     lapses = EXCLUDED.lapses,
		     fsrs_state = EXCLUDED.fsrs_state,
		     last_review_at = EXCLUDED.last_review_at,
		     updated_at = NOW()
		 RETURNING `+cols,
		e.ID, userID, e.Title, e.URL, e.Difficulty, e.Rating, e.Date,
		e.Stability, e.DifficultyFsrs, e.DueDate, e.Reps, e.Lapses, e.FSRSState, e.LastReviewAt).
		Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Rating, &e.Date,
			&e.UpdatedAt, &e.Stability, &e.DifficultyFsrs, &e.DueDate, &e.Reps, &e.Lapses, &e.FSRSState, &e.LastReviewAt)
	if err != nil {
		log.Printf("upsert entry: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, e)
}

func DeleteEntry(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing id"})
		return
	}

	_, err := db.Pool.Exec(r.Context(),
		`DELETE FROM leetcode_entries WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		log.Printf("delete entry: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func DeleteAllEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	_, err := db.Pool.Exec(r.Context(),
		`DELETE FROM leetcode_entries WHERE user_id = $1`, userID)
	if err != nil {
		log.Printf("delete all entries: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func SyncEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	for i := range req.Entries {
		sanitizeEntry(&req.Entries[i])
		_, err := db.Pool.Exec(r.Context(),
			`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at)
			 VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 = '' OR $7 IS NULL THEN NOW() ELSE $7::timestamptz END, NOW(), $8, $9, CASE WHEN $10 = '' OR $10 IS NULL THEN NOW() ELSE $10::timestamptz END, $11, $12, $13, CASE WHEN $14 = '' OR $14 IS NULL THEN NOW() ELSE $14::timestamptz END)
			 ON CONFLICT (user_id, url) DO UPDATE SET
			     title = EXCLUDED.title,
			     difficulty = EXCLUDED.difficulty,
			     rating = EXCLUDED.rating,
			     date = EXCLUDED.date,
			     stability = EXCLUDED.stability,
			     difficulty_fsrs = EXCLUDED.difficulty_fsrs,
			     due_date = EXCLUDED.due_date,
			     reps = EXCLUDED.reps,
			     lapses = EXCLUDED.lapses,
			     fsrs_state = EXCLUDED.fsrs_state,
			     last_review_at = EXCLUDED.last_review_at,
			     updated_at = NOW()`,
			req.Entries[i].ID, userID, req.Entries[i].Title, req.Entries[i].URL, req.Entries[i].Difficulty, req.Entries[i].Rating, req.Entries[i].Date,
			req.Entries[i].Stability, req.Entries[i].DifficultyFsrs, req.Entries[i].DueDate, req.Entries[i].Reps, req.Entries[i].Lapses, req.Entries[i].FSRSState, req.Entries[i].LastReviewAt)
		if err != nil {
			log.Printf("sync upsert: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	for _, id := range req.DeletedIDs {
		_, err := db.Pool.Exec(r.Context(),
			`DELETE FROM leetcode_entries WHERE id = $1 AND user_id = $2`, id, userID)
		if err != nil {
			log.Printf("sync delete: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	rows, err := db.Pool.Query(r.Context(),
		`SELECT `+cols+` FROM leetcode_entries WHERE user_id = $1
		 ORDER BY updated_at DESC`, userID)
	if err != nil {
		log.Printf("sync query: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		if err := scanEntry(&e, rows); err != nil {
			log.Printf("sync scan: %v", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		entries = append(entries, e)
	}

	writeJSON(w, http.StatusOK, models.SyncResponse{Entries: entries})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}