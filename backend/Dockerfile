FROM node:20-alpine AS base

WORKDIR /app

# Install build tools to compile native modules
RUN apk add --no-cache python3 make g++ && ln -sf /usr/bin/python3 /usr/bin/python

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production

EXPOSE 4000

# Default command runs the API; docker-compose overrides this for the worker service.
CMD ["node", "src/server.js"]
