# ====== СБОРКА ======
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходники
COPY . .

# Аргументы для сборки
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_APP_NAME

# Устанавливаем переменные окружения
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

# Собираем веб-версию
RUN npm run build:web || npx expo export -p web

# ====== NGINX ======
FROM nginx:alpine

# Копируем собранные файлы
COPY --from=builder /app/dist /usr/share/nginx/html

# Копируем конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]