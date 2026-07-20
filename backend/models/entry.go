package models

type Entry struct {
	ID             string   `json:"id"`
	UserID         string   `json:"user_id"`
	Title          string   `json:"title"`
	URL            string   `json:"url"`
	Difficulty     string   `json:"difficulty"`
	Tags           []string `json:"tags"`
	Rating         int      `json:"rating"`
	Date           string   `json:"date"`
	UpdatedAt      string   `json:"updatedAt"`
	Stability      float64  `json:"stability"`
	DifficultyFsrs float64  `json:"difficultyFsrs"`
	DueDate        *string  `json:"dueDate,omitempty"`
	Reps           int      `json:"reps"`
	Lapses         int      `json:"lapses"`
	FSRSState      int      `json:"fsrsState"`
	LastReviewAt   *string  `json:"lastReviewAt,omitempty"`
}

type SyncRequest struct {
	Entries    []Entry  `json:"entries"`
	DeletedIDs []string `json:"deleted_ids"`
}

type SyncResponse struct {
	Entries []Entry `json:"entries"`
}
