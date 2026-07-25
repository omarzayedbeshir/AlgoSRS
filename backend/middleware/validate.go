package middleware

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"
	"strings"

	"algosrs-backend/models"
)

var leetCodeURL = regexp.MustCompile(`^https?://(www\.)?leetcode\.com/problems/[a-z0-9-]+/?`)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

func ValidateEntry(e *models.Entry) []ValidationError {
	var errs []ValidationError

	if strings.TrimSpace(e.Title) == "" {
		errs = append(errs, ValidationError{Field: "title", Message: "title is required"})
	} else if len(e.Title) > 500 {
		errs = append(errs, ValidationError{Field: "title", Message: "title must be at most 500 characters"})
	}

	if strings.TrimSpace(e.URL) == "" {
		errs = append(errs, ValidationError{Field: "url", Message: "url is required"})
	} else if !leetCodeURL.MatchString(e.URL) {
		errs = append(errs, ValidationError{Field: "url", Message: "url must be a valid LeetCode problem URL"})
	}

	validDifficulties := map[string]bool{"easy": true, "medium": true, "hard": true}
	if !validDifficulties[e.Difficulty] {
		errs = append(errs, ValidationError{Field: "difficulty", Message: "difficulty must be easy, medium, or hard"})
	}

	if e.Rating < 1 || e.Rating > 4 {
		errs = append(errs, ValidationError{Field: "rating", Message: "rating must be between 1 and 4"})
	}

	for i, tag := range e.Tags {
		if len(tag) > 50 {
			errs = append(errs, ValidationError{Field: "tags", Message: "tag at index " + itoa(i) + " exceeds 50 characters"})
		}
	}

	return errs
}

func ValidateSyncRequest(req *models.SyncRequest) []ValidationError {
	var errs []ValidationError
	for i := range req.Entries {
		entryErrs := ValidateEntry(&req.Entries[i])
		for _, e := range entryErrs {
			errs = append(errs, ValidationError{
				Field:   "entries[" + itoa(i) + "]." + e.Field,
				Message: e.Message,
			})
		}
	}
	return errs
}

func WriteValidationError(w http.ResponseWriter, errs []ValidationError) {
	slog.Warn("validation failed", "errors", errs)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(map[string]any{
		"error":  "validation_error",
		"fields": errs,
	})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
