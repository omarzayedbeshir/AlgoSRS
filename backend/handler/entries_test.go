package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"algosrs-backend/db"
	"algosrs-backend/middleware"
	"algosrs-backend/models"
)

func TestMain(m *testing.M) {
	if url := os.Getenv("DATABASE_URL"); url != "" {
		if err := db.Connect(); err != nil {
			panic("test db connect: " + err.Error())
		}
		_, err := db.Pool.Exec(context.Background(), `
			CREATE TABLE IF NOT EXISTS leetcode_entries (
				id              TEXT NOT NULL PRIMARY KEY,
				user_id         TEXT NOT NULL,
				title           TEXT NOT NULL,
				url             TEXT NOT NULL,
				difficulty      TEXT NOT NULL,
				tags            TEXT[] NOT NULL DEFAULT '{}',
				rating          SMALLINT NOT NULL,
				date            TIMESTAMPTZ NOT NULL,
				updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				stability       DOUBLE PRECISION DEFAULT 0,
				difficulty_fsrs DOUBLE PRECISION DEFAULT 0,
				due_date        TIMESTAMPTZ,
				reps            INTEGER DEFAULT 0,
				lapses          INTEGER DEFAULT 0,
				fsrs_state      INTEGER DEFAULT 0,
				last_review_at  TIMESTAMPTZ,
				UNIQUE(user_id, url)
			)
		`)
		if err != nil {
			panic("test schema: " + err.Error())
		}
	}
	os.Exit(m.Run())
}

func cleanupTestData(t *testing.T, userID string) {
	t.Helper()
	if db.Pool == nil {
		return
	}
	_, err := db.Pool.Exec(context.Background(), `DELETE FROM leetcode_entries WHERE user_id = $1`, userID)
	if err != nil {
		t.Fatalf("cleanup: %v", err)
	}
}

