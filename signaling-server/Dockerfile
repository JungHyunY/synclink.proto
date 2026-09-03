FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --silent

COPY index.js ./

EXPOSE 5963
ENV PORT=5963

CMD ["node", "index.js"]
