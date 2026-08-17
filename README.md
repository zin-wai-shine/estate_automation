# Real Estate Automation Platform

A comprehensive platform to automate property-processing workflows from social media (Facebook) into a structured SaaS dashboard, complete with AI content generation, image enhancement, and automated republishing to Facebook and TikTok.

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
- Local ports `5173`, `8080`, `5432`, `6379` available.

## Quick Start (Development)

1. **Clone the repository and prepare environment variables:**
   ```bash
   cp .env.example .env
   ```

2. **Start the development environment using Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

3. **Verify the services are running:**
   - Frontend (Vite + React): [http://localhost:5173](http://localhost:5173)
   - Backend API (Fiber): [http://localhost:8080/health](http://localhost:8080/health)

## Architecture Overview
- **Frontend**: React.js with TypeScript and Vite.
- **Backend**: Go with Fiber (REST API) and GORM (PostgreSQL ORM).
- **Background Worker**: Go with Asynq (Redis-backed job queue).
- **Database**: PostgreSQL.
- **Cache & Queue**: Redis.

## Development Setup

The `docker-compose.yml` mounts local directories into the containers and uses `air` (for Go) and `vite` (for React) to enable hot-reloading. You can make changes to the source code locally, and the containers will automatically recompile and reload the changes.

### Services:
- `api`: Go Fiber REST API (port 8080).
- `worker`: Go Asynq background worker process.
- `frontend`: React Vite frontend (port 5173).
- `postgres`: PostgreSQL database (port 5432).
- `redis`: Redis cache and message queue (port 6379).

## Production Setup

For production deployment, an Nginx reverse proxy is used alongside multi-stage builds.

1. Ensure `.env` is configured with production secrets.
2. Build and run the production environment:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
# estate_automation
