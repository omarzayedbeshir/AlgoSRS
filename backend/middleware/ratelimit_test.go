package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func newTestLimiter(entries, sync int) *RateLimiter {
	return &RateLimiter{
		buckets: make(map[string]*bucket),
		cfg:     rateLimitConfig{entries: entries, sync: sync},
		window:  time.Minute,
		next:    http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}),
	}
}

func doRequest(rl *RateLimiter, method, path, userID string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, nil)
	if userID != "" {
		r = r.WithContext(ContextWithUserID(r.Context(), userID))
	}
	w := httptest.NewRecorder()
	rl.ServeHTTP(w, r)
	return w
}

func TestRateLimiterAllowsUpToLimitRequests(t *testing.T) {
	rl := newTestLimiter(3, 1)
	for i := 0; i < 3; i++ {
		if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusOK {
			t.Fatalf("request %d: got %d, want 200", i+1, w.Code)
		}
	}
	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("4th request: got %d, want 429", w.Code)
	}
}

func TestRateLimiterSyncUsesSyncLimit(t *testing.T) {
	rl := newTestLimiter(5, 2)
	for i := 0; i < 2; i++ {
		if w := doRequest(rl, "POST", "/api/sync", "sync-user"); w.Code != http.StatusOK {
			t.Fatalf("sync request %d: got %d, want 200", i+1, w.Code)
		}
	}
	if w := doRequest(rl, "POST", "/api/sync", "sync-user"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("3rd sync request: got %d, want 429", w.Code)
	}

	for i := 0; i < 5; i++ {
		if w := doRequest(rl, "POST", "/api/entries", "entries-user"); w.Code != http.StatusOK {
			t.Fatalf("entries request %d: got %d, want 200", i+1, w.Code)
		}
	}
	if w := doRequest(rl, "POST", "/api/entries", "entries-user"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("6th entries request: got %d, want 429", w.Code)
	}
}

func TestRateLimiterKeysByUser(t *testing.T) {
	rl := newTestLimiter(2, 1)
	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusOK {
		t.Fatalf("user-1 request 1: got %d, want 200", w.Code)
	}
	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusOK {
		t.Fatalf("user-1 request 2: got %d, want 200", w.Code)
	}
	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("user-1 request 3: got %d, want 429", w.Code)
	}
	if w := doRequest(rl, "POST", "/api/entries", "user-2"); w.Code != http.StatusOK {
		t.Fatalf("user-2 request 1: got %d, want 200", w.Code)
	}
}

func TestRateLimiterSetsRetryAfter(t *testing.T) {
	rl := newTestLimiter(1, 1)
	doRequest(rl, "POST", "/api/entries", "user-1")
	w := doRequest(rl, "POST", "/api/entries", "user-1")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", w.Code)
	}
	ra := w.Header().Get("Retry-After")
	n, err := strconv.Atoi(ra)
	if err != nil || n < 1 {
		t.Fatalf("Retry-After = %q, want an integer >= 1", ra)
	}
}

func TestRateLimiterWindowResets(t *testing.T) {
	rl := newTestLimiter(1, 1)
	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusOK {
		t.Fatalf("request 1: got %d, want 200", w.Code)
	}
	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusTooManyRequests {
		t.Fatalf("request 2: got %d, want 429", w.Code)
	}

	rl.mu.Lock()
	rl.buckets["user-1"].resetAt = time.Now().Add(-time.Second)
	rl.mu.Unlock()

	if w := doRequest(rl, "POST", "/api/entries", "user-1"); w.Code != http.StatusOK {
		t.Fatalf("request after reset: got %d, want 200", w.Code)
	}
}
