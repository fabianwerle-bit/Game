#!/usr/bin/env bash
# Privatgebote – Server-Härtung für Ubuntu 24.04
# Aufruf als root:  SSH_PUBKEY="ssh-ed25519 AAAA... du@laptop" bash 01-harden.sh
# Sicher gegen Aussperren: Passwort-Login wird NUR abgeschaltet, wenn ein gültiger Schlüssel hinterlegt ist.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
[[ -n "${SSH_PUBKEY:-}" ]] || { echo "SSH_PUBKEY fehlt (Inhalt deiner id_ed25519.pub)."; exit 1; }

# Schlüssel validieren, bevor irgendetwas geändert wird
tmpkey="$(mktemp)"; echo "$SSH_PUBKEY" > "$tmpkey"
ssh-keygen -l -f "$tmpkey" >/dev/null || { echo "SSH_PUBKEY ist kein gültiger öffentlicher Schlüssel."; exit 1; }
rm -f "$tmpkey"

echo "==> System-Updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y full-upgrade
apt-get -y install ufw fail2ban unattended-upgrades ca-certificates curl

echo "==> Automatische Sicherheitsupdates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

echo "==> SSH-Schlüssel für root und Benutzer '$DEPLOY_USER'"
install_key() {
  local home="$1" owner="$2"
  install -d -m 700 -o "$owner" -g "$owner" "$home/.ssh"
  touch "$home/.ssh/authorized_keys"
  grep -qxF "$SSH_PUBKEY" "$home/.ssh/authorized_keys" || echo "$SSH_PUBKEY" >> "$home/.ssh/authorized_keys"
  chmod 600 "$home/.ssh/authorized_keys"; chown "$owner:$owner" "$home/.ssh/authorized_keys"
}
install_key /root root
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"
# sudo ohne Passwort, da der Benutzer kein Passwort hat (Login nur per Schlüssel)
echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$DEPLOY_USER"
chmod 440 "/etc/sudoers.d/90-$DEPLOY_USER"
install_key "/home/$DEPLOY_USER" "$DEPLOY_USER"

echo "==> SSH absichern (nur Schlüssel)"
# 00- damit es vor 50-cloud-init.conf gelesen wird (erste Angabe gewinnt)
cat > /etc/ssh/sshd_config.d/00-privatgebote.conf <<CONF
Port $SSH_PORT
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin prohibit-password
PermitEmptyPasswords no
MaxAuthTries 3
X11Forwarding no
CONF
sshd -t
systemctl restart ssh

echo "==> fail2ban"
cat > /etc/fail2ban/jail.d/sshd.local <<CONF
[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
bantime = 1h
CONF
systemctl enable --now fail2ban
systemctl restart fail2ban

echo "==> Firewall (UFW): SSH, HTTP, HTTPS"
if ufw --force reset >/dev/null && ufw default deny incoming && ufw default allow outgoing \
   && ufw allow "$SSH_PORT/tcp" && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable; then
  ufw status verbose
else
  echo "!! UFW konnte nicht aktiviert werden (bei LXC-Containern möglich)."
  echo "!! Dann bitte die Firewall im Kundenpanel des Hosters setzen: nur 22, 80, 443 eingehend."
fi

echo
echo "Fertig. JETZT in einem NEUEN Terminal testen, bevor du dieses schließt:"
echo "  ssh $DEPLOY_USER@$(hostname -I | awk '{print $1}')"
echo "Danach das root-Passwort ändern:  passwd"
