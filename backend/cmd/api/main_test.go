package main

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestHealthCheck(t *testing.T) {
	app := fiber.New()
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "success",
			"message": "API is healthy",
		})
	})

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Failed to test health endpoint: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}
