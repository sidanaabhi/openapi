FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/app.js"]
