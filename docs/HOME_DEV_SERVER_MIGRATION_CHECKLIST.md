# Home Dev Server Migration Checklist

**Print this document and check off items as you complete them!**

**Project**: Meowstik Platform Independence Migration  
**Target**: Self-hosted Home Development Server  
**Estimated Time**: 3-5 days  
**Started**: ___________  **Completed**: ___________

---

## Pre-Migration Phase

### Planning & Preparation
- [ ] Read [Home Dev Server Implementation Plan](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md)
- [ ] Read [Home Dev Server Architecture](./HOME_DEV_SERVER_ARCHITECTURE.md)
- [ ] Decide on deployment method: **PM2** or **Docker Compose**
- [ ] Choose hardware option: **Mini PC** / **Desktop** / **Server**
- [ ] Plan network configuration: **Static IP** or **DHCP Reservation**

### Hardware Acquisition
- [ ] Server hardware acquired/available
  - [ ] Minimum: 4 cores, 16GB RAM, 256GB SSD
  - [ ] Recommended: 8 cores, 32GB RAM, 512GB NVMe SSD
- [ ] Gigabit Ethernet connection available
- [ ] UPS (Uninterruptible Power Supply) recommended but optional
- [ ] Monitor, keyboard, mouse for initial setup

### Software Preparation
- [ ] Ubuntu Server 22.04 LTS ISO downloaded
- [ ] Bootable USB created (8GB+ capacity)
- [ ] USB creation tool used: **Rufus** / **Etcher** / **dd**

### Secrets & Credentials
- [ ] Database password generated (32+ characters)
- [ ] Session secret generated: `openssl rand -hex 32`
- [ ] Google OAuth credentials accessible
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
- [ ] Gemini API key: `GEMINI_API_KEY`
- [ ] Google service account JSON file available
- [ ] GitHub token (optional): `GITHUB_TOKEN`
- [ ] Twilio credentials (optional):
  - [ ] `TWILIO_ACCOUNT_SID`
  - [ ] `TWILIO_AUTH_TOKEN`
  - [ ] `TWILIO_PHONE_NUMBER`

### Data Backup
- [ ] Export current database from Replit
- [ ] Backup `.env` file from Replit
- [ ] Backup any uploaded files/attachments
- [ ] Document current environment configuration

---

## Day 1: Base System Setup

**Goal**: Install OS, configure networking, secure the server

### OS Installation (1-2 hours)
- [ ] Boot from USB drive
- [ ] Select language and keyboard layout
- [ ] Configure network (DHCP for now, static later)
- [ ] Create user account: __________________
- [ ] Select "Ubuntu Server (minimized)" installation
- [ ] Partition disk (automatic or manual)
- [ ] Complete installation
- [ ] Reboot system
- [ ] Remove USB drive

### Initial Login & Updates (30 minutes)
- [ ] SSH into server: `ssh username@server-ip`
- [ ] Run system updates:
  ```bash
  sudo apt update
  sudo apt upgrade -y
  sudo apt autoremove -y
  ```
- [ ] Install essential tools:
  ```bash
  sudo apt install -y build-essential git curl wget vim htop tmux
  ```

### Network Configuration (30 minutes)
- [ ] Determine server's MAC address: `ip link show`
- [ ] Configure static IP or DHCP reservation
  - [ ] **Option A**: Edit `/etc/netplan/01-netcfg.yaml`
  - [ ] **Option B**: Configure router DHCP reservation
- [ ] Apply network configuration
- [ ] Verify connectivity: `ping google.com`
- [ ] Note final IP address: __________________

