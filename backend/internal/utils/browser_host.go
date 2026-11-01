package utils

import (
	"fmt"
	"net"
	"os"
	"time"
)

// GetBrowserWorkerHost returns the resolvable host for the browser worker (e.g. browser-worker, host.docker.internal, or localhost)
func GetBrowserWorkerHost() string {
	envHost := os.Getenv("BROWSER_WORKER_HOST")
	if envHost != "" && envHost != "host.docker.internal" {
		return envHost
	}

	if _, err := os.Stat("/.dockerenv"); err == nil {
		// Inside Docker: check if browser-worker container is responsive on the internal network
		conn, err := net.DialTimeout("tcp", "browser-worker:9223", 400*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return "browser-worker"
		}
		// Fallback: check if host.docker.internal:9223 is responsive (native host Chrome mode)
		connHost, errHost := net.DialTimeout("tcp", "host.docker.internal:9223", 400*time.Millisecond)
		if errHost == nil {
			_ = connHost.Close()
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
