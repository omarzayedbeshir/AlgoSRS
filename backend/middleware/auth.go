package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const userIDKey ctxKey = "user_id"

func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			slog.Warn("missing authorization header", "path", r.URL.Path)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		claims := &jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, keyFunc)
		if err != nil || !token.Valid {
			slog.Warn("invalid token", "path", r.URL.Path, "error", err)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}

		userID, ok := (*claims)["sub"].(string)
		if !ok || userID == "" {
			slog.Warn("missing sub claim in token", "path", r.URL.Path)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func keyFunc(token *jwt.Token) (interface{}, error) {
	kid, ok := token.Header["kid"].(string)
	if !ok || kid == "" {
		return nil, jwt.ErrSignatureInvalid
	}
	return getKeyFromJWKS(kid)
}

func GetUserID(r *http.Request) string {
	uid, _ := r.Context().Value(userIDKey).(string)
	return uid
}

func ContextWithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}
