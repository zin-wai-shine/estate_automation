package models

import (
	"time"

	"gorm.io/gorm"
)

type RoleName string

const (
	RoleAdmin  RoleName = "ADMIN"
	RoleAgent  RoleName = "AGENT"
	RoleEditor RoleName = "EDITOR"
	RoleViewer RoleName = "VIEWER"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Email     string         `gorm:"uniqueIndex;not null" json:"email"`
	Password  string         `gorm:"not null" json:"-"`
	Name      string         `gorm:"not null" json:"name"`
	Role      RoleName       `gorm:"type:varchar(20);default:'AGENT';not null" json:"role"`
	Status    string         `gorm:"type:varchar(20);default:'ACTIVE';not null" json:"status"`
	AvatarURL string         `json:"avatar_url,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type RolePermission struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Role       RoleName  `gorm:"type:varchar(20);not null;index" json:"role"`
	Permission string    `gorm:"type:varchar(50);not null" json:"permission"`
	CreatedAt  time.Time `json:"created_at"`
}

type SystemSetting struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Key         string    `gorm:"uniqueIndex;not null" json:"key"`
	Value       string    `gorm:"type:text" json:"value"`
	Description string    `json:"description"`
	UpdatedAt   time.Time `json:"updated_at"`
}
