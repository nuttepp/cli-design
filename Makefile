.PHONY: setup dev build start test lint clean help

# Default target
.DEFAULT_GOAL := help

##@ Setup

setup: ## Install dependencies
	npm install

##@ Development

dev: ## Start the development server (http://localhost:3000)
	npm run dev

build: ## Build the production bundle
	npm run build

start: ## Start the production server (requires build first)
	npm run start

##@ Quality

test: lint type-check ## Run all checks (lint + type-check)

lint: ## Run ESLint via Next.js
	npm run lint

type-check: ## Run TypeScript type checking
	npx tsc --noEmit

##@ Maintenance

clean: ## Remove build artifacts and dependencies
	rm -rf .next out node_modules

clean-build: ## Remove only the build output (.next and out)
	rm -rf .next out

##@ Help

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
