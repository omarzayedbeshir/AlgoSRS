package middleware

import (
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type bucket struct {
	count   int
	resetAt time.Time
}

type RateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	limit   int
	window  time.Duration
	next    http.Handler
}

type rateLimitConfig struct {
	entries int
	sync    int
}

func loadRateLimitConfig() rateLimitConfig {
	parse := func(key string, defaultVal int) int {
		v := os.Getenv(key)
		if v == "" {
			return defaultVal
		}
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return defaultVal
		}
		return n
	}
	return rateLimitConfig{
		entries: parse("RATE_LIMIT_ENTRIES", 60),
		sync:    parse("RATE_LIMIT_SYNC", 10),
	}
}

func NewRateLimiter(next http.Handler) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[string]*bucket),
		window:  time.Minute,
		next:    next,
	}
	go rl.cleanup(5 * time.Minute)
	return rl
}

func (rl *RateLimiter) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	limit := rl.limit
	cfg := loadRateLimitConfig()
	if strings.HasPrefix(r.URL.Path, "/api/sync") {
		limit = cfg.sync
	} else if strings.HasPrefix(r.URL.Path, "/api/") {
		limit = cfg.entries
	} else {
		rl.next.ServeHTTP(w, r)
		return
	}

	userID := GetUserID(r)
	key := userID
	if key == "" {
		key = r.RemoteAddr
	}

	rl.mu.Lock()
	b, ok := rl.buckets[key]
	now := time.Now()
	if !ok || now.After(b.resetAt) {
		rl.buckets[key] = &bucket{count: 1, resetAt: now.Add(rl.window)}
		rl.mu.Unlock()
		rl.next.ServeHTTP(w, r)
		return
	}

	if b.count >= limit {
		rl.mu.Unlock()
		wait := time.Until(b.resetAt)
		w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		w.Write([]byte(`{"error":"rate_limited"}`))
		slog.Warn("rate limited", "key", key, "path", r.URL.Path)
		return
	}

	b.count++
	rl.mu.Unlock()
	rl.next.ServeHTTP(w, r)
}

func (rl *RateLimiter) cleanup(interval time.Duration) {
	for {
		time.Sleep(interval)
		rl.mu.Lock()
		now := time.Now()
		for key, b := range rl.buckets {
			if now.After(b.resetAt) {
				delete(rl.buckets, key)
			}
		}
		rl.mu.Unlock()
	}
}
