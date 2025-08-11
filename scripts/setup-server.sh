#!/bin/bash

# Скрипт для быстрой настройки сервера для AI Chat Bot
# Использование: ./scripts/setup-server.sh [server_ip] [ssh_user]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для вывода сообщений
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Проверка аргументов
if [[ $# -lt 2 ]]; then
    error "Usage: $0 <server_ip> <ssh_user> [ssh_key_path]"
fi

SERVER_IP=$1
SSH_USER=$2
SSH_KEY=${3:-~/.ssh/id_rsa}

log "Starting server setup for AI Chat Bot..."
info "Server: $SERVER_IP"
info "User: $SSH_USER"
info "SSH Key: $SSH_KEY"

# Проверка SSH ключа
if [[ ! -f "$SSH_KEY" ]]; then
    error "SSH key not found: $SSH_KEY"
fi

# Функция для выполнения команд на сервере
run_remote() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$SSH_USER@$SERVER_IP" "$1"
}

# Функция для копирования файлов на сервер
copy_to_server() {
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$1" "$SSH_USER@$SERVER_IP:$2"
}

# Проверка подключения к серверу
log "Testing SSH connection..."
if ! run_remote "echo 'SSH connection successful'"; then
    error "Failed to connect to server"
fi

# Обновление системы
log "Updating system packages..."
run_remote "apt update && apt upgrade -y"

# Установка необходимых пакетов
log "Installing required packages..."
run_remote "apt install -y curl wget git unzip htop nano vim ufw fail2ban"

# Установка Docker
log "Installing Docker..."
run_remote "
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        usermod -aG docker \$USER
        rm get-docker.sh
        echo 'Docker installed successfully'
    else
        echo 'Docker is already installed'
    fi
"

# Установка Docker Compose
log "Installing Docker Compose..."
run_remote "
    if ! command -v docker-compose &> /dev/null; then
        curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        echo 'Docker Compose installed successfully'
    else
        echo 'Docker Compose is already installed'
    fi
"

# Создание пользователя для деплоя
log "Creating deploy user..."
run_remote "
    if ! id deploy &>/dev/null; then
        useradd -m -s /bin/bash deploy
        usermod -aG docker deploy
        mkdir -p /home/deploy/.ssh
        touch /home/deploy/.ssh/authorized_keys
        chown -R deploy:deploy /home/deploy/.ssh
        chmod 700 /home/deploy/.ssh
        chmod 600 /home/deploy/.ssh/authorized_keys
        echo 'Deploy user created successfully'
    else
        echo 'Deploy user already exists'
    fi
"

# Генерация SSH ключей для деплоя (если не существуют)
log "Generating SSH keys for deployment..."
if [[ ! -f ~/.ssh/ai-chat-bot-deploy ]]; then
    ssh-keygen -t ed25519 -C "deploy@ai-chat-bot" -f ~/.ssh/ai-chat-bot-deploy -N ""
    log "SSH keys generated: ~/.ssh/ai-chat-bot-deploy"
else
    log "SSH keys already exist: ~/.ssh/ai-chat-bot-deploy"
fi

# Копирование публичного ключа на сервер
log "Setting up SSH keys for deploy user..."
PUBLIC_KEY=$(cat ~/.ssh/ai-chat-bot-deploy.pub)
run_remote "
    echo '$PUBLIC_KEY' | tee -a /home/deploy/.ssh/authorized_keys
    chown deploy:deploy /home/deploy/.ssh/authorized_keys
    chmod 600 /home/deploy/.ssh/authorized_keys
"

# Создание директорий для приложения
log "Creating application directories..."
run_remote "
    mkdir -p /opt/ai-chat-bot
    mkdir -p /opt/ai-chat-bot-staging
    chown -R deploy:deploy /opt/ai-chat-bot
    chown -R deploy:deploy /opt/ai-chat-bot-staging
"

# Настройка firewall
log "Configuring firewall..."
run_remote "
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 8080/tcp  # для staging
    ufw allow 8443/tcp  # для staging HTTPS
    ufw --force enable
"

# Настройка fail2ban
log "Configuring fail2ban..."
run_remote "
    systemctl enable fail2ban
    systemctl start fail2ban
"

# Установка Nginx (опционально)
read -p "Install Nginx? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Installing Nginx..."
    run_remote "
        apt install -y nginx
        systemctl enable nginx
        systemctl start nginx
        
        # Создание базовой конфигурации
        tee /etc/nginx/sites-available/ai-chat-bot > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
    }
    
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}

server {
    listen 8080;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
EOF
        
        ln -sf /etc/nginx/sites-available/ai-chat-bot /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        nginx -t && systemctl reload nginx
    "
fi

# Настройка логротации
log "Setting up log rotation..."
run_remote "
    tee /etc/logrotate.d/ai-chat-bot > /dev/null <<EOF
/opt/ai-chat-bot/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        docker-compose -f /opt/ai-chat-bot/docker-compose.prod.yml restart app 2>/dev/null || true
    endscript
}

