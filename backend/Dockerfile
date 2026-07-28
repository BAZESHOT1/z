FROM node:20-alpine
# Устанавливаем зависимости для Prisma и компиляции
RUN apk add --no-cache openssl libc6-compat gcompat

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .

EXPOSE 3000
# Используем dev команду, так как в docker-compose указан запуск через ts-node
CMD ["sh", "-c", "npx prisma db push && npm run dev"]