### Firewall Setup (15 minutes)
- [ ] Install UFW: `sudo apt install ufw`
- [ ] Configure default policies:
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  ```
- [ ] Allow SSH: `sudo ufw allow 22/tcp comment 'SSH'`
- [ ] Allow HTTP: `sudo ufw allow 80/tcp comment 'HTTP'`
- [ ] Allow HTTPS: `sudo ufw allow 443/tcp comment 'HTTPS'`
- [ ] Allow app: `sudo ufw allow 5000/tcp comment 'Meowstik'`
- [ ] Enable firewall: `sudo ufw enable`
- [ ] Verify status: `sudo ufw status verbose`

### SSH Hardening (30 minutes)
- [ ] Generate SSH key on local machine:
  ```bash
  ssh-keygen -t ed25519 -C "your-email@example.com"
  ```
- [ ] Copy key to server:
  ```bash
  ssh-copy-id -i ~/.ssh/id_ed25519.pub username@server-ip
  ```
- [ ] Test key authentication
- [ ] Edit SSH config: `sudo nano /etc/ssh/sshd_config`
  - [ ] Set `PermitRootLogin no`
  - [ ] Set `PasswordAuthentication no`
  - [ ] Set `PubkeyAuthentication yes`
- [ ] Restart SSH: `sudo systemctl restart sshd`
- [ ] **IMPORTANT**: Test SSH connection in new terminal before closing current session

### Security Tools (15 minutes)
- [ ] Install fail2ban: `sudo apt install -y fail2ban`
- [ ] Enable fail2ban: `sudo systemctl enable fail2ban`
- [ ] Start fail2ban: `sudo systemctl start fail2ban`
- [ ] Configure automatic updates:
  ```bash
  sudo apt install -y unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```

**Day 1 Complete** ✅  
Time taken: _______ hours

---

## Day 2: Software Stack Installation

**Goal**: Install Node.js, PostgreSQL, Docker, and supporting tools

### Node.js 20 (15 minutes)
- [ ] Add NodeSource repository:
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  ```
- [ ] Install Node.js: `sudo apt install -y nodejs`
- [ ] Verify installation:
  - [ ] `node --version` (should show v20.x.x)
  - [ ] `npm --version` (should show 10.x.x+)

### PostgreSQL 16 (20 minutes)
- [ ] Add PostgreSQL repository:
  ```bash
  sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
  sudo apt update
  ```
- [ ] Install PostgreSQL: `sudo apt install -y postgresql-16 postgresql-contrib-16`
- [ ] Verify installation: `psql --version`
- [ ] Check service status: `sudo systemctl status postgresql`

### Database Configuration (30 minutes)
- [ ] Create database user and database:
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
- [ ] Test connection:
  ```bash
  psql -U meowstik -d meowstik -h localhost
  ```
- [ ] Note database URL: `postgresql://meowstik:password@localhost:5432/meowstik`

### Docker (if using Docker Compose) (20 minutes)
- [ ] Install Docker:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  newgrp docker
  ```
- [ ] Verify Docker: `docker --version`
- [ ] Verify Docker Compose: `docker compose version`

### Supporting Tools (30 minutes)
- [ ] Install FFmpeg: `sudo apt install -y ffmpeg`
- [ ] Install Chromium and dependencies:
  ```bash
  sudo apt install -y chromium-browser libnss3 libatk-bridge2.0-0 \
    libdrm2 libxkbcommon0 fonts-liberation fonts-noto-color-emoji
  ```
- [ ] Install Xvfb: `sudo apt install -y xvfb x11vnc`
- [ ] Install PM2 (if using PM2): `sudo npm install -g pm2`
- [ ] Verify all installations:
  - [ ] `ffmpeg -version`
  - [ ] `chromium-browser --version`
  - [ ] `pm2 --version` (if using PM2)

### Git Configuration (5 minutes)
- [ ] Configure Git:
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your-email@example.com"
  git config --global init.defaultBranch main
  ```

**Day 2 Complete** ✅  
Time taken: _______ hours

---

## Day 3: Application Setup

**Goal**: Clone repository, configure environment, build application

### Repository Setup (10 minutes)
- [ ] Create application directory:
  ```bash
  sudo mkdir -p /opt/meowstik
  sudo chown $USER:$USER /opt/meowstik
  ```
- [ ] Clone repository:
  ```bash
  cd /opt/meowstik
  git clone https://github.com/jasonbender-c3x/Meowstik.git .
  ```
- [ ] Verify clone: `ls -la`

### Dependencies Installation (15 minutes)
- [ ] Install npm packages:
  ```bash
  npm install
  ```
- [ ] Wait for completion (may take 10-15 minutes)
- [ ] Check for errors in output

### Environment Configuration (30 minutes)
- [ ] Copy example: `cp .env.example .env`
- [ ] Edit environment file: `nano .env`
- [ ] Set required variables:
  - [ ] `PORT=5000`
  - [ ] `NODE_ENV=production` (or `development` for testing)
  - [ ] `HOME_DEV_MODE=true` (for local development)
  - [ ] `HOME_DEV_EMAIL=your-email@example.com`
  - [ ] `DATABASE_URL=postgresql://meowstik:password@localhost:5432/meowstik`
  - [ ] `GEMINI_API_KEY=your_key`
  - [ ] `GOOGLE_CLIENT_ID=your_client_id`
  - [ ] `GOOGLE_CLIENT_SECRET=your_secret`
  - [ ] `GOOGLE_REDIRECT_URI=http://server-ip:5000/api/auth/google/callback`
  - [ ] `SESSION_SECRET=your_random_32_char_string`
  - [ ] `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser`