/opt/ai-chat-bot-staging/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 deploy deploy
    postrotate
        docker-compose -f /opt/ai-chat-bot-staging/docker-compose.prod.yml restart app 2>/dev/null || true
    endscript
}
EOF
"

# Настройка мониторинга дискового пространства
log "Setting up disk space monitoring..."
run_remote "
    tee /usr/local/bin/check-disk-space.sh > /dev/null <<'EOF'
#!/bin/bash
THRESHOLD=85
USAGE=\$(df / | awk 'NR==2 {print \$5}' | sed 's/%//')

if [ \$USAGE -gt \$THRESHOLD ]; then
    echo \"Warning: Disk usage is \${USAGE}%\" | logger -t disk-monitor
    # Очистка Docker
    docker system prune -f --volumes 2>/dev/null || true
fi
EOF
    
    chmod +x /usr/local/bin/check-disk-space.sh
    
    # Добавление в crontab
    (crontab -l 2>/dev/null; echo '0 */6 * * * /usr/local/bin/check-disk-space.sh') | crontab -
"

# Создание скрипта для мониторинга
log "Creating monitoring script..."
run_remote "
    tee /usr/local/bin/ai-chat-bot-status.sh > /dev/null <<'EOF'
#!/bin/bash

echo '=== AI Chat Bot Status ==='
echo

echo '--- Production ---'
cd /opt/ai-chat-bot 2>/dev/null && docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo 'Not deployed'
echo

echo '--- Staging ---'
cd /opt/ai-chat-bot-staging 2>/dev/null && docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo 'Not deployed'
echo

echo '--- System Resources ---'
echo \"CPU: \$(top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d'%' -f1)% used\"
echo \"Memory: \$(free | grep Mem | awk '{printf \"%.1f%%\", \$3/\$2 * 100.0}') used\"
echo \"Disk: \$(df -h / | awk 'NR==2 {print \$5}') used\"
echo

echo '--- Docker ---'
echo \"Images: \$(docker images | wc -l) total\"
echo \"Containers: \$(docker ps -a | wc -l) total, \$(docker ps | wc -l) running\"
echo \"Volumes: \$(docker volume ls | wc -l) total\"
EOF
    
    chmod +x /usr/local/bin/ai-chat-bot-status.sh
"

# Проверка установки
log "Verifying installation..."
run_remote "
    echo '=== Verification ==='
    echo \"Docker version: \$(docker --version)\"
    echo \"Docker Compose version: \$(docker-compose --version)\"
    echo \"Deploy user: \$(id deploy)\"
    echo \"Firewall status: \$(ufw status | head -1)\"
    echo \"Nginx status: \$(systemctl is-active nginx 2>/dev/null || echo 'not installed')\"
    echo
    echo '=== Directory structure ==='
    ls -la /opt/
    echo
    echo '=== Available commands ==='
    echo '- ai-chat-bot-status.sh - Check application status'
    echo '- check-disk-space.sh - Check disk usage'
"

# Вывод информации для настройки GitHub Secrets
echo
echo -e "${BLUE}=== GitHub Secrets Configuration ===${NC}"
echo
echo "Add these secrets to your GitHub repository:"
echo
echo -e "${YELLOW}SSH_PRIVATE_KEY:${NC}"
cat ~/.ssh/ai-chat-bot-deploy
echo
echo -e "${YELLOW}SERVER_HOST:${NC} $SERVER_IP"
echo -e "${YELLOW}SERVER_USER:${NC} deploy"
echo
echo "For staging environment, use the same values with STAGING_ prefix:"
echo -e "${YELLOW}STAGING_SSH_PRIVATE_KEY:${NC} (same as above)"
echo -e "${YELLOW}STAGING_SERVER_HOST:${NC} $SERVER_IP"
echo -e "${YELLOW}STAGING_SERVER_USER:${NC} deploy"
echo

# Тестирование SSH подключения с новым ключом
log "Testing SSH connection with deploy user..."
if ssh -i ~/.ssh/ai-chat-bot-deploy -o StrictHostKeyChecking=no deploy@$SERVER_IP "echo 'Deploy user SSH connection successful'"; then
    log "✅ Deploy user SSH connection successful"
else
    error "❌ Deploy user SSH connection failed"
fi

log "🎉 Server setup completed successfully!"
echo
echo -e "${GREEN}Next steps:${NC}"
echo "1. Add the GitHub Secrets shown above to your repository"
echo "2. Configure your environment variables in GitHub Secrets"
echo "3. Push to main/master branch to trigger deployment"
echo "4. Monitor deployment in GitHub Actions"
echo
echo -e "${BLUE}Useful commands on server:${NC}"
echo "- /usr/local/bin/ai-chat-bot-status.sh"
echo "- docker-compose -f /opt/ai-chat-bot/docker-compose.prod.yml logs -f"
echo "- docker system prune -f (cleanup)"
echo
echo -e "${YELLOW}Security reminder:${NC}"
echo "- Keep your SSH keys secure"
echo "- Regularly update the server: apt update && apt upgrade"
echo "- Monitor logs and system resources"
