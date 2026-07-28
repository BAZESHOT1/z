FROM node:20-alpine
# Устанавливаем git и docker-cli, чтобы контейнер мог управлять собой
RUN apk add --no-cache openssl libc6-compat gcompat git docker-cli docker-cli-compose

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
COPY . .

EXPOSE 3000
# npx prisma db push синхронизирует схему БЕЗ удаления данных (если это возможно)
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run dev"]