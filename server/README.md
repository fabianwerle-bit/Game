# Privatgebote – Server-Setup

Server: Ubuntu 24.04 (LXC), IP `45.10.24.60`.

## 1. SSH-Schlüssel erstellen (auf deinem eigenen Rechner)

```bash
ssh-keygen -t ed25519 -C "privatgebote"
cat ~/.ssh/id_ed25519.pub     # diese Zeile brauchst du gleich
```

## 2. Skripte auf den Server holen (als root, per Konsole im Hoster-Panel oder `ssh root@45.10.24.60`)

```bash
apt-get update && apt-get -y install git
git clone -b ccr-66a0a451-wcl70x https://github.com/fabianwerle-bit/Game.git /root/privatgebote-setup
cd /root/privatgebote-setup/server
```
(Ist das Repo privat, die Dateien stattdessen per `scp -r server root@45.10.24.60:/root/` kopieren.)

## 3. Absichern

```bash
SSH_PUBKEY="ssh-ed25519 AAAA...deine-zeile..." bash 01-harden.sh
```
Macht: Updates + automatische Sicherheitsupdates, Benutzer `deploy` (sudo, nur Schlüssel),
Passwort-Login für SSH aus, root nur noch per Schlüssel, fail2ban, Firewall (22/80/443).

**Vor dem Schließen der Konsole** in einem neuen Fenster `ssh deploy@45.10.24.60` testen.
Danach das root-Passwort mit `passwd` ändern (das alte wurde per Screenshot geteilt).

## 4. Backend-Grundlage

```bash
bash 02-backend-setup.sh
curl http://45.10.24.60/health   # -> ok
```
Installiert Docker und startet in `/opt/privatgebote`: Caddy (Reverse Proxy, automatisches HTTPS)
und PostgreSQL 17 (nur intern erreichbar, Passwort zufällig generiert in `/opt/privatgebote/.env`).

Für HTTPS: Domain per A-Record auf `45.10.24.60` zeigen lassen, `DOMAIN=api.deinedomain.de`
in `/opt/privatgebote/.env` setzen, dann `docker compose up -d`.

## LXC-Hinweise
- Startet Docker nicht: im Hoster-Panel „Nesting“ für den Container aktivieren.
- Lässt sich UFW nicht aktivieren: Firewall im Hoster-Panel setzen (nur 22, 80, 443 eingehend).
