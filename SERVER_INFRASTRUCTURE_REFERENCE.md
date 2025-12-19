# Server Infrastructure Reference Guide
**Last Updated:** December 16, 2025

---

## Quick Access Table

| Service | URL | Username | Password |
|---------|-----|----------|----------|
| Main Server SSH | `ssh -p 2222 root@38.97.60.181` | root | 3F68ypfD1LOfcAd |
| CloudPanel | https://38.97.60.181:8443 | (your account) | (your password) |
| Dokploy (Main) | http://38.97.60.181:3000 | (your account) | (your password) |
| **Dokploy (Apps)** | http://198.46.142.2:3000 | (your account) | (your password) |
| **Apps Server SSH** | `ssh root@198.46.142.2` | root | rf38e6OlbJ47FTGXg2 |
| n8n | http://38.97.60.181:5680 | wassim | 5ty6%TY^5ty6 |
| NocoDB | http://38.97.60.181:8081 | wassim@mercan.com | 5ty6%TY^5ty6 |
| Supabase Studio | http://38.97.60.181:3002 | wassim | 5ty6%TY^5ty6 |
| Supabase PostgreSQL | 38.97.60.181:5433 | postgres | postgres123 |
| Crawl4AI API | http://38.97.60.181:11235 | Bearer Token | crawl4ai_secret_token |

---

## 1. Main Production Server (RackNerd)

### Server Details
| Property | Value |
|----------|-------|
| **IP Address** | 38.97.60.181 |
| **SSH Port** | 2222 (changed from default 22) |
| **Username** | root |
| **Password** | 3F68ypfD1LOfcAd |
| **OS** | Ubuntu |
| **CPU** | AMD Ryzen 9 7950X3D (32 cores) |
| **RAM** | 124GB |
| **Disk** | 1.8TB |

### SSH Connection
```bash
ssh -p 2222 root@38.97.60.181
# Password: 3F68ypfD1LOfcAd
```

### Security Features
- **Fail2Ban:** Active (banning SSH brute force attempts)
- **UFW Firewall:** Enabled
- **SSH:** Port 2222 only

---

## 2. Services & Applications

### 2.1 CloudPanel (Web Hosting)
- **URL:** https://38.97.60.181:8443
- **Purpose:** Manages PHP websites, SSL certificates, databases

### 2.2 Dokploy (Docker PaaS)
- **URL:** http://38.97.60.181:3000
- **API Key:** `qaBFTnweBNakQRcFNdQyFbsfnYhGxaKlDRDnhqtdfEdSrwOVmJJTofWXiVKHEYgC`
- **Purpose:** Deploy and manage Docker applications

### 2.3 n8n (Workflow Automation)
- **URL:** http://38.97.60.181:5680
- **Auth Type:** Basic Auth (nginx proxy)
- **Username:** wassim
- **Password:** 5ty6%TY^5ty6
- **Internal Port:** 5678 (localhost only)
- **Workflows:** 127 workflows migrated from old server

### 2.4 NocoDB (Database UI / Airtable Alternative)
- **URL:** http://38.97.60.181:8081
- **Email:** wassim@mercan.com
- **Password:** 5ty6%TY^5ty6
- **Role:** Super Admin
- **Backend:** PostgreSQL
- **Bases:** 15 migrated bases

### 2.5 Supabase
| Component | URL/Port | Credentials |
|-----------|----------|-------------|
| Studio (UI) | http://38.97.60.181:3002 | wassim / 5ty6%TY^5ty6 |
| PostgreSQL | 38.97.60.181:5433 | postgres / postgres123 |

**PostgreSQL Connection String:**
```
postgresql://postgres:postgres123@38.97.60.181:5433/postgres
```

### 2.6 Crawl4AI (Web Scraper)
- **URL:** http://38.97.60.181:11235
- **API Token:** `crawl4ai_secret_token`

**Example API Call:**
```bash
curl -X POST "http://38.97.60.181:11235/crawl" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer crawl4ai_secret_token" \
  -d '{"urls": ["https://example.com"], "priority": 10}'
```

---

## 3. Websites (CloudPanel Managed)

