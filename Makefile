## Makefile to run backend and frontend

.PHONY: up-backend up-frontend up-all stop-backend stop-frontend

up-backend:
	docker-compose -f backend/docker-compose.yml up --build

stop-backend:
	docker-compose -f backend/docker-compose.yml down

up-frontend:
	cd frontend && pnpm install && pnpm dev

up-all:
	# Runs backend (docker) and frontend in parallel (frontend uses host port 4173)
	$(MAKE) up-backend &
	$(MAKE) up-frontend

stop-frontend:
	# Stop frontend by terminating the dev process in your terminal
	@echo "Stop the frontend dev server with Ctrl+C in its terminal"

dev:
	./dev.sh
