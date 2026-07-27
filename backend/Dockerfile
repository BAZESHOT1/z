FROM node:20-alpine

WORKDIR /app

# Установка системных библиотек OpenSSL для работы Prisma engine
RUN apk add --no-cache openssl openssl1.1-compat libc6-compat

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Генерация Prisma Client с новыми binaryTargets
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npm run start"]