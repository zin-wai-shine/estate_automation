package main

import (
	"log"
	"os"

	"github.com/hibiken/asynq"
)

func main() {
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "redis:6379"
	}

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
				"low":      1,
			},
		},
	)

	mux := asynq.NewServeMux()
	// mux.HandleFunc("email:deliver", HandleEmailDeliveryTask)

	log.Println("Starting Asynq worker on Redis:", redisAddr)
	if err := srv.Run(mux); err != nil {
		log.Fatalf("Could not start worker server: %v", err)
	}
}
