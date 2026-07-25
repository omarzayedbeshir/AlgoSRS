package middleware

import (
	"net/http"
)

const MaxBodySize = 1 << 20

func MaxBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH" {
			r.Body = http.MaxBytesReader(w, r.Body, MaxBodySize)
		}
		next.ServeHTTP(w, r)
	})
}
