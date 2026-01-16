# Home Dev Server Quick Start Checklist

This is a condensed checklist version of the [full implementation plan](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md). Use this for quick reference during setup.

---

## Pre-Setup Checklist

- [ ] Hardware acquired (4+ cores, 16GB+ RAM, 256GB+ SSD)
- [ ] Ubuntu Server 22.04 LTS downloaded
- [ ] Bootable USB created
- [ ] Static IP planned (e.g., 192.168.1.100)
- [ ] All passwords/secrets prepared

---

## Day 1: Base System Setup

### OS Installation
- [ ] Boot from USB and install Ubuntu Server 22.04 LTS
- [ ] Create user account
- [ ] Configure network (static IP or DHCP reservation)
- [ ] Complete installation and reboot

### Initial Configuration
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y build-essential git curl wget vim htop tmux

# Configure firewall
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow 5000/tcp comment 'Meowstik'
sudo ufw enable
```

### SSH Setup
```bash
# On local machine
ssh-keygen -t ed25519
ssh-copy-id username@192.168.1.100

# On server
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no, PasswordAuthentication no
sudo systemctl restart sshd
```

### Security
```bash
# Install fail2ban
sudo apt install -y fail2ban unattended-upgrades
sudo systemctl enable fail2ban
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Day 2: Software Stack

### Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify v20.x
```

### PostgreSQL 16
```bash
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
```

### Database Configuration
```bash
sudo -u postgres psql
```
```sql
CREATE USER meowstik WITH PASSWORD 'your_secure_password';
CREATE DATABASE meowstik OWNER meowstik;
GRANT ALL PRIVILEGES ON DATABASE meowstik TO meowstik;
\c meowstik
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
\q
```

### Supporting Tools
```bash
# FFmpeg, Chromium, Xvfb
sudo apt install -y ffmpeg chromium-browser xvfb x11vnc \
  libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
  fonts-liberation fonts-noto-color-emoji

# Optional: PM2
sudo npm install -g pm2
```

---

## Day 3: Application Setup

### Clone Repository
```bash
sudo mkdir -p /opt/meowstik
sudo chown $USER:$USER /opt/meowstik
cd /opt/meowstik
git clone https://github.com/jasonbender-c3x/Meowstik.git .
```

### Install Dependencies
```bash
npm install
```

### Configure Environment
```bash
cp .env.example .env
nano .env
```

**Essential `.env` values**:
```bash
PORT=5000
NODE_ENV=production
HOME_DEV_MODE=true
HOME_DEV_EMAIL=your-email@example.com
DATABASE_URL=postgresql://meowstik:your_password@localhost:5432/meowstik
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://192.168.1.100:5000/api/auth/google/callback
GOOGLE_APPLICATION_CREDENTIALS=/opt/meowstik/secrets/service-account.json
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
SESSION_SECRET=$(openssl rand -hex 32)
```

### Setup Secrets
```bash
mkdir -p /opt/meowstik/secrets
chmod 700 /opt/meowstik/secrets
cp ~/service-account.json /opt/meowstik/secrets/
chmod 600 /opt/meowstik/secrets/service-account.json
```

### Initialize Database
```bash
npm run db:push
```

### Build & Test
```bash
npm run build
npm run dev  # Test in development mode
# Access: http://192.168.1.100:5000
```

---

## Day 4: Production Deployment

### Option A: PM2 (Simple)
```bash
pm2 start npm --name meowstik -- start
pm2 save
pm2 startup systemd
# Follow the command it outputs
```

### Option B: Docker (Advanced)

#### Install Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

#### Create docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./secrets:/app/secrets:ro
    depends_on:
      - db
    restart: unless-stopped
  
  db:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_USER=meowstik
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=meowstik
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

#### Deploy
```bash
docker compose up -d --build
docker compose logs -f app
```

---

## Day 5: Monitoring & Backups

### Automated Backups
```bash
mkdir -p /opt/meowstik/backups
nano /opt/meowstik/scripts/backup-db.sh
```

**backup-db.sh**:
```bash
#!/bin/bash
BACKUP_DIR="/opt/meowstik/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/meowstik_$TIMESTAMP.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /opt/meowstik/scripts/backup-db.sh
crontab -e
# Add: 0 2 * * * /opt/meowstik/scripts/backup-db.sh
```

### Monitoring (Optional)
```bash
# Basic monitoring commands
htop                    # System resources
pm2 monit              # PM2 process monitor
docker stats           # Docker container stats
sudo journalctl -fu meowstik  # System logs
```

---

## Quick Commands Reference

### Application Management

```bash
# PM2
pm2 restart meowstik
pm2 stop meowstik
pm2 logs meowstik
pm2 monit

# Docker
docker compose up -d
docker compose down
docker compose logs -f app
docker compose restart app

# Development
npm run dev          # Dev server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Update database schema
```

### Database

```bash
# Connect
psql postgresql://meowstik:password@localhost:5432/meowstik

# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql

# Size
psql -d meowstik -c "SELECT pg_size_pretty(pg_database_size('meowstik'));"
```

### System

```bash
# Updates
sudo apt update && sudo apt upgrade -y

# Disk space
df -h
du -sh /opt/meowstik/*

# Logs
tail -f /var/log/syslog
journalctl -fu meowstik
pm2 logs meowstik

# Network
sudo netstat -tulpn | grep :5000
curl http://localhost:5000/api/health
```

---

## Troubleshooting Quick Fixes

### Application Won't Start
```bash
# Check logs
pm2 logs meowstik
docker compose logs app

# Verify environment
cat .env | grep -v PASSWORD

# Reinstall dependencies
rm -rf node_modules && npm install
```

### Database Connection Failed
```bash
# Check PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Test connection
psql $DATABASE_URL
```

### Port Already in Use
```bash
# Find process
sudo lsof -i :5000

# Kill process
sudo kill -9 <PID>
```

### Permission Errors
```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/meowstik

# Fix secrets
chmod 700 /opt/meowstik/secrets
chmod 600 /opt/meowstik/secrets/*
```

---

## Next Steps

After completing this checklist:

1. **Test All Features**: Chat, Google integrations, code editor, voice
2. **Setup SSL**: Use Caddy or certbot for HTTPS
3. **Configure CI/CD**: GitHub Actions for auto-deployment
4. **Monitor Resources**: Setup Prometheus/Grafana (optional)
5. **Document Changes**: Keep notes on customizations

---

## Support

- **Full Guide**: [HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md)
- **Local Development**: [local-development.md](./local-development.md)
- **Platform Independence**: [roadmap-platform-independence.md](./roadmap-platform-independence.md)
- **GitHub Issues**: [Meowstik Repository](https://github.com/jasonbender-c3x/Meowstik/issues)

---

**Estimated Setup Time**: 3-5 days (depending on experience level)

**Cost Estimate**: $400-1200 (hardware) + $0 (software - all open source)
