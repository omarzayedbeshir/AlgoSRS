package models

type Entry struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	Difficulty string `json:"difficulty"`
	Rating     int    `json:"rating"`
	Date       string `json:"date"`
	UpdatedAt  string `json:"updated_at"`
}

type SyncRequest struct {
	Entries    []Entry  `json:"entries"`
	DeletedIDs []string `json:"deleted_ids"`
}

type SyncResponse struct {
	Entries []Entry `json:"entries"`
}
