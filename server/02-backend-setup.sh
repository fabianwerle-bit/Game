#!/usr/bin/env bash
# Privatgebote – Backend-Grundlage: Docker + Compose, Projektordner /opt/privatgebote
# Aufruf als root nach 01-harden.sh:  bash 02-backend-setup.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_DIR=/opt/privatgebote
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/backend"

echo "==> Docker installieren (offizielles Repository)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker "$DEPLOY_USER"

# Docker-Logs begrenzen, damit die Platte nicht vollläuft
cat > /etc/docker/daemon.json <<'CONF'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
CONF
systemctl restart docker

if ! docker run --rm hello-world >/dev/null 2>&1; then
  echo "!! Docker startet keine Container. Bei LXC muss im Hoster-Panel 'Nesting' aktiviert sein."
  exit 1
fi

echo "==> Projektordner $APP_DIR"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
cp -n "$SRC_DIR/docker-compose.yml" "$SRC_DIR/Caddyfile" "$APP_DIR/"
if [[ ! -f "$APP_DIR/.env" ]]; then
  sed "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" "$SRC_DIR/.env.example" > "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

echo "==> Stack starten"
cd "$APP_DIR" && docker compose up -d
docker compose ps
echo
echo "Test:  curl http://$(hostname -I | awk '{print $1}')/health"
