FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN apk add --no-cache curl && npm ci --omit=dev --ignore-scripts

COPY src ./src
COPY README.md ./.env.example ./

RUN mkdir -p /app/data && addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 8080
CMD ["node", "src/index.js"]
