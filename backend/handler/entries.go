package handler

import (
	"encoding/json"
	"net/http"

	"lc-fsrs-backend/db"
	"lc-fsrs-backend/middleware"
	"lc-fsrs-backend/models"
)

func Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func ListEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, user_id, title, url, difficulty, rating, date, updated_at
		 FROM leetcode_entries WHERE user_id = $1
		 ORDER BY updated_at DESC`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Rating, &e.Date, &e.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scan failed"})
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
		`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, rating, date, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
		 ON CONFLICT (user_id, url) DO UPDATE SET
		     title = EXCLUDED.title,
		     difficulty = EXCLUDED.difficulty,
		     rating = EXCLUDED.rating,
		     date = EXCLUDED.date,
		     updated_at = NOW()
		 RETURNING id, user_id, title, url, difficulty, rating, date, updated_at`,
		e.ID, userID, e.Title, e.URL, e.Difficulty, e.Rating, e.Date).
		Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Rating, &e.Date, &e.UpdatedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "upsert failed"})
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
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "delete failed"})
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
			`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, rating, date, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
			 ON CONFLICT (user_id, url) DO UPDATE SET
			     title = EXCLUDED.title,
			     difficulty = EXCLUDED.difficulty,
			     rating = EXCLUDED.rating,
			     date = EXCLUDED.date,
			     updated_at = NOW()`,
			e.ID, userID, e.Title, e.URL, e.Difficulty, e.Rating, e.Date)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sync upsert failed"})
			return
		}
	}

	for _, id := range req.DeletedIDs {
		_, err := db.Pool.Exec(r.Context(),
			`DELETE FROM leetcode_entries WHERE id = $1 AND user_id = $2`, id, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "sync delete failed"})
			return
		}
	}

	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, user_id, title, url, difficulty, rating, date, updated_at
		 FROM leetcode_entries WHERE user_id = $1
		 ORDER BY updated_at DESC`, userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "query failed"})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Rating, &e.Date, &e.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scan failed"})
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
