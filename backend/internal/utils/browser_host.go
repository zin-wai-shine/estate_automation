package utils

import (
	"fmt"
	"net"
	"os"
	"time"
)

// GetBrowserWorkerHost returns the resolvable host for the browser worker (e.g. host.docker.internal or browser-worker)
func GetBrowserWorkerHost() string {
	host := os.Getenv("BROWSER_WORKER_HOST")
	if host != "" {
		return host
	}
	if _, err := os.Stat("/.dockerenv"); err == nil {
		// Inside Docker: check if host.docker.internal:9223 is responsive (native host Chrome mode)
		conn, err := net.DialTimeout("tcp", "host.docker.internal:9223", 300*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return "host.docker.internal"
		}
		return "browser-worker"
	}
	return "localhost"
}

// GetBrowserWorkerURL returns the base HTTP URL for the browser worker
func GetBrowserWorkerURL() string {
	customURL := os.Getenv("BROWSER_WORKER_URL")
	if customURL != "" {
		return customURL
	}
	return fmt.Sprintf("http://%s:9223", GetBrowserWorkerHost())
}
