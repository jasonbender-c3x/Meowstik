# Home Development Server Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for migrating the Meowstik application from Replit to a self-hosted home development server. The plan covers hardware specifications, operating system selection, networking, security, and the complete software stack required to run the application in a production-like environment at home.

## Table of Contents

1. [Hardware Specifications](#1-hardware-specifications)
2. [Operating System Selection](#2-operating-system-selection)
3. [Networking Configuration](#3-networking-configuration)
4. [Security & Firewall Setup](#4-security--firewall-setup)
5. [Software Stack Installation](#5-software-stack-installation)
6. [Database Setup](#6-database-setup)
7. [Application Configuration](#7-application-configuration)
8. [Docker & Containerization](#8-docker--containerization)
9. [SSL/TLS Certificates](#9-ssltls-certificates)
10. [Monitoring & Logging](#10-monitoring--logging)
11. [Backup & Recovery](#11-backup--recovery)
12. [CI/CD Pipeline](#12-cicd-pipeline)
13. [Maintenance & Updates](#13-maintenance--updates)
14. [Migration Steps](#14-migration-steps)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Hardware Specifications

### Minimum Requirements

| Component | Specification | Reasoning |
|-----------|--------------|-----------|
| **CPU** | 4 cores / 8 threads @ 2.5+ GHz | Node.js, PostgreSQL, and AI workloads benefit from multi-threading |
| **RAM** | 16 GB DDR4 | Database, Node.js server, browser automation (Playwright/Chromium) |
| **Storage** | 256 GB SSD (NVMe preferred) | Fast I/O for database operations and file uploads |
| **Network** | Gigabit Ethernet (1 Gbps) | Fast data transfer, API calls to Google services |
| **Power Supply** | UPS recommended | Protect against power outages and data loss |

### Recommended Specifications

| Component | Specification | Benefits |
|-----------|--------------|----------|
| **CPU** | 8+ cores / 16 threads @ 3.0+ GHz | Better performance for parallel builds, AI workloads |
| **RAM** | 32 GB DDR4/DDR5 | Headroom for multiple services, caching, development |
| **Storage** | 512 GB+ NVMe SSD | Additional space for logs, backups, Docker images |
| **GPU** | Integrated graphics (Intel/AMD) | Sufficient for headless Chrome, no dedicated GPU needed |
| **Network** | 10 Gbps or dual NICs | Redundancy and higher throughput |

### Hardware Recommendations by Use Case

#### Development-Only Server
- **Mini PC**: Intel NUC 13 Pro, Beelink Mini S12, or similar
- **Cost**: $400-700
- **Benefits**: Compact, low power consumption, quiet operation

#### Development + Production Staging
- **Desktop Build**: AMD Ryzen 7 or Intel i7 system
- **Cost**: $800-1200
- **Benefits**: Upgradeable, better cooling, more expansion options

#### High-Availability Production
- **Server Hardware**: Dell PowerEdge, HPE ProLiant, or Supermicro
- **Cost**: $1500-3000
- **Benefits**: ECC RAM, redundant power, enterprise support

---

## 2. Operating System Selection

### Recommended: Ubuntu Server 22.04 LTS

**Why Ubuntu Server?**
- **Long-term Support**: 5 years of security updates (until 2027)
- **Package Management**: APT package manager with extensive repositories
- **Community Support**: Largest Linux server community
- **Docker Support**: First-class Docker and container support
- **Performance**: Lightweight, no GUI overhead
- **Node.js Compatibility**: Excellent Node.js 20 support via NodeSource

### Alternative Options

#### Option A: Debian 12 (Bookworm)
- **Pros**: More stable, less frequent updates, smaller footprint
- **Cons**: Slightly older packages, smaller community than Ubuntu
- **Use Case**: Maximum stability for production

#### Option B: Rocky Linux 9 / AlmaLinux 9
- **Pros**: RHEL compatibility, enterprise-focused, SELinux
- **Cons**: Steeper learning curve, different package manager (DNF)
- **Use Case**: Enterprise environments, existing RHEL infrastructure

#### Option C: Arch Linux
- **Pros**: Rolling release, cutting-edge packages, AUR
- **Cons**: Less stable, requires more maintenance
- **Use Case**: Advanced users, experimental features

### Installation Type

**Recommended**: Ubuntu Server 22.04 LTS (Minimal Install)

```bash
# Download ISO
wget https://releases.ubuntu.com/22.04/ubuntu-22.04.5-live-server-amd64.iso

# Create bootable USB (Linux)
sudo dd if=ubuntu-22.04.5-live-server-amd64.iso of=/dev/sdX bs=4M status=progress

# Create bootable USB (macOS)
sudo dd if=ubuntu-22.04.5-live-server-amd64.iso of=/dev/diskX bs=4m

# Create bootable USB (Windows)
# Use Rufus: https://rufus.ie/
```

### Partitioning Scheme

```
/boot/efi    512 MB    (EFI System Partition)
/            50 GB     (Root filesystem)
/home        50 GB     (User data)
/var         100 GB    (Logs, Docker volumes, PostgreSQL data)
swap         16 GB     (Equal to RAM or more for hibernation)
```

---

## 3. Networking Configuration

### Static IP Configuration

#### Option 1: Using Netplan (Ubuntu/Debian)

Edit `/etc/netplan/01-netcfg.yaml`:

```yaml
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
          - 1.1.1.1
```

Apply configuration:
```bash
sudo netplan apply
sudo netplan --debug apply  # If errors occur
```

#### Option 2: Router DHCP Reservation

More flexible - set a DHCP reservation in your router for the server's MAC address:
1. Access router admin panel (usually http://192.168.1.1)
2. Navigate to DHCP settings
3. Add reservation: `MAC Address -> Desired IP (e.g., 192.168.1.100)`
4. Reboot server or renew DHCP lease: `sudo dhclient -r && sudo dhclient`

### DNS Configuration

#### Local DNS (Recommended for Development)

Edit `/etc/hosts` on all development machines:
```
192.168.1.100   meowstik.local
192.168.1.100   dev.meowstik.local
192.168.1.100   api.meowstik.local
```

#### mDNS/Avahi (Zero-Configuration)

```bash
sudo apt install avahi-daemon avahi-utils
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
```

Server is now accessible at: `meowstik-server.local`

#### Local DNS Server (Advanced)

Install dnsmasq or bind9 for custom domain resolution across your network.

### Port Configuration

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Meowstik Web | 5000 | HTTP | Main application |
| Meowstik API | 5001 | HTTP | Optional separate API server |
| PostgreSQL | 5432 | TCP | Database (internal only) |
| SSH | 22 | TCP | Remote administration |
| HTTPS | 443 | HTTPS | SSL-enabled web access |
| HTTP | 80 | HTTP | Redirect to HTTPS |
| Caddy Admin | 2019 | HTTP | Reverse proxy admin (localhost only) |
| Prometheus | 9090 | HTTP | Metrics (optional) |
| Grafana | 3000 | HTTP | Monitoring dashboard (optional) |

---

## 4. Security & Firewall Setup

### UFW (Uncomplicated Firewall)

```bash
# Install UFW (usually pre-installed on Ubuntu)
sudo apt update
sudo apt install ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT: do this first!)
sudo ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Allow Meowstik application (if needed externally)
sudo ufw allow 5000/tcp comment 'Meowstik Web'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### SSH Hardening

#### 1. Disable Root Login & Password Authentication

Edit `/etc/ssh/sshd_config`:
```bash
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
```

#### 2. Generate SSH Key Pair (on client machine)

```bash
# On your local development machine
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy to server
ssh-copy-id -i ~/.ssh/id_ed25519.pub username@192.168.1.100
```

#### 3. Restart SSH Service

```bash
sudo systemctl restart sshd
sudo systemctl status sshd
```

#### 4. Test SSH Connection

```bash
# From client machine
ssh username@192.168.1.100
```

### Fail2Ban (Brute-Force Protection)

```bash
# Install fail2ban
sudo apt install fail2ban

# Configure SSH jail
sudo tee /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
backend = systemd
EOF

# Enable and start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

### Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades

# Configure automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Edit configuration (optional)
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

Recommended settings in `/etc/apt/apt.conf.d/50unattended-upgrades`:
```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
```

### SELinux / AppArmor

Ubuntu comes with AppArmor enabled by default. Check status:
```bash
sudo aa-status
```

Keep AppArmor enabled for additional security isolation.

---

## 5. Software Stack Installation

### 5.1 System Updates

```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
```

### 5.2 Essential Build Tools

```bash
sudo apt install -y \
  build-essential \
  git \
  curl \
  wget \
  vim \
  htop \
  tree \
  tmux \
  ca-certificates \
  gnupg \
  lsb-release
```

### 5.3 Node.js 20 (via NodeSource)

```bash
# Download and run NodeSource setup script
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js 20
sudo apt install -y nodejs

# Verify installation
node --version   # Should output v20.x.x
npm --version    # Should output 10.x.x or higher
```

### 5.4 PostgreSQL 16

```bash
# Add PostgreSQL APT repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import repository signing key
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update package lists
sudo apt update

# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Verify installation
sudo systemctl status postgresql
psql --version   # Should output 16.x
```

### 5.5 Git Configuration

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
git config --global init.defaultBranch main
git config --global pull.rebase false
```

### 5.6 FFmpeg (for Audio Processing)

```bash
sudo apt install -y ffmpeg

# Verify installation
ffmpeg -version
```

### 5.7 Chromium & Playwright Dependencies

```bash
# Install Chromium and dependencies for headless browser automation
sudo apt install -y \
  chromium-browser \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libatspi2.0-0 \
  libcups2 \
  libxshmfence1 \
  fonts-liberation \
  fonts-noto-color-emoji

# Verify Chromium
chromium-browser --version
```

### 5.8 Xvfb (Virtual Framebuffer for Headless Display)

```bash
sudo apt install -y xvfb x11vnc

# Optional: Create systemd service for Xvfb
sudo tee /etc/systemd/system/xvfb.service <<EOF
[Unit]
Description=X Virtual Framebuffer
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset
Restart=always
User=nobody

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable xvfb
sudo systemctl start xvfb
```

### 5.9 Optional: PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the command it outputs

# Verify PM2
pm2 --version
```

---

## 6. Database Setup

### 6.1 PostgreSQL Configuration

#### Create Database User

```bash
# Switch to postgres user
sudo -u postgres psql

# Create user and database
CREATE USER meowstik WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE meowstik OWNER meowstik;
GRANT ALL PRIVILEGES ON DATABASE meowstik TO meowstik;

# Enable extensions
\c meowstik
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- If using pgvector for RAG

# Exit psql
\q
```

#### Configure PostgreSQL for Remote Access (Optional)

Edit `/etc/postgresql/16/main/postgresql.conf`:
```
listen_addresses = 'localhost'  # Keep localhost-only for security
# Or for specific IP: listen_addresses = '192.168.1.100'
```

Edit `/etc/postgresql/16/main/pg_hba.conf`:
```
# Local connections
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# Optional: Allow from local network
host    meowstik        meowstik        192.168.1.0/24          scram-sha-256
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

#### Test Database Connection

```bash
# Test local connection
psql -U meowstik -d meowstik -h localhost

# Test with connection string
psql "postgresql://meowstik:your_secure_password_here@localhost:5432/meowstik"
```

### 6.2 Database Performance Tuning

Edit `/etc/postgresql/16/main/postgresql.conf`:

```conf
# Memory Settings (for 16GB RAM)
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 64MB

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB
min_wal_size = 1GB
max_wal_size = 4GB

# Query Tuning
random_page_cost = 1.1  # SSD
effective_io_concurrency = 200  # SSD

# Connection Settings
max_connections = 100
```

Apply changes:
```bash
sudo systemctl restart postgresql
```

### 6.3 pgvector Extension (for RAG/Vector Storage)

```bash
# Install pgvector from source
sudo apt install -y postgresql-server-dev-16 git build-essential

# Clone and install
cd /tmp
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Enable in database
sudo -u postgres psql -d meowstik -c "CREATE EXTENSION vector;"
```

---

## 7. Application Configuration

### 7.1 Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/meowstik
sudo chown $USER:$USER /opt/meowstik

# Clone repository
cd /opt/meowstik
git clone https://github.com/jasonbender-c3x/Meowstik.git .

# Or use SSH
# git clone git@github.com:jasonbender-c3x/Meowstik.git .
```

### 7.2 Install Dependencies

```bash
cd /opt/meowstik
npm install
```

### 7.3 Environment Configuration

Create `.env` file:

```bash
cp .env.example .env
nano .env
```

**Complete `.env` configuration**:

```bash
# Server Configuration
PORT=5000
NODE_ENV=production  # Change to 'development' for dev mode

# Home Dev Mode (for local development only)
HOME_DEV_MODE=true
HOME_DEV_EMAIL=jason@oceanshorestech.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://meowstik:your_secure_password_here@localhost:5432/meowstik

# Google Cloud Project
GOOGLE_CLOUD_PROJECT=your-gcp-project-id

# Google OAuth2 (for user authentication)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://192.168.1.100:5000/api/auth/google/callback
# For production: https://meowstik.yourdomain.com/api/auth/google/callback

# Google Cloud Service Account (for TTS and other services)
GOOGLE_APPLICATION_CREDENTIALS=/opt/meowstik/secrets/service-account.json

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# GitHub Integration (optional)
GITHUB_TOKEN=ghp_your_github_token

# Twilio (optional)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
OWNER_PHONE_NUMBER=+1234567890
OWNER_USER_ID=your_user_id

# Browserbase (optional)
BROWSERBASE_API_KEY=your_browserbase_api_key
BROWSERBASE_PROJECT_ID=your_browserbase_project_id

# Session Secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your_random_32_character_string_here

# Playwright/Chromium
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 7.4 Secure Secrets Directory

```bash
# Create secrets directory
mkdir -p /opt/meowstik/secrets
chmod 700 /opt/meowstik/secrets

# Copy service account JSON
cp ~/ai-stack-xxx.json /opt/meowstik/secrets/service-account.json
chmod 600 /opt/meowstik/secrets/service-account.json
```

### 7.5 Database Schema Initialization

```bash
cd /opt/meowstik
npm run db:push
```

### 7.6 Build Application

```bash
npm run build
```

### 7.7 Test Application

```bash
# Development mode
npm run dev

# Production mode
npm run start
```

Access application at: `http://192.168.1.100:5000`

---

## 8. Docker & Containerization

### 8.1 Install Docker

```bash
# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 8.2 Create Dockerfile

Create `/opt/meowstik/Dockerfile`:

```dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    ffmpeg \
    libasound2 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    fonts-liberation \
    fonts-noto-color-emoji \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Build application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Start application
CMD ["npm", "start"]
```

### 8.3 Create docker-compose.yml

Create `/opt/meowstik/docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: meowstik-app
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://meowstik:${DB_PASSWORD}@db:5432/meowstik
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
      - SESSION_SECRET=${SESSION_SECRET}
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./secrets:/app/secrets:ro
      - /tmp/.X11-unix:/tmp/.X11-unix:rw
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - meowstik-network

  db:
    image: pgvector/pgvector:pg16
    container_name: meowstik-db
    environment:
      - POSTGRES_USER=meowstik
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=meowstik
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - meowstik-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meowstik"]
      interval: 10s
      timeout: 5s
      retries: 5

  caddy:
    image: caddy:2-alpine
    container_name: meowstik-caddy
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - meowstik-network

volumes:
  postgres_data:
  caddy_data:
  caddy_config:

networks:
  meowstik-network:
    driver: bridge
```

### 8.4 Create Caddyfile

Create `/opt/meowstik/Caddyfile`:

```
# Local development
:80 {
    reverse_proxy app:5000
}

# Production with domain
# meowstik.yourdomain.com {
#     reverse_proxy app:5000
#     encode gzip
#     log {
#         output file /var/log/caddy/access.log
#     }
# }
```

### 8.5 Docker Compose Commands

```bash
# Build and start services
docker compose up -d --build

# View logs
docker compose logs -f app

# Stop services
docker compose down

# Rebuild and restart
docker compose up -d --build --force-recreate

# Database shell
docker compose exec db psql -U meowstik -d meowstik

# Application shell
docker compose exec app /bin/bash
```

---

## 9. SSL/TLS Certificates

### Option 1: Let's Encrypt with Caddy (Automatic)

Caddy automatically obtains and renews SSL certificates if you have a public domain.

Update `Caddyfile`:
```
meowstik.yourdomain.com {
    reverse_proxy app:5000
}
```

**Requirements**:
- Domain pointing to your public IP
- Port 80 and 443 open on your router and firewall

### Option 2: Self-Signed Certificate (Local Development)

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 \
  -nodes -keyout /opt/meowstik/secrets/meowstik.key \
  -out /opt/meowstik/secrets/meowstik.crt \
  -subj "/CN=meowstik.local" \
  -addext "subjectAltName=DNS:meowstik.local,DNS:*.meowstik.local,IP:192.168.1.100"
```

Update `Caddyfile`:
```
https://meowstik.local:443 {
    tls /app/secrets/meowstik.crt /app/secrets/meowstik.key
    reverse_proxy app:5000
}
```

### Option 3: Let's Encrypt with Certbot (Manual)

```bash
# Install Certbot
sudo apt install certbot

# Obtain certificate (HTTP-01 challenge)
sudo certbot certonly --standalone -d meowstik.yourdomain.com

# Certificates are saved to:
# /etc/letsencrypt/live/meowstik.yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/meowstik.yourdomain.com/privkey.pem

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 10. Monitoring & Logging

### 10.1 System Monitoring with Prometheus + Grafana (Optional)

Create `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks:
      - meowstik-network

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - meowstik-network

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    restart: unless-stopped
    networks:
      - meowstik-network

volumes:
  prometheus_data:
  grafana_data:

networks:
  meowstik-network:
    external: true
```

### 10.2 Application Logging

Logs are stored in `/opt/meowstik/logs/`:
- `Short_Term_Memory.md` - AI memory
- `cache.md` - Thought cache
- `execution.md` - Execution logs
- `personal.md` - Personal notes

### 10.3 Log Rotation

Create `/etc/logrotate.d/meowstik`:

```
/opt/meowstik/logs/*.md {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 meowstik meowstik
}
```

---

## 11. Backup & Recovery

### 11.1 Database Backup Script

Create `/opt/meowstik/scripts/backup-db.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/meowstik/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/meowstik_$TIMESTAMP.sql"

mkdir -p "$BACKUP_DIR"

# Backup database
pg_dump postgresql://meowstik:your_password@localhost:5432/meowstik > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "meowstik_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Make executable:
```bash
chmod +x /opt/meowstik/scripts/backup-db.sh
```

### 11.2 Automated Backups with Cron

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/meowstik/scripts/backup-db.sh >> /var/log/meowstik-backup.log 2>&1
```

### 11.3 Full System Backup

```bash
# Backup entire application directory
tar -czf /backups/meowstik-full-$(date +%Y%m%d).tar.gz \
  --exclude=/opt/meowstik/node_modules \
  --exclude=/opt/meowstik/dist \
  /opt/meowstik
```

### 11.4 Database Restore

```bash
# Decompress backup
gunzip meowstik_20260115_020000.sql.gz

# Restore database
psql postgresql://meowstik:your_password@localhost:5432/meowstik < meowstik_20260115_020000.sql
```

---

## 12. CI/CD Pipeline

### 12.1 GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Home Server

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Build application
      run: npm run build
      
    - name: Deploy to home server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /opt/meowstik
          git pull origin main
          npm ci
          npm run build
          pm2 restart meowstik || pm2 start npm --name meowstik -- start
```

### 12.2 GitHub Secrets Configuration

Add the following secrets to your GitHub repository:
- `SERVER_HOST`: 192.168.1.100 (or public IP/domain)
- `SERVER_USER`: Your server username
- `SSH_PRIVATE_KEY`: Your SSH private key for authentication

### 12.3 Alternative: Webhook Deployment

Create `/opt/meowstik/scripts/webhook-deploy.sh`:

```bash
#!/bin/bash

cd /opt/meowstik
git pull origin main
npm ci
npm run build
pm2 restart meowstik
```

Setup webhook listener using a simple Express server or use tools like `webhook` or `hookdeck`.

---

## 13. Maintenance & Updates

### 13.1 System Updates

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y

# Update Node.js (if needed)
sudo apt install -y nodejs

# Update npm packages
cd /opt/meowstik
npm update
npm outdated  # Check for updates
```

### 13.2 Application Updates

```bash
cd /opt/meowstik
git pull origin main
npm ci
npm run db:push  # Apply schema changes
npm run build
pm2 restart meowstik  # Or: docker compose up -d --build
```

### 13.3 Database Maintenance

```bash
# Vacuum and analyze
sudo -u postgres psql -d meowstik -c "VACUUM ANALYZE;"

# Check database size
sudo -u postgres psql -d meowstik -c "SELECT pg_size_pretty(pg_database_size('meowstik'));"

# Reindex
sudo -u postgres psql -d meowstik -c "REINDEX DATABASE meowstik;"
```

### 13.4 Monitoring Disk Space

```bash
# Check disk usage
df -h

# Check largest directories
du -sh /opt/meowstik/* | sort -h

# Clean Docker images
docker system prune -a
```

---

## 14. Migration Steps

### Phase 1: Preparation (Day 1)

1. **Hardware Setup**
   - [ ] Assemble/acquire server hardware
   - [ ] Install Ubuntu Server 22.04 LTS
   - [ ] Configure static IP and networking
   - [ ] Setup SSH access and harden security

2. **Software Installation**
   - [ ] Install Node.js 20
   - [ ] Install PostgreSQL 16
   - [ ] Install Docker & Docker Compose
   - [ ] Install supporting tools (FFmpeg, Chromium, Xvfb)

3. **Security Configuration**
   - [ ] Configure UFW firewall
   - [ ] Setup fail2ban
   - [ ] Configure SSH keys
   - [ ] Enable automatic security updates

### Phase 2: Application Setup (Day 2)

4. **Database Migration**
   - [ ] Export database from Replit
   - [ ] Create PostgreSQL user and database
   - [ ] Import database to local PostgreSQL
   - [ ] Verify data integrity

5. **Application Deployment**
   - [ ] Clone repository
   - [ ] Configure `.env` file
   - [ ] Install dependencies
   - [ ] Build application
   - [ ] Test locally

6. **Service Configuration**
   - [ ] Setup PM2 or Docker Compose
   - [ ] Configure Caddy reverse proxy
   - [ ] Test application access

### Phase 3: Testing & Validation (Day 3)

7. **Functional Testing**
   - [ ] Test AI chat functionality
   - [ ] Test Google Workspace integrations
   - [ ] Test code editor and preview
   - [ ] Test authentication flow
   - [ ] Test voice features (TTS/STT)

8. **Performance Testing**
   - [ ] Monitor resource usage
   - [ ] Test under load
   - [ ] Verify response times

### Phase 4: Production Cutover (Day 4+)

9. **SSL/TLS Setup**
   - [ ] Obtain SSL certificate
   - [ ] Configure HTTPS
   - [ ] Test secure connections

10. **Monitoring & Backups**
    - [ ] Setup automated backups
    - [ ] Configure monitoring (optional)
    - [ ] Document procedures

11. **Final Validation**
    - [ ] Full smoke test
    - [ ] Verify all features work
    - [ ] Document any issues

---

## 15. Troubleshooting

### Common Issues & Solutions

#### Issue: Application won't start

**Symptoms**: `npm start` fails or application crashes on startup

**Solutions**:
```bash
# Check logs
pm2 logs meowstik
# Or
docker compose logs app

# Verify environment variables
cat .env

# Check database connection
psql $DATABASE_URL

# Verify Node.js version
node --version  # Should be v20.x

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Database connection errors

**Symptoms**: "ECONNREFUSED" or "connection timeout"

**Solutions**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify PostgreSQL is listening
sudo netstat -plnt | grep 5432

# Test connection
psql "postgresql://meowstik:password@localhost:5432/meowstik"

# Check pg_hba.conf
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### Issue: Chromium/Playwright errors

**Symptoms**: "Browser not found" or "Failed to launch chromium"

**Solutions**:
```bash
# Install missing dependencies
sudo apt install -y chromium-browser libnss3 libatk-bridge2.0-0

# Set Chromium path
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps
```

#### Issue: Port 5000 already in use

**Symptoms**: "EADDRINUSE: address already in use"

**Solutions**:
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill process
sudo kill -9 <PID>

# Or change port in .env
echo "PORT=5001" >> .env
```

#### Issue: Permission denied errors

**Symptoms**: "EACCES: permission denied"

**Solutions**:
```bash
# Fix file ownership
sudo chown -R $USER:$USER /opt/meowstik

# Fix secrets permissions
chmod 600 /opt/meowstik/secrets/*

# Fix script permissions
chmod +x /opt/meowstik/scripts/*.sh
```

#### Issue: Out of memory

**Symptoms**: Application crashes with "JavaScript heap out of memory"

**Solutions**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or add to PM2 config
pm2 start npm --name meowstik -- start --node-args="--max-old-space-size=4096"

# Or in Docker Compose
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
```

#### Issue: SSL certificate errors

**Symptoms**: "ERR_CERT_AUTHORITY_INVALID" or "NET::ERR_CERT_COMMON_NAME_INVALID"

**Solutions**:
```bash
# For self-signed certificates, add to trusted store
sudo cp /opt/meowstik/secrets/meowstik.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates

# Or use mkcert for local development
brew install mkcert  # Or: sudo apt install mkcert
mkcert -install
mkcert meowstik.local "*.meowstik.local" 192.168.1.100
```

---

## Additional Resources

### Documentation Links

- [Ubuntu Server Guide](https://ubuntu.com/server/docs)
- [Node.js Documentation](https://nodejs.org/docs/latest-v20.x/api/)
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Docker Documentation](https://docs.docker.com/)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)

### Community Support

- [Meowstik GitHub Repository](https://github.com/jasonbender-c3x/Meowstik)
- [Ubuntu Forums](https://ubuntuforums.org/)
- [Stack Overflow](https://stackoverflow.com/)
- [Reddit r/homelab](https://reddit.com/r/homelab)

### Security Resources

- [CIS Ubuntu Benchmarks](https://www.cisecurity.org/benchmark/ubuntu_linux)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

## Conclusion

This implementation plan provides a comprehensive guide for setting up a home development server for the Meowstik application. By following these steps, you will have a fully functional, secure, and production-ready environment running on your own hardware.

**Key Takeaways**:

1. **Hardware**: Minimum 4 cores, 16GB RAM, 256GB SSD
2. **OS**: Ubuntu Server 22.04 LTS
3. **Stack**: Node.js 20, PostgreSQL 16, Docker, Caddy
4. **Security**: UFW firewall, SSH hardening, fail2ban, automatic updates
5. **Deployment**: PM2 or Docker Compose with automated backups
6. **Monitoring**: Optional Prometheus/Grafana for advanced monitoring

The migration can be completed in 3-4 days following the phased approach outlined in Section 14. Remember to test thoroughly before fully cutting over from Replit.

For questions or issues, refer to the troubleshooting section or open an issue on the GitHub repository.

**Happy self-hosting!** 🚀
