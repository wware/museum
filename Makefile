.PHONY: build run dev clean stop help ts-build ts-watch ts-check

IMAGE_NAME = arcane-museum
CONTAINER_NAME = arcane-museum-server
PORT = 8080

help: ## Show this help message
	@echo "Museum of Arcane Curiosities - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

ts-build: ## Compile TypeScript to JavaScript
	npm run build

ts-watch: ## Watch TypeScript files and compile on changes
	npm run watch

ts-check: ## Type-check TypeScript without compiling
	npx tsc --noEmit

build: ts-build ## Build the Docker image (requires docker group membership)
	docker build -t $(IMAGE_NAME) .

run: ts-build ## Run the museum (tries mkdocs first, falls back to instructions)
	@if command -v mkdocs >/dev/null 2>&1; then \
		echo "Starting Museum of Arcane Curiosities with MkDocs..."; \
		echo "Visit: http://localhost:8000"; \
		mkdocs serve; \
	else \
		echo "MkDocs not found. Please run one of:"; \
		echo "  sudo apt install -y mkdocs mkdocs-material   # Install MkDocs"; \
		echo "  make docker-run                               # Use Docker (requires docker group)"; \
		echo ""; \
		echo "See INSTALL.md for details."; \
		exit 1; \
	fi

docker-run: ## Run with Docker (requires docker group membership)
	@echo "Starting Museum of Arcane Curiosities with Docker..."
	@echo "Visit: http://localhost:$(PORT)"
	docker run --rm --name $(CONTAINER_NAME) -p $(PORT):80 $(IMAGE_NAME)

run-bg: ## Run the museum in background
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):80 $(IMAGE_NAME)
	@echo "Museum running in background at http://localhost:$(PORT)"

stop: ## Stop the background container
	docker stop $(CONTAINER_NAME) || true
	docker rm $(CONTAINER_NAME) || true

dev: ts-build ## Start development server (requires mkdocs)
	@command -v mkdocs >/dev/null 2>&1 || { echo "Error: mkdocs not found. Run: pip install -r requirements.txt"; exit 1; }
	mkdocs serve

install: ## Install all dependencies (Python + Node.js)
	pip install -r requirements.txt
	npm install

clean: ## Clean build artifacts
	rm -rf site/
	rm -rf docs/js/*.js docs/js/*.js.map
	docker rmi $(IMAGE_NAME) 2>/dev/null || true

rebuild: clean build ## Clean and rebuild everything

logs: ## Show container logs
	docker logs -f $(CONTAINER_NAME)

shell: ## Open shell in running container
	docker exec -it $(CONTAINER_NAME) sh

test-build: ## Test build without running
	mkdocs build --strict

all: build run ## Build and run

.DEFAULT_GOAL := help
