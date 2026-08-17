package handlers

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
)

func TestAuthLoginHandler(t *testing.T) {
	app := fiber.New()
	app.Post("/api/auth/login", Login)

	body, _ := json.Marshal(map[string]string{
		"email":    "admin@estate.com",
		"password": "Admin123!",
	})

	req := httptest.NewRequest("POST", "/api/auth/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Failed to execute login test: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Expected status 200 for mock admin login, got %d", resp.StatusCode)
	}
}

func TestPasswordAndJWTUtils(t *testing.T) {
	password := "SecretPass123!"
	hashed, err := utils.HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	if !utils.CheckPasswordHash(password, hashed) {
		t.Errorf("Password hash check failed")
	}

	token, err := utils.GenerateToken(1, "test@estate.com", "ADMIN")
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := utils.ValidateToken(token)
	if err != nil {
		t.Fatalf("Failed to validate token: %v", err)
	}

	if claims.Email != "test@estate.com" || claims.Role != "ADMIN" {
		t.Errorf("Claims mismatch: got email %s, role %s", claims.Email, claims.Role)
	}
}
