FROM node:20-alpine

WORKDIR /app

# Установка системных библиотек OpenSSL и совместимости libc для Prisma engine
RUN apk add --no-cache openssl libc6-compat gcompat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Генерация Prisma Client для системных целевых платформ
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm run start"]