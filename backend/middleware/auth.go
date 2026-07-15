package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const userIDKey ctxKey = "user_id"

func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error":"missing authorization"}`, http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		claims := &jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, keyFunc)
		if err != nil || !token.Valid {
			http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
			return
		}

		userID, ok := (*claims)["sub"].(string)
		if !ok || userID == "" {
			http.Error(w, `{"error":"invalid user"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func keyFunc(token *jwt.Token) (interface{}, error) {
	if kid, ok := token.Header["kid"].(string); ok && kid != "" {
		return getKeyFromJWKS(kid)
	}

	if _, ok := token.Method.(*jwt.SigningMethodHMAC); ok {
		secret := os.Getenv("SUPABASE_JWT_SECRET")
		if secret == "" {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	}

	return nil, jwt.ErrSignatureInvalid
}

func GetUserID(r *http.Request) string {
	uid, _ := r.Context().Value(userIDKey).(string)
	return uid
}
