# Home Development Server Architecture

This document provides visual diagrams and architectural overviews for the home development server deployment of Meowstik.

---

## Network Architecture

```
                                   Internet
                                      │
                                      │
                              ┌───────▼────────┐
                              │  Home Router   │
                              │  (192.168.1.1) │
                              └────────┬───────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
         ┌──────▼──────┐      ┌───────▼───────┐      ┌──────▼──────┐
         │  Dev Laptop │      │  Home Server  │      │Other Devices│
         │192.168.1.50 │      │192.168.1.100  │      │             │
         └─────────────┘      └───────┬───────┘      └─────────────┘
                                      │
                              Port 5000 (HTTP)
                              Port 443 (HTTPS)
                              Port 22 (SSH)
```

---

## Server Component Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      Home Server Hardware                       │
│  CPU: 4-8 cores │ RAM: 16-32 GB │ Storage: 256-512 GB SSD       │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼─────────────────────────────────┐
│                   Ubuntu Server 22.04 LTS                      │
│  Security: UFW + fail2ban + AppArmor + SSH hardening          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼──────┐     ┌────────▼────────┐     ┌─────▼──────┐
│   Node.js    │     │  PostgreSQL 16  │     │   Docker   │
│   v20.x.x    │     │   + pgvector    │     │  (Optional)│
└───────┬──────┘     └────────┬────────┘     └─────┬──────┘
        │                     │                     │
┌───────▼─────────────────────▼─────────────────────▼──────┐
│                  Meowstik Application                     │
│  Express Server │ React Frontend │ AI Services │ APIs    │
└───────────────────────────────────────────────────────────┘
```

---

## Deployment Option A: PM2 Process Manager

```
┌────────────────────────────────────────────────────────┐
│                   Ubuntu Server                        │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │              PM2 Process Manager              │    │
│  │                                               │    │
│  │  ┌─────────────────────────────────────┐     │    │
│  │  │     Meowstik Node.js Process        │     │    │
│  │  │  - Express Server (Port 5000)       │     │    │
│  │  │  - Vite Dev/Build                   │     │    │
│  │  │  - Auto-restart on crash            │     │    │
│  │  │  - Log management                   │     │    │
│  │  └─────────────────────────────────────┘     │    │
│  │                                               │    │
│  │  PM2 Features:                                │    │
│  │  ✓ Process monitoring                         │    │
│  │  ✓ Automatic restarts                         │    │
│  │  ✓ Log rotation                               │    │
│  │  ✓ Cluster mode (multi-core)                  │    │
│  └──────────────────────────────────────────────┘    │
│                       │                               │
│  ┌────────────────────▼──────────────────────┐       │
│  │         PostgreSQL Database               │       │
│  │  - Direct connection via localhost        │       │
│  │  - Port 5432 (internal only)              │       │
│  └───────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────┘
```

**Commands**:
```bash
pm2 start npm --name meowstik -- start
pm2 save
pm2 startup systemd
```

---

## Deployment Option B: Docker Compose

```
┌──────────────────────────────────────────────────────────────┐
│                      Ubuntu Server                           │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Docker Engine                          │    │
│  │                                                     │    │
│  │  ┌──────────────────┐  ┌─────────────────────┐    │    │
│  │  │  meowstik-app    │  │  meowstik-db        │    │    │
│  │  │  (Node.js)       │  │  (PostgreSQL 16)    │    │    │
│  │  │                  │  │                     │    │    │
│  │  │  Port: 5000      │  │  Port: 5432         │    │    │
│  │  │  Health checks   │  │  Volume: postgres_  │    │    │
│  │  │  Auto-restart    │  │         data        │    │    │
│  │  └────────┬─────────┘  └──────────┬──────────┘    │    │
│  │           │                       │               │    │
│  │  ┌────────▼───────────────────────▼──────────┐   │    │
│  │  │      meowstik-network (bridge)         │   │    │
│  │  └────────────────────────────────────────────┘   │    │
│  │           │                                       │    │
│  │  ┌────────▼─────────┐                            │    │
│  │  │  meowstik-caddy  │  (Optional)                │    │
│  │  │  (Reverse Proxy) │                            │    │
│  │  │  Port: 80, 443   │                            │    │
│  │  └──────────────────┘                            │    │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Commands**:
```bash
docker compose up -d --build
docker compose logs -f app
```

---

## Data Flow Architecture

