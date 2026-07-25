package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"os"
	"sync"
	"time"
)

type jwkKey struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksResponse struct {
	Keys []jwkKey `json:"keys"`
}

var (
	jwksCache     []jwkKey
	jwksCacheMu   sync.RWMutex
	jwksFetchedAt time.Time
)

func InitJWKS() {
	if _, err := fetchJWKS(); err != nil {
		slog.Warn("initial JWKS fetch failed, will retry", "error", err)
	}
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			if _, err := fetchJWKS(); err != nil {
				slog.Warn("JWKS refresh failed", "error", err)
			}
		}
	}()
}

func getKeyFromJWKS(kid string) (interface{}, error) {
	keys, err := fetchJWKS()
	if err != nil {
		return nil, err
	}

	for _, key := range keys {
		if key.Kid == kid {
			return parseECKey(key)
		}
	}

	return nil, fmt.Errorf("jwks key not found: %s", kid)
}

func fetchJWKS() ([]jwkKey, error) {
	jwksCacheMu.RLock()
	if time.Since(jwksFetchedAt) < 10*time.Minute && jwksCache != nil {
		defer jwksCacheMu.RUnlock()
		return jwksCache, nil
	}
	jwksCacheMu.RUnlock()

	jwksCacheMu.Lock()
	defer jwksCacheMu.Unlock()

	if time.Since(jwksFetchedAt) < 10*time.Minute && jwksCache != nil {
		return jwksCache, nil
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		if jwksCache != nil {
			slog.Warn("SUPABASE_URL not set, using stale JWKS cache")
			return jwksCache, nil
		}
		return nil, fmt.Errorf("SUPABASE_URL not set")
	}

	resp, err := http.Get(supabaseURL + "/auth/v1/.well-known/jwks.json")
	if err != nil {
		if jwksCache != nil {
			slog.Warn("failed to fetch JWKS, using stale cache", "error", err)
			return jwksCache, nil
		}
		return nil, fmt.Errorf("fetch jwks: %w", err)
	}
	defer resp.Body.Close()

	var jk jwksResponse
	if err := json.NewDecoder(resp.Body).Decode(&jk); err != nil {
		if jwksCache != nil {
			slog.Warn("failed to decode JWKS, using stale cache", "error", err)
			return jwksCache, nil
		}
		return nil, fmt.Errorf("decode jwks: %w", err)
	}

	jwksCache = jk.Keys
	jwksFetchedAt = time.Now()

	return jwksCache, nil
}

func parseECKey(key jwkKey) (*ecdsa.PublicKey, error) {
	xBytes, err := base64.RawURLEncoding.DecodeString(key.X)
	if err != nil {
		return nil, fmt.Errorf("decode jwk x: %w", err)
	}

	yBytes, err := base64.RawURLEncoding.DecodeString(key.Y)
	if err != nil {
		return nil, fmt.Errorf("decode jwk y: %w", err)
	}

	var curve elliptic.Curve
	switch key.Crv {
	case "P-256":
		curve = elliptic.P256()
	case "P-384":
		curve = elliptic.P384()
	case "P-521":
		curve = elliptic.P521()
	default:
		return nil, fmt.Errorf("unsupported jwk curve: %s", key.Crv)
	}

	x := new(big.Int).SetBytes(xBytes)
	y := new(big.Int).SetBytes(yBytes)

	pub := &ecdsa.PublicKey{Curve: curve, X: x, Y: y}
	if !curve.IsOnCurve(x, y) {
		return nil, fmt.Errorf("jwk point not on curve")
	}

	return pub, nil
}
