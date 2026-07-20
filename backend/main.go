package main

import (
	"log/slog"
	"net/http"
	"os"

	"lc-fsrs-backend/db"
	"lc-fsrs-backend/handler"
	"lc-fsrs-backend/middleware"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	if err := db.Connect(); err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /", handler.AuthCallback)
	mux.HandleFunc("GET /api/health", handler.Health)
	mux.HandleFunc("GET /auth/callback", handler.AuthCallback)

	mux.Handle("GET /api/entries", middleware.Auth(http.HandlerFunc(handler.ListEntries)))
	mux.Handle("POST /api/entries", middleware.Auth(http.HandlerFunc(handler.UpsertEntry)))
	mux.Handle("DELETE /api/entries", middleware.Auth(http.HandlerFunc(handler.DeleteEntry)))
	mux.Handle("DELETE /api/user/entries", middleware.Auth(http.HandlerFunc(handler.DeleteAllEntries)))
	mux.Handle("DELETE /api/user", middleware.Auth(http.HandlerFunc(handler.DeleteUser)))
	mux.Handle("POST /api/sync", middleware.Auth(http.HandlerFunc(handler.SyncEntries)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("listening", "port", port)
	if err := http.ListenAndServe(":"+port, middleware.CORS(mux)); err != nil {
		slog.Error("server exited", "error", err)
		os.Exit(1)
	}
}
