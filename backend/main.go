package main

import (
	"log"
	"net/http"
	"os"

	"lc-fsrs-backend/db"
	"lc-fsrs-backend/handler"
	"lc-fsrs-backend/middleware"
)

func main() {
	if err := db.Connect(); err != nil {
		log.Fatalf("database connection failed: %v", err)
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

	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, middleware.CORS(mux)))
}

