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
COPY game-server game-server
EXPOSE 2567
CMD ["npx", "tsx", "--tsconfig", "game-server/tsconfig.json", "game-server/src/index.ts"]