```
┌─────────────────┐
│  Web Browser    │
│  (Client)       │
└────────┬────────┘
         │ HTTP/HTTPS
         │ Port 5000 or 443
         │
┌────────▼────────────────────────────────────────────┐
│            Caddy Reverse Proxy (Optional)           │
│  - SSL/TLS termination                              │
│  - Automatic HTTPS with Let's Encrypt               │
│  - Request routing                                  │
└────────┬────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────┐
│              Express.js Server                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │          API Routes                         │   │
│  │  /api/chats, /api/drive, /api/gmail, etc.  │   │
│  └─────────────┬───────────────────────────────┘   │
│                │                                    │
│  ┌─────────────▼───────────────────────────────┐   │
│  │        Middleware Layer                     │   │
│  │  - Authentication                           │   │
│  │  - Session management                       │   │
│  │  - Error handling                           │   │
│  └─────────────┬───────────────────────────────┘   │
│                │                                    │
│  ┌─────────────▼───────────────────────────────┐   │
│  │        Business Logic Layer                 │   │
│  │  - Gemini AI integration                    │   │
│  │  - Google Workspace APIs                    │   │
│  │  - Tool execution                           │   │
│  └─────────────┬───────────────────────────────┘   │
│                │                                    │
│  ┌─────────────▼───────────────────────────────┐   │
│  │        Data Access Layer                    │   │
│  │  - Drizzle ORM                              │   │
│  │  - Storage abstraction                      │   │
│  └─────────────┬───────────────────────────────┘   │
└────────────────┼─────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│           PostgreSQL Database                       │
│  - Chats, Messages, Users                          │
│  - Vector embeddings (pgvector)                    │
│  - Session storage                                 │
└─────────────────────────────────────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network Firewall (UFW)                             │
│  ✓ Block all incoming by default                            │
│  ✓ Allow SSH (22), HTTP (80), HTTPS (443), App (5000)       │
│  ✓ Rate limiting with fail2ban                              │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: OS Security (Ubuntu + AppArmor)                    │
│  ✓ Automatic security updates                               │
│  ✓ AppArmor profiles for isolation                          │
│  ✓ Minimal installed packages                               │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: SSH Hardening                                      │
│  ✓ Key-based authentication only                            │
│  ✓ No root login                                            │
│  ✓ No password authentication                               │
│  ✓ fail2ban monitoring                                      │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Application Security                               │
│  ✓ Environment variable secrets                             │
│  ✓ Input validation (Zod schemas)                           │
│  ✓ Session management                                       │
│  ✓ CORS protection                                          │
└─────────────────────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Database Security                                  │
│  ✓ Dedicated database user                                  │
│  ✓ Strong password                                          │
│  ✓ Local-only access (localhost)                            │
│  ✓ Encrypted connections                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Backup & Recovery Strategy

```
┌──────────────────────────────────────────────────────────┐
│               Daily Automated Backups                     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  PostgreSQL Database                          │     │
│  │  - Full dump via pg_dump                       │     │
│  │  - Compressed with gzip                        │     │
│  │  - Stored in /opt/meowstik/backups            │     │
│  │  - Retention: 7 days                           │     │
│  │  - Schedule: 2:00 AM daily (cron)             │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  Application Files                             │     │
│  │  - Source code (git repository)                │     │
│  │  - Environment files (.env)                    │     │
│  │  - Secrets directory (/secrets)                │     │
│  │  - Logs directory (/logs)                      │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ┌────────────────────────────────────────────────┐     │
│  │  Off-site Backup (Recommended)                 │     │
│  │  - rsync to external drive                     │     │
│  │  - Cloud backup (Google Drive, Backblaze)      │     │
│  │  - Weekly full backups                         │     │
│  └────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────┘

Recovery Time Objectives (RTO):
  - Database restore: < 15 minutes
  - Application restore: < 30 minutes
  - Full system restore: < 2 hours
```

---

## Monitoring Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                   System Monitoring                          │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │   CPU Usage   │  │  RAM Usage    │  │  Disk Usage   │  │
│  │   ████░░ 45%  │  │  ██████░ 68%  │  │  ███░░░ 35%   │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         Application Health Checks                     │ │
│  │  ✓ Meowstik Server: Running (Port 5000)              │ │
│  │  ✓ PostgreSQL: Running (Port 5432)                   │ │
│  │  ✓ Caddy Proxy: Running (Port 80, 443)               │ │
│  │  ✓ Last Backup: 2 hours ago                          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │         Recent Logs                                   │ │
│  │  [INFO] Chat message processed successfully          │ │
│  │  [INFO] AI response streamed to client               │ │
│  │  [WARN] High memory usage detected (75%)             │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Tools:
  - htop (interactive process viewer)
  - PM2 monit (process monitoring)
  - docker stats (container monitoring)
  - Prometheus + Grafana (optional advanced monitoring)
```

---

## CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                   GitHub Repository                          │
│  Developer pushes code to 'main' branch                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Webhook trigger
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                 GitHub Actions Workflow                      │
│                                                             │
│  Step 1: Checkout code                                      │
│  Step 2: Setup Node.js 20                                   │
│  Step 3: Install dependencies (npm ci)                      │
│  Step 4: Run linters (npm run lint)                         │
│  Step 5: Run tests (npm test)                               │
│  Step 6: Build application (npm run build)                  │
│  Step 7: SSH to home server                                 │
│  Step 8: Pull latest code                                   │
│  Step 9: Install dependencies                               │
│  Step 10: Apply database migrations                         │
│  Step 11: Restart application (PM2/Docker)                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Deployment
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Home Development Server                         │
│  - Application updated automatically                         │
│  - Zero-downtime restart with PM2                           │
│  - Rollback capability with git                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Cost Breakdown