- [ ] Save and close file

### Secrets Directory (10 minutes)
- [ ] Create secrets directory:
  ```bash
  mkdir -p /opt/meowstik/secrets
  chmod 700 /opt/meowstik/secrets
  ```
- [ ] Copy service account JSON:
  ```bash
  cp ~/service-account.json /opt/meowstik/secrets/
  chmod 600 /opt/meowstik/secrets/service-account.json
  ```
- [ ] Update `GOOGLE_APPLICATION_CREDENTIALS` in `.env`

### Database Schema (5 minutes)
- [ ] Initialize database:
  ```bash
  npm run db:push
  ```
- [ ] Verify success (no errors)

### Application Build (10 minutes)
- [ ] Build application:
  ```bash
  npm run build
  ```
- [ ] Verify build completes successfully
- [ ] Check for `dist/` directory

### Testing (15 minutes)
- [ ] Test in development mode:
  ```bash
  npm run dev
  ```
- [ ] Open browser to `http://server-ip:5000`
- [ ] Verify application loads
- [ ] Test basic functionality:
  - [ ] Chat interface works
  - [ ] Can create new chat
  - [ ] AI responds to messages
- [ ] Stop dev server: `Ctrl+C`

**Day 3 Complete** ✅  
Time taken: _______ hours

---

## Day 4: Production Deployment

**Goal**: Deploy with PM2 or Docker, configure reverse proxy

### Option A: PM2 Deployment (15 minutes)
- [ ] Start application:
  ```bash
  pm2 start npm --name meowstik -- start
  ```
- [ ] Save PM2 configuration: `pm2 save`
- [ ] Setup startup script:
  ```bash
  pm2 startup systemd
  # Follow the command it outputs
  ```
- [ ] Verify application running: `pm2 list`
- [ ] Check logs: `pm2 logs meowstik`

### Option B: Docker Compose Deployment (30 minutes)
- [ ] Create `docker-compose.yml` (see Implementation Plan)
- [ ] Create `Dockerfile` (see Implementation Plan)
- [ ] Create `Caddyfile` for reverse proxy
- [ ] Build and start containers:
  ```bash
  docker compose up -d --build
  ```
- [ ] Verify containers running: `docker ps`
- [ ] Check application logs: `docker compose logs -f app`

### Reverse Proxy - Caddy (Optional, 20 minutes)
- [ ] Install Caddy:
  ```bash
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install caddy
  ```
- [ ] Create Caddyfile: `sudo nano /etc/caddy/Caddyfile`
- [ ] Add configuration (see Implementation Plan)
- [ ] Reload Caddy: `sudo systemctl reload caddy`
- [ ] Test HTTPS access (if configured)

### Application Access (5 minutes)
- [ ] Test HTTP access: `http://server-ip:5000`
- [ ] Test HTTPS access (if configured): `https://your-domain.com`
- [ ] Verify all features work
- [ ] Document access URL: __________________

**Day 4 Complete** ✅  
Time taken: _______ hours

---

## Day 5: Monitoring, Backups & Validation

**Goal**: Setup automated backups, monitoring, final validation

### Automated Backups (30 minutes)
- [ ] Create backup script:
  ```bash
  mkdir -p /opt/meowstik/backups
  nano /opt/meowstik/scripts/backup-db.sh
  ```
- [ ] Add backup script content (see Quick Start guide)
- [ ] Make executable: `chmod +x /opt/meowstik/scripts/backup-db.sh`
- [ ] Test backup: `/opt/meowstik/scripts/backup-db.sh`
- [ ] Verify backup file created
- [ ] Setup cron job:
  ```bash
  crontab -e
  # Add: 0 2 * * * /opt/meowstik/scripts/backup-db.sh
  ```

### Monitoring Setup (20 minutes)
- [ ] Install monitoring tools (optional):
  ```bash
  sudo apt install -y htop iotop nethogs
  ```
- [ ] Test monitoring commands:
  - [ ] `htop` - System resources
  - [ ] `pm2 monit` (if using PM2)
  - [ ] `docker stats` (if using Docker)
- [ ] Document monitoring URLs: __________________