| Website | Domain | Notes |
|---------|--------|-------|
| **Mercan (Main)** | mercan.com, www.mercan.com | Primary business site |
| **Mercan UAE** | www.mercan.ae | UAE branch |
| **Immigration Story** | immigrationstory.ca | Content site |
| **Immigration News** | www.immigrationnews.ca | News portal |
| **Global Residency** | globalresidencysolution.com | Immigration services |
| **Golden Visa Consultations** | goldenvisaconsultations.com | Visa services |
| **Invest Golden Visa** | investgoldenvisa.com | Investment immigration |
| **MerCare** | mercare.ca | Healthcare services |
| **MerCare Questionnaire** | questionnaire.mercare.ca | Patient intake |
| **Mercan Payments** | payments.mercan.com | Payment portal |
| **Mercan CAD Payments** | cad-payments.mercan.com | CAD payment portal |

---

## 4. NocoDB Bases (Migrated)

| # | Base Name | Tables | Records |
|---|-----------|--------|---------|
| 1 | n8n AI SEO Content Engine | 8 | 5,041 |
| 2 | YouTube Content Strategy Generator | 4 | 821 |
| 3 | YouTube Brand ST | 1 | 14 |
| 4 | Backlink analyzer | 2 | 1,795 |
| 5 | BossBen Leads | 1 | 43 |
| 6 | Multi Agents AI SEO Content Engine | 8 | 4,591 |
| 7 | AIO Advanced Seo Engine | 5 | 22 |
| 8 | Content Translation | 0 | 0 |
| 9 | AIO SEO Engine Latest | 13 | 56 |
| 10 | LInkedIn - Smart System | 2 | 121 |
| 11 | Google Ads Smart System | 6 | 132 |
| 12 | EB3 Lead Management System | 3 | 449 |
| 13 | Google Ads Command Center | 4 | 6,103 |
| 14 | Evryjewls Photo Studio | 11 | 221 |
| 15 | Francophone Leads Qualification System | 1 | 1 |

---

## 5. Other Servers

### 5.1 Apps/Staging Server (RackNerd - Dokploy)
| Property | Value |
|----------|-------|
| **Hostname** | racknerd-a261aa2 |
| **IP Address** | 198.46.142.2 |
| **SSH Port** | 22 |
| **Username** | root |
| **Password** | rf38e6OlbJ47FTGXg2 |
| **Dokploy URL** | http://198.46.142.2:3000 |
| **Dokploy API Key** | `yUJENbJxTRoCWpriHSTmUPDbqFBdxghAHNdxhfakEjFOgqrHckftGBlDqypHHbaX` |
| **Purpose** | Staging deployments, app hosting |

#### Image Processing Services (Apps Server)

| Service | URL | Purpose | Status |
|---------|-----|---------|--------|
| **imgproxy** | https://imgproxy.pixelcraftedmedia.com | Image compression (WebP q92) | ✅ Active - Used by Image Optimizer |
| **imaginary** | https://imaginary.pixelcraftedmedia.com | Image manipulation API | 🔜 Future - Studio features |
| **IOPaint** | https://iopaint.pixelcraftedmedia.com | AI inpainting/editing | 🔜 Future - Studio features |

**imgproxy Usage (Active):**
```bash
# Compress to WebP at quality 92, max 2048px
https://imgproxy.pixelcraftedmedia.com/insecure/rs:fit:2048:2048/q:92/plain/{encoded_source_url}@webp
```

**imaginary Usage (Future - for Studio):**
```bash
# Resize image
curl "https://imaginary.pixelcraftedmedia.com/resize?width=800&height=600&url={image_url}"

# Crop image
curl "https://imaginary.pixelcraftedmedia.com/crop?width=500&height=500&url={image_url}"

# Rotate image
curl "https://imaginary.pixelcraftedmedia.com/rotate?rotate=90&url={image_url}"
```

**IOPaint Usage (Future - for Studio):**
```bash
# AI-powered inpainting/object removal
curl -X POST "https://iopaint.pixelcraftedmedia.com/inpaint" \
  -F "image=@input.jpg" \
  -F "mask=@mask.png"
```

### 5.2 Old n8n Server
| Property | Value |
|----------|-------|
| **IP Address** | 23.94.185.25 |
| **SSH Port** | 22 |
| **Username** | root |
| **Password** | LCu2pZ7VeNQ132m7ab |
| **Status** | Legacy - workflows migrated |

