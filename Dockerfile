FROM node:24-alpine
WORKDIR /app
COPY package.json* ./
COPY server ./server
COPY css ./css
COPY js ./js
COPY index.html ./index.html
ENV NODE_ENV=production
ENV PORT=8100
ENV HOST=0.0.0.0
EXPOSE 8100
VOLUME ["/app/data"]
CMD ["node", "server/index.mjs"]