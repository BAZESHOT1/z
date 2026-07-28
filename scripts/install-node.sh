#!/bin/bash

echo "🚀 Z-Network Node Installer"
echo "--------------------------"

# Проверка Docker
if ! [ -x "$(command -v docker)" ]; then
  echo "📦 Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
fi

# Запрос данных
read -p "Enter your Z-Social username: " Z_USER
read -sp "Enter your Z-Social password: " Z_PASS
echo ""

# Валидация пользователя через Master-ноду
AUTH_RES=$(curl -s -X POST http://82.26.152.225:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$Z_USER\", \"password\":\"$Z_PASS\"}")

if [[ $AUTH_RES == *"error"* ]]; then
  echo "❌ Invalid credentials. Registration aborted."
  exit 1
fi

# Клонирование и настройка
git clone https://github.com/your-repo/z-social.git z-node
cd z-node

# Генерация уникального ID ноды
NODE_ID="community_$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 12 | head -n 1)"

cat <<EOF > .env
IS_MASTER_NODE=false
NODE_ID=$NODE_ID
NODE_OWNER=$Z_USER
MASTER_NODE_URL=http://82.26.152.225:4000
CLUSTER_SECRET=mesh_network_shared_secret
AUTO_UPDATE=true
REPO_URL=https://github.com/your-repo/z-social.git
EOF

echo "🏗️ Starting containers..."
docker compose up -d

echo "✅ Node $NODE_ID successfully deployed and bound to user $Z_USER!"
echo "You are now supporting the network and earning rewards."