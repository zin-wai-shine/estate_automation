package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
)

// Protected verifies the Bearer JWT token in the Authorization header.
func Protected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Unauthorized",
				"message": "Missing Authorization header",
			})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Unauthorized",
				"message": "Invalid Authorization format. Expected 'Bearer <token>'",
			})
		}

		claims, err := utils.ValidateToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "Unauthorized",
				"message": "Invalid or expired token",
			})
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)

		return c.Next()
	}
}

// RequireRole enforces role-based access control.
func RequireRole(roles ...models.RoleName) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userRole, ok := c.Locals("role").(models.RoleName)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":   "Forbidden",
				"message": "Role metadata not found",
			})
		}

		// ADMIN always passes
		if userRole == models.RoleAdmin {
			return c.Next()
		}

		for _, allowedRole := range roles {
			if userRole == allowedRole {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Forbidden",
			"message": "Insufficient permissions to access this resource",
		})
	}
}
