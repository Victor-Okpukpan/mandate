#!/usr/bin/env bash
# Bootstraps a fresh Ubuntu/Debian VPS (e.g. a Tencent Cloud Lighthouse/CVM instance) to run the
# MANDATE Enforcer as a persistent systemd service. Idempotent — safe to re-run after a `git pull`
# to redeploy. Run as root (or with sudo); everything the service itself runs as drops to the
# unprivileged `mandate` user created below.
#
# Usage:
#   1. scp/git clone this repo to the VPS, then: sudo bash enforcer/deploy/setup.sh
#   2. Put a real .env at /opt/mandate/.env (never commit it — see .env.example for the full var
#      list; the Enforcer specifically needs ARC_RPC_URL, SEPOLIA_RPC_URL, ENFORCER_KEYSTORE_PATH
#      + ENFORCER_KEYSTORE_PASSWORD (or ENFORCER_DEV_PRIVATE_KEY_ANVIL_ONLY for testing only),
#      PRIVY_APP_ID + PRIVY_APP_SECRET, and either the single-org fallback addresses or the two
#      factory addresses once they exist).
#   3. sudo systemctl enable --now mandate-enforcer
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/mandate}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo bash enforcer/deploy/setup.sh)." >&2
  exit 1
fi

echo "==> Ensuring the mandate service user exists"
id -u mandate &>/dev/null || useradd --system --create-home --shell /usr/sbin/nologin mandate

echo "==> Installing Node ${NODE_MAJOR}.x if missing"
if ! command -v node &>/dev/null || [ "$(node -v | grep -oE '^v[0-9]+' | tr -d v)" -lt "$NODE_MAJOR" ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "==> Installing pnpm if missing"
command -v pnpm &>/dev/null || npm install -g pnpm@9.15.0

echo "==> Syncing repo to ${REPO_DIR}"
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Expected a git checkout at ${REPO_DIR} — clone it there first, then re-run this script." >&2
  exit 1
fi
chown -R mandate:mandate "$REPO_DIR"

echo "==> Installing workspace dependencies (as the mandate user)"
sudo -u mandate bash -c "cd '$REPO_DIR' && pnpm install --frozen-lockfile"

if [ ! -f "$REPO_DIR/.env" ]; then
  echo ""
  echo "⚠️  No .env found at ${REPO_DIR}/.env — the service will fail to start until you add one."
  echo "    Copy .env.example there and fill in real values (never commit it)."
fi

echo "==> Installing the systemd unit"
cp "$REPO_DIR/enforcer/deploy/mandate-enforcer.service" /etc/systemd/system/mandate-enforcer.service
systemctl daemon-reload

echo ""
echo "Done. Next:"
echo "  1. Put a real .env at ${REPO_DIR}/.env (see enforcer/deploy/setup.sh's own header comment)."
echo "  2. sudo systemctl enable --now mandate-enforcer"
echo "  3. journalctl -u mandate-enforcer -f    # watch it come up"
