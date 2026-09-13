FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build:css

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package*.json ./
COPY --from=build /app/static ./static
COPY --from=build /app/server ./server
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "server/index.js"]