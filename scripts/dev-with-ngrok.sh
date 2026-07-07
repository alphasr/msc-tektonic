#!/bin/sh
# Runs `next dev` with an ngrok tunnel to the domain used in SPOTIFY_REDIRECT_URI.
# The tunnel is required for the Spotify OAuth callback to reach localhost.

PORT="${PORT:-3000}"

# Pull the ngrok domain out of .env so it's defined in exactly one place
DOMAIN=$(grep -E '^SPOTIFY_REDIRECT_URI=' .env 2>/dev/null | sed -E 's|.*https?://([^/]+).*|\1|')

if [ -z "$DOMAIN" ]; then
  echo "⚠️  Could not read SPOTIFY_REDIRECT_URI from .env — starting next dev without ngrok"
  exec next dev --webpack
fi

if ! command -v ngrok > /dev/null 2>&1; then
  echo "⚠️  ngrok not installed (brew install ngrok) — starting next dev without ngrok"
  exec next dev --webpack
fi

# Skip if an ngrok agent is already running (e.g. started manually)
if curl -s -m 1 http://localhost:4040/api/tunnels > /dev/null 2>&1; then
  echo "🌐 ngrok already running — reusing existing tunnel"
else
  ngrok http --url="https://${DOMAIN}" "$PORT" --log=stdout > /dev/null 2>&1 &
  NGROK_PID=$!
  trap 'kill "$NGROK_PID" 2>/dev/null' EXIT INT TERM
  echo "🌐 ngrok tunnel: https://${DOMAIN} → http://localhost:${PORT}"
fi

next dev --webpack
