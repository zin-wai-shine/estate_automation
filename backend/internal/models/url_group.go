package models

import "time"

// UrlGroup represents a stored group of property/post links entered together as one batch
type UrlGroup struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Serial    string    `gorm:"type:varchar(50);index" json:"serial"`
	RawText   string    `gorm:"type:text;not null" json:"raw_text"`
	UrlsJSON  string    `gorm:"type:text" json:"urls_json"`
	UrlCount  int       `gorm:"default:0" json:"url_count"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
