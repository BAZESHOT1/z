FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat gcompat git

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
COPY . .

# Генерируем клиент и пушим схему в БД перед стартом
EXPOSE 3000
CMD ["sh", "-c", "npx prisma generate && npx prisma db push && npm run dev"]