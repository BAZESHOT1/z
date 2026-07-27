FROM node:18-alpine

WORKDIR /app

# Устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходники
COPY . .

# Генерируем Prisma Client
RUN npx prisma generate

# Собираем TypeScript
RUN npm run build

EXPOSE 3000

# Запускаем
CMD ["node", "dist/app.js"]