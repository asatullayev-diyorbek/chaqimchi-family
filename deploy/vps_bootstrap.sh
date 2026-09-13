#!/usr/bin/env bash
# One-shot base provisioning for the Spino24 VPS. Idempotent-ish: safe to
# re-run (apt/systemctl calls are no-ops on an already-configured box).
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

# --- swap (box only has ~900MB RAM) ---------------------------------------
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- base packages ---------------------------------------------------------
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  python3 python3-venv python3-pip python3-dev \
  build-essential libpq-dev \
  git curl unzip \
  nginx \
  postgresql postgresql-contrib \
  redis-server \
  certbot python3-certbot-nginx \
  ufw

# --- firewall ---------------------------------------------------------------
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# --- app system user ---------------------------------------------------------
id -u spino24 &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin spino24

mkdir -p /opt/spino24
chown spino24:spino24 /opt/spino24

echo "BOOTSTRAP_DONE"
