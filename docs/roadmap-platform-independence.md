# Roadmap: Platform Independence

This document outlines the strategic migration of the Meowstik platform from its current development environment to a self-hosted infrastructure. This will provide greater control, scalability, and security.

## 📚 Related Documentation

- **[Home Dev Server Implementation Plan](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md)**: Complete guide for setting up a self-hosted development server at home
- **[Home Dev Server Quick Start](./HOME_DEV_SERVER_QUICKSTART.md)**: Condensed checklist for rapid setup
- **[Local Development Guide](./local-development.md)**: Running Meowstik locally without platform dependencies

## Phase 0: Home Development Server Setup (NEW)

-   [ ] **Hardware Procurement:**
    -   [ ] Acquire or build home server (minimum 4 cores, 16GB RAM, 256GB SSD)
    -   [ ] Setup network infrastructure and static IP assignment
-   [ ] **Operating System Installation:**
    -   [ ] Install Ubuntu Server 22.04 LTS
    -   [ ] Configure security (firewall, SSH hardening, fail2ban)
-   [ ] **Software Stack Installation:**
    -   [ ] Install Node.js 20, PostgreSQL 16, Docker, supporting tools
    -   [ ] See [Home Dev Server Implementation Plan](./HOME_DEV_SERVER_IMPLEMENTATION_PLAN.md) for complete guide
-   [ ] **Application Deployment:**
    -   [ ] Clone repository and configure environment
    -   [ ] Setup database and migrate data
    -   [ ] Deploy with PM2 or Docker Compose
-   [ ] **Testing & Validation:**
    -   [ ] Verify all features work in self-hosted environment
    -   [ ] Setup automated backups and monitoring

## Phase 1: Authentication & Core Services

-   [x] **Implement Custom Authentication:** (COMPLETED - Home Dev Mode)
    -   [x] Design and build a secure sign-in, sign-up, and session management flow to replace the platform-specific authentication.
    -   [x] Home Dev Mode implemented for local development bypass
    -   [ ] Implement full OAuth2 flow for production (Google, GitHub)
    -   [ ] Integrate Passport.js with local and OAuth strategies
-   [ ] **Migrate Database:**
    -   [ ] Export the schema and data from the current database
    -   [ ] Choose target: Home server PostgreSQL OR Google Cloud SQL
    -   [ ] Import the data and update all application connection strings

## Phase 2: Containerization & CI/CD

-   [ ] **Containerize the Application:**
    -   [ ] Create a `Dockerfile` to package the Node.js server.
    -   [ ] Create a `Dockerfile` for the Vite/React frontend, optimized for production builds.
    -   [ ] Use Docker Compose to define the multi-container setup for a consistent local development environment.
-   [ ] **Establish CI/CD Pipeline:**
    -   [ ] Configure a GitHub Actions workflow to trigger on pushes to the `main` branch.
    -   [ ] The workflow will build, tag, and push the Docker images to Google Artifact Registry.

## Phase 3: Cloud Hosting (Optional)

### Option A: Google Cloud Run (Serverless)
-   [ ] **Deploy to Google Cloud Run:**
    -   [ ] Provision a new Google Cloud project
    -   [ ] Deploy the containerized server and client applications to Cloud Run for scalable, serverless execution
    -   [ ] Configure environment variables and secrets using Google Secret Manager
-   [ ] **Configure Networking:**
    -   [ ] Set up a custom domain
    -   [ ] Configure a Google Cloud Load Balancer to manage traffic, route to the correct services, and handle SSL termination

### Option B: Home Server with Public Access
-   [ ] **Domain & DNS Configuration:**
    -   [ ] Register domain or use dynamic DNS service
    -   [ ] Configure port forwarding on router (80, 443)
    -   [ ] Setup Caddy reverse proxy with automatic SSL
-   [ ] **Security Hardening:**
    -   [ ] Implement rate limiting and DDoS protection
    -   [ ] Configure VPN or Cloudflare Tunnel for secure access
    -   [ ] Regular security audits and updates

## Phase 4: Final Migration

-   [ ] **DNS Cutover:**
    -   [ ] Point the production domain to the Google Cloud Load Balancer.
    -   [ ] Thoroughly test all application functionality in the new environment.
-   [ ] **Decommission Old Platform:**
    -   [ ] Once stability is confirmed, archive and remove the project from the old platform.