func authenticatedRequest(t *testing.T, method, path string, body []byte, userID string) *http.Request {
	t.Helper()
	var req *http.Request
	if body != nil {
		req = httptest.NewRequest(method, path, bytes.NewReader(body))
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	req = req.WithContext(middleware.ContextWithUserID(req.Context(), userID))
	return req
}

func marshalJSON(t *testing.T, v any) []byte {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func ptr(s string) *string { return &s }

// --- Unit tests (no DB needed) ---

func TestSanitizeEntry(t *testing.T) {
	e := &models.Entry{}
	sanitizeEntry(e)

	if e.Date == "" {
		t.Error("Date should be set")
	}
	if e.Tags == nil {
		t.Error("Tags should not be nil")
	}
	if e.DueDate == nil || *e.DueDate == "" {
		t.Error("DueDate should be set")
	}
	if e.LastReviewAt == nil || *e.LastReviewAt == "" {
		t.Error("LastReviewAt should be set")
	}
}

func TestSanitizeEntryPreservesValues(t *testing.T) {
	due := ptr("2026-08-01T00:00:00Z")
	last := ptr("2026-07-20T00:00:00Z")
	e := &models.Entry{
		Date:         "2026-07-25T00:00:00Z",
		Tags:         []string{"array", "hash-table"},
		DueDate:      due,
		LastReviewAt: last,
	}
	sanitizeEntry(e)

	if e.Date != "2026-07-25T00:00:00Z" {
		t.Error("Date should be preserved")
	}
	if len(e.Tags) != 2 {
		t.Error("Tags should be preserved")
	}
	if *e.DueDate != *due {
		t.Error("DueDate should be preserved")
	}
}

func TestSanitizeEntryNilTags(t *testing.T) {
	e := &models.Entry{Tags: nil}
	sanitizeEntry(e)
	if e.Tags == nil {
		t.Error("Tags should not be nil after sanitize")
	}
	if len(e.Tags) != 0 {
		t.Errorf("Tags should be empty, got %v", e.Tags)
	}
}

// --- Integration tests (require DATABASE_URL) ---

func TestHealth(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/health", nil)
	Health(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status: got %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]string
	json.NewDecoder(w.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Errorf("status: got %s, want ok", body["status"])
	}
}

func TestIntegrationUpsertAndList(t *testing.T) {
	if db.Pool == nil {
		t.Skip("DATABASE_URL not set")
	}

	userID := "test-user-upsert-list"
	cleanupTestData(t, userID)
	defer cleanupTestData(t, userID)

	entry := models.Entry{
		ID:         "integration-e1",
		Title:      "Two Sum",
		URL:        "https://leetcode.com/problems/two-sum",
		Difficulty: "easy",
		Rating:     3,
		Date:       "2026-07-20T00:00:00Z",
		Tags:       []string{"array"},
	}

	w := httptest.NewRecorder()
	req := authenticatedRequest(t, "POST", "/api/entries", marshalJSON(t, entry), userID)
	UpsertEntry(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("upsert status: got %d, want %d. body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var created models.Entry
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if created.ID != entry.ID {
		t.Errorf("ID: got %s, want %s", created.ID, entry.ID)
	}
	if created.UserID != userID {
		t.Errorf("UserID: got %s, want %s", created.UserID, userID)
	}
	if created.UpdatedAt == "" {
		t.Error("UpdatedAt should be set")
	}

	w2 := httptest.NewRecorder()
	req2 := authenticatedRequest(t, "GET", "/api/entries", nil, userID)
	ListEntries(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("list status: got %d, want %d", w2.Code, http.StatusOK)
	}

	var listResp map[string][]models.Entry
	json.NewDecoder(w2.Body).Decode(&listResp)
	entries := listResp["entries"]
	if len(entries) != 1 {
		t.Fatalf("list entries: got %d, want 1", len(entries))
	}
	if entries[0].Title != "Two Sum" {
		t.Errorf("title: got %s, want 'Two Sum'", entries[0].Title)
	}
}

func TestIntegrationUpsertUpdatesExisting(t *testing.T) {
	if db.Pool == nil {
		t.Skip("DATABASE_URL not set")
	}

	userID := "test-user-upsert-update"
	cleanupTestData(t, userID)
	defer cleanupTestData(t, userID)

	entry := models.Entry{
		ID:         "integration-e2",
		Title:      "Original Title",
		URL:        "https://leetcode.com/problems/update-test",
		Difficulty: "medium",
		Rating:     2,
		Date:       "2026-07-20T00:00:00Z",
		Tags:       []string{},
	}

	w := httptest.NewRecorder()
	UpsertEntry(w, authenticatedRequest(t, "POST", "/api/entries", marshalJSON(t, entry), userID))
	if w.Code != http.StatusOK {
		t.Fatalf("first upsert: %d", w.Code)
	}

	entry.Title = "Updated Title"
	entry.Rating = 4

	w2 := httptest.NewRecorder()
	UpsertEntry(w2, authenticatedRequest(t, "POST", "/api/entries", marshalJSON(t, entry), userID))
	if w2.Code != http.StatusOK {
		t.Fatalf("second upsert: %d", w2.Code)
	}

	var updated models.Entry
	json.NewDecoder(w2.Body).Decode(&updated)
	if updated.Title != "Updated Title" {
		t.Errorf("title: got %s, want 'Updated Title'", updated.Title)
	}
	if updated.Rating != 4 {
		t.Errorf("rating: got %d, want 4", updated.Rating)
	}
}

func TestIntegrationDeleteEntry(t *testing.T) {
	if db.Pool == nil {
		t.Skip("DATABASE_URL not set")
	}

	userID := "test-user-delete"
	cleanupTestData(t, userID)
	defer cleanupTestData(t, userID)

	entry := models.Entry{
		ID:         "integration-e3",
		Title:      "Delete Me",
		URL:        "https://leetcode.com/problems/delete-me",
		Difficulty: "hard",
		Rating:     1,
		Date:       "2026-07-20T00:00:00Z",
		Tags:       []string{},
	}

	w := httptest.NewRecorder()
	UpsertEntry(w, authenticatedRequest(t, "POST", "/api/entries", marshalJSON(t, entry), userID))
	if w.Code != http.StatusOK {
		t.Fatalf("upsert before delete: %d", w.Code)
	}

	w2 := httptest.NewRecorder()
	req2 := authenticatedRequest(t, "DELETE", "/api/entries?id="+entry.ID, nil, userID)
	DeleteEntry(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("delete: %d, body: %s", w2.Code, w2.Body.String())
	}

	w3 := httptest.NewRecorder()
	ListEntries(w3, authenticatedRequest(t, "GET", "/api/entries", nil, userID))
	var listResp map[string][]models.Entry
	json.NewDecoder(w3.Body).Decode(&listResp)
	if len(listResp["entries"]) != 0 {
		t.Errorf("entries after delete: got %d, want 0", len(listResp["entries"]))
	}
}

func TestIntegrationSync(t *testing.T) {
	if db.Pool == nil {
		t.Skip("DATABASE_URL not set")
	}

	userID := "test-user-sync"
	cleanupTestData(t, userID)
	defer cleanupTestData(t, userID)

	syncReq := models.SyncRequest{
		Entries: []models.Entry{
			{
				ID:         "sync-e1",
				Title:      "Sync Test A",
				URL:        "https://leetcode.com/problems/sync-a",
				Difficulty: "easy",
				Rating:     3,
				Date:       "2026-07-20T00:00:00Z",
				Tags:       []string{},
			},
			{
				ID:         "sync-e2",
				Title:      "Sync Test B",
				URL:        "https://leetcode.com/problems/sync-b",
				Difficulty: "medium",
				Rating:     2,
				Date:       "2026-07-20T00:00:00Z",
				Tags:       []string{"array"},
			},
		},
		DeletedIDs: []string{},
	}

	w := httptest.NewRecorder()
	SyncEntries(w, authenticatedRequest(t, "POST", "/api/sync", marshalJSON(t, syncReq), userID))
	if w.Code != http.StatusOK {
		t.Fatalf("sync: %d, body: %s", w.Code, w.Body.String())
	}

	var syncResp models.SyncResponse
	json.NewDecoder(w.Body).Decode(&syncResp)
	if len(syncResp.Entries) != 2 {
		t.Fatalf("sync response entries: got %d, want 2", len(syncResp.Entries))
	}

	deletedReq := models.SyncRequest{
		Entries:    []models.Entry{},
		DeletedIDs: []string{"sync-e1"},
	}

	w2 := httptest.NewRecorder()
	SyncEntries(w2, authenticatedRequest(t, "POST", "/api/sync", marshalJSON(t, deletedReq), userID))
	if w2.Code != http.StatusOK {
		t.Fatalf("sync delete: %d", w2.Code)
	}

	var syncResp2 models.SyncResponse
	json.NewDecoder(w2.Body).Decode(&syncResp2)
	if len(syncResp2.Entries) != 1 {
		t.Fatalf("entries after delete sync: got %d, want 1", len(syncResp2.Entries))
	}
	if syncResp2.Entries[0].ID != "sync-e2" {
		t.Errorf("remaining entry: got %s, want sync-e2", syncResp2.Entries[0].ID)
	}
}

func TestIntegrationDifferentUsersIsolated(t *testing.T) {
	if db.Pool == nil {
		t.Skip("DATABASE_URL not set")
	}

	userA := "test-user-a"
	userB := "test-user-b"
	cleanupTestData(t, userA)
	cleanupTestData(t, userB)
	defer cleanupTestData(t, userA)
	defer cleanupTestData(t, userB)

	entryA := models.Entry{
		ID: "user-a-entry", Title: "User A Problem",
		URL: "https://leetcode.com/problems/user-a", Difficulty: "easy",
		Rating: 3, Date: "2026-07-20T00:00:00Z", Tags: []string{},
	}
	entryB := models.Entry{
		ID: "user-b-entry", Title: "User B Problem",
		URL: "https://leetcode.com/problems/user-b", Difficulty: "hard",
		Rating: 4, Date: "2026-07-20T00:00:00Z", Tags: []string{},
	}

	for _, tc := range []struct {
		user   string
		entry  models.Entry
	}{
		{userA, entryA},
		{userB, entryB},
	} {
		w := httptest.NewRecorder()
		UpsertEntry(w, authenticatedRequest(t, "POST", "/api/entries", marshalJSON(t, tc.entry), tc.user))
		if w.Code != http.StatusOK {
			t.Fatalf("upsert for %s: %d", tc.user, w.Code)
		}
	}

	wA := httptest.NewRecorder()
	ListEntries(wA, authenticatedRequest(t, "GET", "/api/entries", nil, userA))

	var respA map[string][]models.Entry
	json.NewDecoder(wA.Body).Decode(&respA)
	if len(respA["entries"]) != 1 || respA["entries"][0].ID != "user-a-entry" {
		t.Errorf("user A entries: got %v", respA["entries"])
	}

	wB := httptest.NewRecorder()
	ListEntries(wB, authenticatedRequest(t, "GET", "/api/entries", nil, userB))

	var respB map[string][]models.Entry
	json.NewDecoder(wB.Body).Decode(&respB)
	if len(respB["entries"]) != 1 || respB["entries"][0].ID != "user-b-entry" {
		t.Errorf("user B entries: got %v", respB["entries"])
	}
}

func TestIntegrationTagsRoundTrip(t *testing.T) {
	if db.Pool == nil {
		t.Skip("DATABASE_URL not set")
	}

	userID := "test-user-tags"
	cleanupTestData(t, userID)
	defer cleanupTestData(t, userID)

	tags := []string{"array", "hash-table", "two-pointers"}
	entry := models.Entry{
		ID: "tags-test", Title: "Tags Test",
		URL: "https://leetcode.com/problems/tags-test", Difficulty: "medium",
		Rating: 3, Date: "2026-07-20T00:00:00Z", Tags: tags,
	}

	w := httptest.NewRecorder()
	UpsertEntry(w, authenticatedRequest(t, "POST", "/api/entries", marshalJSON(t, entry), userID))
	if w.Code != http.StatusOK {
		t.Fatalf("upsert: %d", w.Code)
	}

	var created models.Entry
	json.NewDecoder(w.Body).Decode(&created)
	if len(created.Tags) != 3 {
		t.Fatalf("tags count: got %d, want 3. tags: %v", len(created.Tags), created.Tags)
	}
	for i, tag := range tags {
		if created.Tags[i] != tag {
			t.Errorf("tag[%d]: got %s, want %s", i, created.Tags[i], tag)
		}
	}

	w2 := httptest.NewRecorder()
	ListEntries(w2, authenticatedRequest(t, "GET", "/api/entries", nil, userID))
	var listResp map[string][]models.Entry
	json.NewDecoder(w2.Body).Decode(&listResp)
	listed := listResp["entries"]
	if len(listed) != 1 {
		t.Fatalf("list count: %d", len(listed))
	}
	if len(listed[0].Tags) != 3 {
		t.Errorf("listed tags: %v", listed[0].Tags)
	}
}
