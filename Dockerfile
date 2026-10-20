# One container that hosts the whole game: the web client and the multiplayer server.
#   docker build -t beaver-banff . && docker run -p 2567:2567 -v beaver-data:/data beaver-banff
FROM node:22-alpine
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
COPY client client
RUN node client/build.mjs hosted
ENV PORT=2567 DATA_FILE=/data/players.json NODE_ENV=production
EXPOSE 2567
CMD ["npx", "tsx", "--tsconfig", "game-server/tsconfig.json", "game-server/src/index.ts"]
