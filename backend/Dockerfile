FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем Prisma schema и генерируем клиент
COPY prisma ./prisma/
RUN npx prisma generate

# Копируем весь исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]