package main

import (
	"log/slog"
	"net/http"
	"os"

	"algosrs-backend/db"
	"algosrs-backend/handler"
	"algosrs-backend/middleware"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	middleware.InitJWKS()

	if err := db.Connect(); err != nil {
		slog.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.ApplySchema(); err != nil {
		slog.Error("schema apply failed", "error", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", handler.Health)
	mux.HandleFunc("GET /auth/callback", handler.AuthCallback)

	protected := http.NewServeMux()
	protected.HandleFunc("GET /api/entries", handler.ListEntries)
	protected.HandleFunc("POST /api/entries", handler.UpsertEntry)
	protected.HandleFunc("DELETE /api/entries", handler.DeleteEntry)
	protected.HandleFunc("DELETE /api/user/entries", handler.DeleteAllEntries)
	protected.HandleFunc("POST /api/user/delete-request", handler.RequestDeleteUser)
	protected.HandleFunc("DELETE /api/user", handler.DeleteUser)
	protected.HandleFunc("POST /api/sync", handler.SyncEntries)

	mux.Handle("/api/", middleware.Auth(middleware.NewRateLimiter(middleware.MaxBody(protected))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	slog.Info("listening", "port", port)
	if err := http.ListenAndServe(":"+port, middleware.CORS(middleware.NewRateLimiter(mux))); err != nil {
		slog.Error("server exited", "error", err)
		os.Exit(1)
	}
}
