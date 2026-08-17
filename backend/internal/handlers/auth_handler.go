package handlers

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/zinwaishine/estate-automate/backend/internal/database"
	"github.com/zinwaishine/estate-automate/backend/internal/models"
	"github.com/zinwaishine/estate-automate/backend/internal/utils"
)

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RegisterInput struct {
	Email    string          `json:"email"`
	Password string          `json:"password"`
	Name     string          `json:"name"`
	Role     models.RoleName `json:"role"`
}

// Login handles POST /api/auth/login
func Login(c *fiber.Ctx) error {
	var input LoginInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Invalid JSON input",
		})
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if input.Email == "" || input.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Email and password are required",
		})
	}

	// Fallback mock if database is not available locally
	if database.DB == nil {
		if input.Email == "admin@estate.com" && input.Password == "Admin123!" {
			token, _ := utils.GenerateToken(1, input.Email, models.RoleAdmin)
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"status": "success",
				"data": fiber.Map{
					"token": token,
					"user": fiber.Map{
						"id":     1,
						"email":  "admin@estate.com",
						"name":   "Platform Administrator",
						"role":   "ADMIN",
						"status": "ACTIVE",
					},
				},
			})
		}
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Invalid email or password",
		})
	}

	var user models.User
	if err := database.DB.Where("email = ?", input.Email).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Invalid email or password",
		})
	}

	if !utils.CheckPasswordHash(input.Password, user.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "Unauthorized",
			"message": "Invalid email or password",
		})
	}

	token, err := utils.GenerateToken(user.ID, user.Email, user.Role)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "Internal Server Error",
			"message": "Failed to generate authentication token",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data": fiber.Map{
			"token": token,
			"user":  user,
		},
	})
}

// Register handles POST /api/auth/register
func Register(c *fiber.Ctx) error {
	var input RegisterInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Invalid JSON input",
		})
	}

	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	if input.Email == "" || input.Password == "" || input.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "Bad Request",
			"message": "Email, password, and name are required",
		})
	}

	if input.Role == "" {
		input.Role = models.RoleAgent
	}

	if database.DB != nil {
		var existing models.User
		if err := database.DB.Where("email = ?", input.Email).First(&existing).Error; err == nil {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":   "Conflict",
				"message": "User with this email already exists",
			})
		}

		hashedPassword, err := utils.HashPassword(input.Password)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Internal Server Error",
				"message": "Failed to hash password",
			})
		}

		newUser := models.User{
			Email:    input.Email,
			Password: hashedPassword,
			Name:     input.Name,
			Role:     input.Role,
			Status:   "ACTIVE",
		}

		if err := database.DB.Create(&newUser).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "Internal Server Error",
				"message": "Failed to create user",
			})
		}

		token, _ := utils.GenerateToken(newUser.ID, newUser.Email, newUser.Role)

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"status": "success",
			"data": fiber.Map{
				"token": token,
				"user":  newUser,
			},
		})
	}

	// Fallback mock
	token, _ := utils.GenerateToken(2, input.Email, input.Role)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status": "success",
		"data": fiber.Map{
			"token": token,
			"user": fiber.Map{
				"id":     2,
				"email":  input.Email,
				"name":   input.Name,
				"role":   input.Role,
				"status": "ACTIVE",
			},
		},
	})
}

// GetMe handles GET /api/auth/me
func GetMe(c *fiber.Ctx) error {
	userID := c.Locals("user_id")

	if database.DB != nil {
		var user models.User
		if err := database.DB.First(&user, userID).Error; err == nil {
			return c.Status(fiber.StatusOK).JSON(fiber.Map{
				"status": "success",
				"data":   user,
			})
		}
	}

	email := c.Locals("email")
	role := c.Locals("role")

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status": "success",
		"data": fiber.Map{
			"id":     userID,
			"email":  email,
			"name":   "Platform User",
			"role":   role,
			"status": "ACTIVE",
		},
	})
}

// Logout handles POST /api/auth/logout
func Logout(c *fiber.Ctx) error {
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"message": "Successfully logged out",
	})
}
