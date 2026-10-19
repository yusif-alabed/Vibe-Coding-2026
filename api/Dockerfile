FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY game-server/package.json game-server/
COPY api/package.json api/
COPY client/package.json client/
RUN npm install --workspaces --include-workspace-root
COPY tsconfig.base.json ./
COPY shared shared
COPY api api
EXPOSE 3001
CMD ["sh", "-c", "npx tsx --tsconfig api/tsconfig.json api/src/migrate.ts && npx tsx --tsconfig api/tsconfig.json api/src/index.ts"]
