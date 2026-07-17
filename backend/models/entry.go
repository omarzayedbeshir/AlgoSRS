package models

type Entry struct {
	ID             string   `json:"id"`
	UserID         string   `json:"user_id"`
	Title          string   `json:"title"`
	URL            string   `json:"url"`
	Difficulty     string   `json:"difficulty"`
	Rating         int      `json:"rating"`
	Date           string   `json:"date"`
	UpdatedAt      string   `json:"updated_at"`
	Stability      float64  `json:"stability"`
	DifficultyFsrs float64  `json:"difficulty_fsrs"`
	DueDate        *string  `json:"due_date,omitempty"`
	Reps           int      `json:"reps"`
	Lapses         int      `json:"lapses"`
	FSRSState      int      `json:"fsrs_state"`
	LastReviewAt   *string  `json:"last_review_at,omitempty"`
}

type SyncRequest struct {
	Entries    []Entry  `json:"entries"`
	DeletedIDs []string `json:"deleted_ids"`
}

type SyncResponse struct {
	Entries []Entry `json:"entries"`
}
