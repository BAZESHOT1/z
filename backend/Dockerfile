FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat gcompat

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .

EXPOSE 3000
# Мастер-нода сама пушит схему при старте
CMD ["npm", "run", "dev"]