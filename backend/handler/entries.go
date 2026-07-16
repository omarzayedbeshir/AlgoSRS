package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"lc-fsrs-backend/db"
	"lc-fsrs-backend/middleware"
	"lc-fsrs-backend/models"
)

const cols = "id, user_id, title, url, difficulty, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at"

func scanEntry(e *models.Entry, rows interface{ Scan(...interface{}) error }) error {
	return rows.Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Rating, &e.Date,
		&e.UpdatedAt, &e.Stability, &e.DifficultyFsrs, &e.DueDate, &e.Reps, &e.Lapses, &e.FSRSState, &e.LastReviewAt)
}

const SuccessContent = `<!DOCTYPE html>
<html>
<head>
  <title>Verified</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f6f8">
<div style="text-align:center;padding:40px;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1)">
  <div style="font-size:48px;margin-bottom:16px">✅</div>
  <h1 style="font-size:20px;color:#1a1a1a;margin:0 0 8px">Email verified!</h1>
  <p style="font-size:14px;color:#666;margin:0">You can close this tab and go back to the extension.</p>
</div>
</body>
</html>`

func AuthCallback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(SuccessContent))
}

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

	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, $14)
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

func SyncEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return
	}

	for _, e := range req.Entries {
		_, err := db.Pool.Exec(r.Context(),
			`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, $14)
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
			e.ID, userID, e.Title, e.URL, e.Difficulty, e.Rating, e.Date,
			e.Stability, e.DifficultyFsrs, e.DueDate, e.Reps, e.Lapses, e.FSRSState, e.LastReviewAt)
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