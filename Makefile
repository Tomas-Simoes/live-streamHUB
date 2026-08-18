SHELL := /bin/sh

.PHONY: install dev dev-backend dev-local-server dev-web dev-overwolf build build-backend build-local-server build-web lint-web

install:
	npm run install:all

dev:
	npm run dev

dev-backend:
	npm run dev:backend

dev-local-server:
	npm run dev:local-server

dev-web:
	npm run dev:web

dev-overwolf:
	npm run dev:overwolf

build:
	npm run build

build-backend:
	npm run build:backend

build-local-server:
	npm run build:local-server

build-web:
	npm run build:web

lint-web:
	npm run lint:web
