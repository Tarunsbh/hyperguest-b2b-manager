# HyperGuest B2B Manager — Vultr Deployment Guide

## What gets deployed
- **Next.js 14** app running as a Docker container on port 3000
- **MySQL 8** database container with persistent volume
- Both behind **Nginx** reverse proxy (optional, recommended for HTTPS)

---

## Prerequisites on your local machine
- Git installed
- The project folder: `hyperguest-b2b-manager/`

---

## Step 1 — Create a Vultr server

1. Log in to [vultr.com](https://vultr.com) → **Deploy** → **Cloud Compute**
2. Choose:
   - **OS**: Ubuntu 22.04 LTS
   - **Plan**: 2 vCPU / 4 GB RAM minimum (the $24/mo plan works well)
   - **Region**: closest to your users
3. Add your SSH key (or Vultr will email you the root password)
4. Deploy — wait ~2 minutes for it to boot

---

## Step 2 — SSH into the server and set it up

```bash
ssh root@YOUR_VULTR_IP
```

### Install Docker + Docker Compose

```bash
# Update packages
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

### Install Git and Nginx (optional, for HTTPS/domain)

```bash
apt-get install -y git nginx certbot python3-certbot-nginx
```

---

## Step 3 — Copy the project to the server

**Option A — via Git (recommended)**

On your local machine, push the project to GitHub first:

```bash
cd hyperguest-b2b-manager
git init          # if not already a repo
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USER/hyperguest-b2b-manager.git
git push -u origin main
```

Then on the Vultr server:

```bash
cd /opt
git clone https://github.com/YOUR_USER/hyperguest-b2b-manager.git
cd hyperguest-b2b-manager
```

**Option B — via scp (simpler, no GitHub needed)**

On your local machine:

```bash
# Exclude node_modules and .next (Docker will rebuild them)
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
  ./hyperguest-b2b-manager/ root@YOUR_VULTR_IP:/opt/hyperguest-b2b-manager/
```

---

## Step 4 — Create the production .env file on the server

```bash
cd /opt/hyperguest-b2b-manager
nano .env
```

Paste the following (fill in your real values):

```env
# HyperGuest API tokens
NEXT_PUBLIC_HG_API_TOKEN=9d49c17f0b3a4c9d9693df041690eccc
NEXT_PUBLIC_HG_STATIC_TOKEN=9d49c17f0b3a4c9d9693df041690eccc
NEXT_PUBLIC_HG_OPERATIONS_TOKEN=9d49c17f0b3a4c9d9693df041690eccc
NEXT_PUBLIC_HG_CALLBACK_TOKEN=f99a7t2vlcr0swoNoC1qapac6ozoQ3tr

# HyperGuest Base URLs
NEXT_PUBLIC_HG_STATIC_URL=https://hg-static.hyperguest.com
NEXT_PUBLIC_HG_SEARCH_URL=https://search-api.hyperguest.io
NEXT_PUBLIC_HG_PDM_URL=https://pdm.hyperguest.io
NEXT_PUBLIC_HG_BOOK_URL=https://book-api.hyperguest.com

# Callback
NEXT_PUBLIC_EGLOBE_CALLBACK_URL=https://www.eglobe-solutions.com/webapichannelmanager/hyperguestb2bsubscription/callback/ariupdates
NEXT_PUBLIC_SUBSCRIPTION_EMAIL=it@eglobe-solutions.com

# JWT Secret — IMPORTANT: generate a real secret below
JWT_SECRET=REPLACE_WITH_OUTPUT_OF_openssl_rand_base64_32

# MySQL — these must match the db service in docker-compose.yml
DB_HOST=db
DB_PORT=3306
DB_NAME=hyperguest_b2b
DB_USER=hg_user
DB_PASSWORD=HyperGuest2024!

# App
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

Generate a real JWT secret:

```bash
openssl rand -base64 32
# Copy the output and replace REPLACE_WITH_OUTPUT_OF_openssl_rand_base64_32 above
```

Save the file: `Ctrl+O`, `Enter`, `Ctrl+X`

---

## Step 5 — Build and start the containers

```bash
cd /opt/hyperguest-b2b-manager

# Build the Docker image and start all services
docker compose up -d --build

# Watch the logs (Ctrl+C to stop watching, containers keep running)
docker compose logs -f app
```

The first build takes 3–5 minutes. When you see:
```
✓ Ready in XXXms
```
the app is running.

### Verify it works

```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

---

## Step 6 — Open firewall ports

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

If you want the app directly on port 3000 (no Nginx):

```bash
ufw allow 3000
```

Access: `http://YOUR_VULTR_IP:3000`

---

## Step 7 (optional) — Set up Nginx + HTTPS with a domain

### Point your domain to the server

In your DNS provider, create an **A record**:
```
hg.yourdomain.com  →  YOUR_VULTR_IP
```

### Configure Nginx

```bash
nano /etc/nginx/sites-available/hg-b2b
```

Paste:

```nginx
server {
    listen 80;
    server_name hg.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/hg-b2b /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### Get a free SSL certificate

```bash
certbot --nginx -d hg.yourdomain.com
# Follow the prompts — choose to redirect HTTP to HTTPS
```

App is now live at: `https://hg.yourdomain.com`

---

## Useful commands after deployment

```bash
# See running containers
docker compose ps

# View app logs (live)
docker compose logs -f app

# View DB logs
docker compose logs -f db

# Restart just the app (after a code update)
docker compose up -d --build app

# Stop everything
docker compose down

# Stop + delete all data (caution!)
docker compose down -v

# Open a shell inside the app container
docker compose exec app sh

# Open MySQL shell
docker compose exec db mysql -u hg_user -pHyperGuest2024! hyperguest_b2b
```

---

## Updating the app after code changes

```bash
# On the server
cd /opt/hyperguest-b2b-manager

# If using Git
git pull origin main

# Rebuild and restart the app container only (DB keeps running)
docker compose up -d --build app
```

---

## Login credentials

| Field    | Value   |
|----------|---------|
| Username | `tarun` |
| Password | `eglobe` |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails with "standalone not found" | `output: 'standalone'` is already in next.config.js — confirm the file was saved |
| DB connection refused | Wait 30s after `docker compose up` for MySQL to initialise |
| Port 3000 not accessible | Run `ufw allow 3000` or check docker compose logs |
| App shows blank page | Check `docker compose logs app` for errors |
| JWT errors on login | Make sure `JWT_SECRET` is set in your `.env` file |
