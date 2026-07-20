package models

import (
	"encoding/json"
	"testing"
)

func ptr(s string) *string { return &s }

func TestEntryJSONRoundTrip(t *testing.T) {
	e := Entry{
		ID:             "test-id-1",
		UserID:         "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
		Title:          "Two Sum",
		URL:            "https://leetcode.com/problems/two-sum",
		Difficulty:     "easy",
		Tags:           []string{"array", "hash-table"},
		Rating:         3,
		Date:           "2026-07-20T00:00:00Z",
		UpdatedAt:      "2026-07-20T12:00:00Z",
		Stability:      5.2,
		DifficultyFsrs: 0.45,
		DueDate:        ptr("2026-07-25T00:00:00Z"),
		LastReviewAt:   ptr("2026-07-20T00:00:00Z"),
		Reps:           3,
		Lapses:         1,
		FSRSState:      2,
	}

	data, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got Entry
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.ID != e.ID {
		t.Errorf("ID: got %s, want %s", got.ID, e.ID)
	}
	if got.Title != e.Title {
		t.Errorf("Title: got %s, want %s", got.Title, e.Title)
	}
	if got.Difficulty != e.Difficulty {
		t.Errorf("Difficulty: got %s, want %s", got.Difficulty, e.Difficulty)
	}
	if len(got.Tags) != 2 || got.Tags[0] != "array" {
		t.Errorf("Tags: got %v, want [array hash-table]", got.Tags)
	}
	if got.Rating != e.Rating {
		t.Errorf("Rating: got %d, want %d", got.Rating, e.Rating)
	}
	if got.Stability != e.Stability {
		t.Errorf("Stability: got %f, want %f", got.Stability, e.Stability)
	}
	if got.Reps != e.Reps {
		t.Errorf("Reps: got %d, want %d", got.Reps, e.Reps)
	}
	if got.FSRSState != e.FSRSState {
		t.Errorf("FSRSState: got %d, want %d", got.FSRSState, e.FSRSState)
	}
	if got.DueDate == nil || *got.DueDate != *e.DueDate {
		t.Errorf("DueDate: got %v, want %v", got.DueDate, e.DueDate)
	}
}

func TestEntryJSONNullDueDate(t *testing.T) {
	e := Entry{
		ID:         "test-id-2",
		Title:      "Three Sum",
		URL:        "https://leetcode.com/problems/3sum",
		Difficulty: "hard",
		Rating:     4,
		Date:       "2026-07-20T00:00:00Z",
		Tags:       []string{},
	}

	data, err := json.Marshal(e)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got Entry
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if got.DueDate != nil {
		t.Errorf("DueDate should be nil, got %v", *got.DueDate)
	}
	if got.Tags == nil {
		t.Error("Tags should be empty slice, not nil")
	}
	if len(got.Tags) != 0 {
		t.Errorf("Tags should be empty, got %v", got.Tags)
	}
}

func TestEntryJSONFieldNames(t *testing.T) {
	e := Entry{
		Stability:      3.14,
		DifficultyFsrs: 0.5,
		FSRSState:      1,
		LastReviewAt:   ptr("2026-07-20T00:00:00Z"),
	}

	data, _ := json.Marshal(e)
	var raw map[string]any
	json.Unmarshal(data, &raw)

	if _, ok := raw["stability"]; !ok {
		t.Error("expected camelCase 'stability' field")
	}
	if _, ok := raw["difficulty_fsrs"]; ok {
		t.Error("unexpected snake_case 'difficulty_fsrs' field")
	}
	if _, ok := raw["difficultyFsrs"]; !ok {
		t.Error("expected camelCase 'difficultyFsrs' field")
	}
	if _, ok := raw["fsrsState"]; !ok {
		t.Error("expected camelCase 'fsrsState' field")
	}
	if _, ok := raw["lastReviewAt"]; !ok {
		t.Error("expected camelCase 'lastReviewAt' field")
	}
}

func TestSyncRequestJSON(t *testing.T) {
	req := SyncRequest{
		Entries: []Entry{
			{ID: "e1", Title: "A", URL: "https://leetcode.com/problems/a", Difficulty: "easy", Rating: 3, Date: "2026-07-20T00:00:00Z", Tags: []string{}},
			{ID: "e2", Title: "B", URL: "https://leetcode.com/problems/b", Difficulty: "medium", Rating: 2, Date: "2026-07-20T00:00:00Z", Tags: []string{}},
		},
		DeletedIDs: []string{"e3"},
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got SyncRequest
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(got.Entries) != 2 {
		t.Errorf("Entries: got %d, want 2", len(got.Entries))
	}
	if len(got.DeletedIDs) != 1 || got.DeletedIDs[0] != "e3" {
		t.Errorf("DeletedIDs: got %v, want [e3]", got.DeletedIDs)
	}
}
