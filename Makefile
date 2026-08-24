SHELL := /bin/sh

.PHONY: install dev dev-backend dev-web dev-overwolf build build-backend build-web lint-web

install:
	npm run install:all

dev:
	npm run dev

dev-backend:
	npm run dev:backend

dev-web:
	npm run dev:web

dev-overwolf:
	npm run dev:overwolf

build:
	npm run build

build-backend:
	npm run build:backend

build-web:
	npm run build:web

lint-web:
	npm run lint:web