### 5.2 Old NocoDB Server (Coolify Managed)
| Property | Value |
|----------|-------|
| **IP Address** | 216.144.233.232 |
| **SSH** | Disabled by Coolify |
| **NocoDB URL** | https://base.pixelcraftedmedia.com |
| **API Token** | bpRRKPcqa6_V-Q7-waocifzpZdQjEi5ATb8_zl7t |
| **Status** | Legacy - data migrated |

---

## 6. Backups

### Location on Main Server
```
/root/backups/backup_20251215_213057/
```

### Contents
- MySQL database dumps (all 11 databases, 3.4GB)
- Nginx configurations
- CloudPanel configurations
- SSH configurations
- Crontabs
- Website files:
  - mercan.com (13GB)
  - mercan-payments
  - mercan-cad-payments
  - mercare

### NocoDB Export
```
/root/nocodb-export/
```
- 15 bases exported as JSON
- 116 JSON files total (17MB)

### n8n Workflows Export
- **Location:** http://38.97.60.181/temp/workflows-export.json
- **Count:** 127 workflows
- **Import:** Settings > Import from File in n8n UI

---

## 7. Port Reference

| Port | Service | Access |
|------|---------|--------|
| 22 | SSH (disabled) | Blocked |
| 80 | HTTP | CloudPanel sites |
| 443 | HTTPS | CloudPanel sites |
| 2222 | SSH | External |
| 3000 | Dokploy | External |
| 3001 | Supabase Studio (internal) | Localhost only |
| 3002 | Supabase Studio (protected) | External + Auth |
| 5433 | Supabase PostgreSQL | External |
| 5678 | n8n (internal) | Localhost only |
| 5680 | n8n (protected) | External + Auth |
| 8081 | NocoDB | External |
| 8443 | CloudPanel Admin | External |
| 11235 | Crawl4AI | External |

---

## 8. API Tokens & Keys Summary

| Service | Token/Key |
|---------|-----------|
| Dokploy API (Main) | `qaBFTnweBNakQRcFNdQyFbsfnYhGxaKlDRDnhqtdfEdSrwOVmJJTofWXiVKHEYgC` |
| Dokploy API (Apps) | `yUJENbJxTRoCWpriHSTmUPDbqFBdxghAHNdxhfakEjFOgqrHckftGBlDqypHHbaX` |
| Crawl4AI | `crawl4ai_secret_token` |
| Old NocoDB API | `bpRRKPcqa6_V-Q7-waocifzpZdQjEi5ATb8_zl7t` |

---

## 9. Quick Commands

### Connect to Main Server
```bash
ssh -p 2222 root@38.97.60.181
```

### Check Running Docker Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check Disk Space
```bash
df -h
```

### Check Memory
```bash
free -h
```

### View Fail2Ban Banned IPs
```bash
fail2ban-client status sshd
```

### Restart Services
```bash
# n8n
cd /etc/dokploy/compose/compose-hack-open-source-bus-k4mtj2/code && docker compose restart

# Supabase
cd /etc/dokploy/compose/compose-copy-haptic-monitor-upfpk6/code && docker compose restart

# NocoDB
docker restart nocodb nocodb-db

# Nginx
systemctl reload nginx
```

### View Logs
```bash
# n8n logs
docker logs n8n --tail 100

# Supabase logs
docker logs supabase-studio --tail 100

# Nginx error logs
tail -f /var/log/nginx/error.log
```

---

## 10. Pending Tasks

- [ ] Import n8n workflows via UI (download from http://38.97.60.181/temp/workflows-export.json)
- [ ] Set up n8n owner account on first login
- [ ] Configure domain names for services (optional)
- [ ] Set up SSL for Dokploy services (optional)

---

## 11. Emergency Contacts & Recovery

### If Locked Out of SSH
1. Access via RackNerd VNC console
2. Or contact RackNerd support

### If Services Down
```bash
# Check Docker
systemctl status docker
docker ps -a

# Restart all Docker containers
docker restart $(docker ps -q)

# Restart specific service
docker compose -f /path/to/docker-compose.yml restart
```

### Restore from Backup
```bash
# MySQL restore example
mysql -u root -p database_name < /root/backups/backup_20251215_213057/mysql/database_name.sql
```

---

**Document Version:** 1.0
**Created:** December 16, 2025
**Author:** System Documentation
