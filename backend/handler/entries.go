package handler

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"

	"algosrs-backend/db"
	"algosrs-backend/middleware"
	"algosrs-backend/models"
)

const cols = "id, user_id, title, url, difficulty, tags, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at"

func sanitizeEntry(e *models.Entry) {
	if e.Date == "" {
		e.Date = time.Now().UTC().Format(time.RFC3339)
	}
	if e.Tags == nil {
		e.Tags = []string{}
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
	return rows.Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Tags, &e.Rating, &e.Date,
		&e.UpdatedAt, &e.Stability, &e.DifficultyFsrs, &e.DueDate, &e.Reps, &e.Lapses, &e.FSRSState, &e.LastReviewAt)
}

type callbackPageData struct {
	SupabaseURL string
	AnonKey     string
}

//go:embed callback.html
var callbackHTMLContent string

var callbackTmpl = template.Must(template.New("callback").Parse(callbackHTMLContent))

func AuthCallback(w http.ResponseWriter, r *http.Request) {
	data := callbackPageData{
		SupabaseURL: os.Getenv("SUPABASE_URL"),
		AnonKey:     os.Getenv("SUPABASE_ANON_KEY"),
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	callbackTmpl.Execute(w, data)
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
		slog.Error("list entries query failed", "user_id", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		if err := scanEntry(&e, rows); err != nil {
			slog.Error("list entries scan failed", "user_id", userID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}

	if errs := middleware.ValidateEntry(&e); len(errs) > 0 {
		middleware.WriteValidationError(w, errs)
		return
	}

	sanitizeEntry(&e)

	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, tags, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13, $14, $15)
		 ON CONFLICT (user_id, url) DO UPDATE SET
		     title = EXCLUDED.title,
		     difficulty = EXCLUDED.difficulty,
		     tags = EXCLUDED.tags,
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
		e.ID, userID, e.Title, e.URL, e.Difficulty, e.Tags, e.Rating, e.Date,
		e.Stability, e.DifficultyFsrs, e.DueDate, e.Reps, e.Lapses, e.FSRSState, e.LastReviewAt).
		Scan(&e.ID, &e.UserID, &e.Title, &e.URL, &e.Difficulty, &e.Tags, &e.Rating, &e.Date,
			&e.UpdatedAt, &e.Stability, &e.DifficultyFsrs, &e.DueDate, &e.Reps, &e.Lapses, &e.FSRSState, &e.LastReviewAt)
	if err != nil {
		slog.Error("upsert entry failed", "user_id", userID, "entry_id", e.ID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}

	writeJSON(w, http.StatusOK, e)
}

func DeleteEntry(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_id"})
		return
	}

	_, err := db.Pool.Exec(r.Context(),
		`DELETE FROM leetcode_entries WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		slog.Error("delete entry failed", "user_id", userID, "entry_id", id, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func RequestDeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	_, err := db.Pool.Exec(r.Context(),
		`INSERT INTO user_delete_requests (user_id, created_at) VALUES ($1, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET created_at = NOW()`, userID)
	if err != nil {
		slog.Error("delete request failed", "user_id", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "confirmation_required"})
}

func DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	if r.URL.Query().Get("confirm") != "true" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "confirmation_required"})
		return
	}

	var createdAt time.Time
	err := db.Pool.QueryRow(r.Context(),
		`SELECT created_at FROM user_delete_requests WHERE user_id = $1`, userID).Scan(&createdAt)
	if err != nil {
		slog.Error("delete request not found", "user_id", userID, "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no_delete_request"})
		return
	}

	if time.Since(createdAt) > deleteConfirmationTTL() {
		slog.Warn("delete request expired", "user_id", userID, "created_at", createdAt)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "delete_request_expired"})
		return
	}

	_, err = db.Pool.Exec(r.Context(),
		`DELETE FROM leetcode_entries WHERE user_id = $1`, userID)
	if err != nil {
		slog.Error("delete user entries failed", "user_id", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}

	_, _ = db.Pool.Exec(r.Context(),
		`DELETE FROM user_delete_requests WHERE user_id = $1`, userID)

	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if supabaseURL == "" || serviceRoleKey == "" {
		slog.Error("delete user not configured", "user_id", userID)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}

	adminReq, _ := http.NewRequestWithContext(r.Context(), "DELETE",
		supabaseURL+"/auth/v1/admin/users/"+userID, nil)
	adminReq.Header.Set("apikey", serviceRoleKey)
	adminReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	adminReq.Header.Set("Content-Type", "application/json")

	adminRes, err := http.DefaultClient.Do(adminReq)
	if err != nil {
		slog.Error("delete user admin request failed", "user_id", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}
	defer adminRes.Body.Close()

	body, _ := io.ReadAll(adminRes.Body)

	if adminRes.StatusCode < 200 || adminRes.StatusCode >= 300 {
		slog.Error("delete user admin rejected",
			"user_id", userID,
			"status", adminRes.StatusCode,
			"body", string(body),
		)
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error": fmt.Sprintf("delete_user_failed: supabase_admin_api returned %d", adminRes.StatusCode),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func DeleteAllEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	_, err := db.Pool.Exec(r.Context(),
		`DELETE FROM leetcode_entries WHERE user_id = $1`, userID)
	if err != nil {
		slog.Error("delete all entries failed", "user_id", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func SyncEntries(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req models.SyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}

	if errs := middleware.ValidateSyncRequest(&req); len(errs) > 0 {
		middleware.WriteValidationError(w, errs)
		return
	}

	batch := &pgx.Batch{}

	for i := range req.Entries {
		sanitizeEntry(&req.Entries[i])
		batch.Queue(
			`INSERT INTO leetcode_entries (id, user_id, title, url, difficulty, tags, rating, date, updated_at, stability, difficulty_fsrs, due_date, reps, lapses, fsrs_state, last_review_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13, $14, $15)
			 ON CONFLICT (user_id, url) DO UPDATE SET
			     title = EXCLUDED.title,
			     difficulty = EXCLUDED.difficulty,
			     tags = EXCLUDED.tags,
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
			req.Entries[i].ID, userID, req.Entries[i].Title, req.Entries[i].URL, req.Entries[i].Difficulty, req.Entries[i].Tags, req.Entries[i].Rating, req.Entries[i].Date,
			req.Entries[i].Stability, req.Entries[i].DifficultyFsrs, req.Entries[i].DueDate, req.Entries[i].Reps, req.Entries[i].Lapses, req.Entries[i].FSRSState, req.Entries[i].LastReviewAt)
	}

	for _, id := range req.DeletedIDs {
		batch.Queue(`DELETE FROM leetcode_entries WHERE id = $1 AND user_id = $2`, id, userID)
	}

	if batch.Len() > 0 {
		br := db.Pool.SendBatch(r.Context(), batch)
		if err := br.Close(); err != nil {
			slog.Error("sync batch failed", "user_id", userID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
			return
		}
	}

	var query string
	var queryArgs []any
	if req.LastSyncAt != nil && *req.LastSyncAt != "" {
		query = `SELECT ` + cols + ` FROM leetcode_entries WHERE user_id = $1 AND updated_at > $2 ORDER BY updated_at DESC`
		queryArgs = []any{userID, *req.LastSyncAt}
	} else {
		query = `SELECT ` + cols + ` FROM leetcode_entries WHERE user_id = $1 ORDER BY updated_at DESC`
		queryArgs = []any{userID}
	}

	rows, err := db.Pool.Query(r.Context(), query, queryArgs...)
	if err != nil {
		slog.Error("sync query failed", "user_id", userID, "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		if err := scanEntry(&e, rows); err != nil {
			slog.Error("sync scan failed", "user_id", userID, "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "server_error"})
			return
		}
		entries = append(entries, e)
	}

	writeJSON(w, http.StatusOK, models.SyncResponse{Entries: entries})
}

const defaultDeleteTTL = 24 * time.Hour

func deleteConfirmationTTL() time.Duration {
	v := os.Getenv("DELETE_CONFIRMATION_TTL_HOURS")
	if v == "" {
		return defaultDeleteTTL
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		slog.Warn("invalid DELETE_CONFIRMATION_TTL_HOURS, using default", "value", v)
		return defaultDeleteTTL
	}
	return time.Duration(n) * time.Hour
}
