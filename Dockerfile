FROM node:22-bookworm-slim AS backend-dev

WORKDIR /app/src/backend

COPY src/backend/package*.json ./
RUN npm ci

COPY src/backend ./

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run start:dev"]


FROM node:22-bookworm-slim AS web-dev

WORKDIR /app/src/web

COPY src/web/package*.json ./
RUN npm ci

COPY src/web ./

EXPOSE 4200

CMD ["npm", "run", "dev"]