### One-Time Hardware Costs

| Component | Option A (Budget) | Option B (Recommended) | Option C (High-End) |
|-----------|-------------------|------------------------|---------------------|
| Mini PC | $400-500 | $700-900 | $1200-1500 |
| **Total** | **$400-500** | **$700-900** | **$1200-1500** |

### Monthly Operating Costs

| Service | Cost | Notes |
|---------|------|-------|
| Electricity | $5-15/month | ~50-100W continuous |
| Internet | $0 | Using existing home internet |
| Domain (optional) | $10-15/year | For public access |
| Dynamic DNS (optional) | $0-5/month | Alternative to static IP |
| **Total Monthly** | **$5-20** | Depends on power consumption |

### Comparison: Home Server vs. Cloud

| Item | Home Server | Google Cloud Run | Replit |
|------|-------------|------------------|---------|
| Initial Setup | $500-1500 | $0 | $0 |
| Monthly Cost | $5-20 | $50-200+ | $20-50 |
| 1 Year Cost | $560-1740 | $600-2400+ | $240-600 |
| 3 Year Cost | $680-2220 | $1800-7200+ | $720-1800 |
| Data Control | Full | Shared | Shared |
| Customization | Full | Limited | Limited |
| Latency | LAN (1-5ms) | WAN (50-200ms) | WAN (50-200ms) |

**Break-even point**: Home server pays for itself in 6-12 months compared to cloud hosting.

---

## Performance Expectations

### Local Network Performance

- **Latency**: 1-5ms (LAN)
- **Throughput**: 1 Gbps (Gigabit Ethernet)
- **Concurrent Users**: 10-50 (depending on hardware)
- **Database Query Time**: < 10ms (localhost)

### Hardware Utilization

| Resource | Idle | Normal Load | Peak Load |
|----------|------|-------------|-----------|
| CPU | 5-10% | 20-40% | 60-80% |
| RAM | 2-4 GB | 4-8 GB | 8-12 GB |
| Disk I/O | < 1 MB/s | 5-20 MB/s | 50-100 MB/s |
| Network | < 1 Mbps | 5-20 Mbps | 50-100 Mbps |

---

## Disaster Recovery Plan

### Scenario 1: Application Crash
- **Detection**: PM2/Docker auto-restart
- **Recovery Time**: < 30 seconds
- **Data Loss**: None (database persists)

### Scenario 2: Database Corruption
- **Detection**: Health check failure
- **Recovery**: Restore from latest backup
- **Recovery Time**: 10-15 minutes
- **Data Loss**: Max 1 day (daily backups)

### Scenario 3: Hardware Failure
- **Detection**: Server becomes unreachable
- **Recovery**: Restore to new hardware or VM
- **Recovery Time**: 2-4 hours
- **Data Loss**: Max 1 day (if off-site backup)

### Scenario 4: Complete System Loss
- **Detection**: Fire, theft, or catastrophic failure
- **Recovery**: Restore from off-site backup
- **Recovery Time**: 4-8 hours
- **Data Loss**: Max 1 week (weekly off-site backup)

---

## Scalability Path

```
Phase 1: Single Server (Current)
  ┌─────────────────────────┐
  │  One server handles all │
  │  - Web application      │
  │  - Database             │
  │  - File storage         │
  └─────────────────────────┘

Phase 2: Separated Database
  ┌──────────────┐     ┌──────────────┐
  │ App Server   │────→│ DB Server    │
  │ (Node.js)    │     │ (PostgreSQL) │
  └──────────────┘     └──────────────┘

Phase 3: Load Balancer + Multiple App Servers
  ┌──────────────┐
  │Load Balancer │
  └──────┬───────┘
         ├────→ App Server 1
         ├────→ App Server 2
         └────→ App Server 3
                    │
                    ▼
            ┌──────────────┐
            │  DB Server   │
            └──────────────┘

Phase 4: Kubernetes Cluster (Future)
  Full container orchestration with auto-scaling
```

---

## Related Documentation

- **[Home Dev Server Implementation Plan](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md)**: Complete setup guide
- **[Home Dev Server Quick Start](./HOME_DEV_SERVER_QUICKSTART.md)**: Condensed checklist
- **[Platform Independence Roadmap](./roadmap-platform-independence.md)**: Strategic plan
- **[Local Development Guide](./local-development.md)**: Running locally
- **[System Overview](./SYSTEM_OVERVIEW.md)**: Application architecture

---

**Last Updated**: January 2026