### Log Rotation (10 minutes)
- [ ] Create logrotate config:
  ```bash
  sudo nano /etc/logrotate.d/meowstik
  ```
- [ ] Add configuration (see Implementation Plan)
- [ ] Test logrotate: `sudo logrotate -f /etc/logrotate.d/meowstik`

### Full System Validation (30 minutes)
Test all application features:
- [ ] User authentication works
- [ ] Chat interface functional
- [ ] AI responses streaming correctly
- [ ] Google Drive integration
- [ ] Gmail integration
- [ ] Google Calendar integration
- [ ] Code editor works
- [ ] Live preview works
- [ ] Voice features (if configured)
- [ ] File uploads work
- [ ] Database persisting data

### Performance Testing (15 minutes)
- [ ] Monitor system resources under load:
  - [ ] CPU usage: _____%
  - [ ] RAM usage: _____%
  - [ ] Disk I/O: _____MB/s
- [ ] Test response times
- [ ] Verify application stability

### Documentation (15 minutes)
- [ ] Document server IP: __________________
- [ ] Document access URLs: __________________
- [ ] Document admin passwords (securely!)
- [ ] Create runbook for common operations
- [ ] Document troubleshooting steps encountered

**Day 5 Complete** ✅  
Time taken: _______ hours

---

## Post-Migration Tasks

### Optional Enhancements
- [ ] Setup SSL/TLS with Let's Encrypt
- [ ] Configure custom domain
- [ ] Setup port forwarding for external access
- [ ] Install Prometheus + Grafana monitoring
- [ ] Configure email alerts
- [ ] Setup off-site backups
- [ ] Configure CDN (if needed)
- [ ] Implement load balancing (if scaling)

### CI/CD Setup (Optional)
- [ ] Create GitHub Actions workflow
- [ ] Configure GitHub secrets:
  - [ ] `SERVER_HOST`
  - [ ] `SERVER_USER`
  - [ ] `SSH_PRIVATE_KEY`
- [ ] Test automated deployment
- [ ] Document deployment process

### Team Handoff
- [ ] Share access credentials (securely)
- [ ] Provide server documentation
- [ ] Train team on maintenance procedures
- [ ] Schedule regular backup verification
- [ ] Plan for disaster recovery testing

---

## Migration Sign-Off

### Final Validation Checklist
- [ ] All critical features tested and working
- [ ] Automated backups running successfully
- [ ] Monitoring configured and accessible
- [ ] Documentation complete and accurate
- [ ] Team trained on new infrastructure
- [ ] Disaster recovery plan documented
- [ ] Old Replit instance backed up (before decommissioning)

### Migration Metrics
- **Total Time**: _______ days / _______ hours
- **Downtime**: _______ hours (if applicable)
- **Hardware Cost**: $_______
- **Issues Encountered**: _______
- **Overall Success**: ☐ Excellent  ☐ Good  ☐ Fair  ☐ Needs Improvement

### Sign-Off
- **Migration Lead**: ________________  **Date**: __________
- **Technical Reviewer**: ________________  **Date**: __________
- **Stakeholder Approval**: ________________  **Date**: __________

---

## Notes & Lessons Learned

Use this space to document issues, solutions, and improvements for future reference:

```
[Your notes here]











```

---

## Quick Reference

**Server IP**: __________________  
**SSH Command**: `ssh username@server-ip`  
**Application URL**: __________________  
**Database**: `postgresql://meowstik:***@localhost:5432/meowstik`  
**Backup Location**: `/opt/meowstik/backups/`  
**Logs Location**: `/opt/meowstik/logs/`  

**Emergency Contacts**:
- System Admin: __________________
- Database Admin: __________________
- Network Admin: __________________

**Important Commands**:
```bash
# Application management
pm2 restart meowstik          # Restart app (PM2)
docker compose restart app    # Restart app (Docker)

# View logs
pm2 logs meowstik            # PM2 logs
docker compose logs -f app   # Docker logs

# Database backup
/opt/meowstik/scripts/backup-db.sh

# System monitoring
htop                         # System resources
pm2 monit                    # PM2 monitor
docker stats                 # Docker stats

# Firewall
sudo ufw status             # Check firewall status
sudo ufw allow <port>       # Open port
```

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Related Docs**: [Implementation Plan](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md) | [Quick Start](./HOME_DEV_SERVER_QUICKSTART.md) | [Architecture](./HOME_DEV_SERVER_ARCHITECTURE.md)
