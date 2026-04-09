FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/ || exit 1
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD wget -qO- http://localhost:80/ || exit 1
