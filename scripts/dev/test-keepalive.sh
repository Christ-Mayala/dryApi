#!/bin/bash
# Test local de la logique du workflow keepalive :
# - dédup 60 min (pas de spam)
# - alerte envoyée quand l'API est down
# - état de dédup mis à jour

set -e
FAIL=0

# ── Simuler gh (variable de dédup dans un fichier) ───────────
STATE_FILE="/tmp/keepalive-test-state"
export STATE_FILE
rm -f "$STATE_FILE"
gh() {
  if [ "$1" = "variable" ] && [ "$2" = "get" ]; then
    # En production : si la variable n'existe pas, gh échoue avec stdout VIDE
    [ -f "$STATE_FILE" ] && cat "$STATE_FILE" || return 1
  elif [ "$1" = "variable" ] && [ "$2" = "set" ]; then
    # gh variable set NOM VALEUR --repo R → $3=NOM, $4=VALEUR
    echo "$4" > "$STATE_FILE"
  else
    return 0
  fi
}
export -f gh 2>/dev/null || true

# ── Simuler curl : API down (000) ────────────────────────────
curl() {
  echo "000"
}
export -f curl 2>/dev/null || true

GITHUB_REPOSITORY="test/repo"
DEDUP_VAR="KEEPALIVE_LAST_ALERT"
RENDER_URL="https://test.onrender.com"
ALERT_QUIET_MS="3600000"
TELEGRAM_BOT_TOKEN=""
BREVO_API_KEY=""
ALERT_EMAIL_TO=""
export GITHUB_REPOSITORY DEDUP_VAR RENDER_URL ALERT_QUIET_MS TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID BREVO_API_KEY ALERT_EMAIL_TO NOW_MS NOW_MS2 LAST_ALERT LAST_ALERT2

NOW_MS=$(node -e "console.log(Date.now())")
LAST_ALERT=$(gh variable get "$DEDUP_VAR" --repo "$GITHUB_REPOSITORY" 2>/dev/null || echo "0")
LAST_ALERT=${LAST_ALERT:-0}
ELAPSED=$((NOW_MS - LAST_ALERT))
if [ "$LAST_ALERT" -gt 0 ] && [ "$ELAPSED" -lt "$ALERT_QUIET_MS" ]; then
  echo "TEST 1 (dédup) : ÉCHEC — aurait dû alerter (première alerte)"
  FAIL=1
else
  echo "TEST 1 (première alerte) : OK — envoi déclenché"
fi

# Enregistrer la dédup puis re-simuler un down immédiat
gh variable set "$DEDUP_VAR" "$(node -e 'console.log(Date.now())')" --repo "$GITHUB_REPOSITORY" 2>/dev/null  NOW_MS2=$(node -e "console.log(Date.now())")
  LAST_ALERT2=$(gh variable get "$DEDUP_VAR" --repo "$GITHUB_REPOSITORY" 2>/dev/null || echo "0")
  LAST_ALERT2=${LAST_ALERT2:-0}
  ELAPSED2=$((NOW_MS2 - LAST_ALERT2))
if [ "$LAST_ALERT2" -gt 0 ] && [ "$ELAPSED2" -lt "$ALERT_QUIET_MS" ]; then
  echo "TEST 2 (dédup 60 min) : OK — alerte bloquée, pas de spam"
else
  echo "TEST 2 (dédup 60 min) : ÉCHEC — alerte renvoyée trop tôt"
  FAIL=1
fi

# ── Simuler une alerte Telegram configurée : vérifier le payload JSON ──
TELEGRAM_BOT_TOKEN="123456:test"
TELEGRAM_CHAT_ID="-100123"
TG_TEXT="ALERTE KEEP-ALIVE - API injoignable
Env: production
URL: https://test.onrender.com/health/ready
HTTP: 000"
PAYLOAD=$(node -e "process.stdout.write(JSON.stringify({chat_id: '$TELEGRAM_CHAT_ID', text: \`$TG_TEXT\`}))")
echo "TEST 3 (payload JSON valide) : $(echo "$PAYLOAD" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const o=JSON.parse(d);console.log(o.chat_id==='-100123'?'OK':'ÉCHEC')})")"
[ "$(echo "$PAYLOAD" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{process.stdout.write(JSON.parse(d).chat_id==='-100123'?'1':'0')})")" = "1" ] || FAIL=1

rm -f "$STATE_FILE"
if [ "$FAIL" = "0" ]; then
  echo ""
  echo "=== TOUS LES TESTS PASSENT ==="
else
  echo ""
  echo "=== ÉCHECS DÉTECTÉS ==="
  exit 1
fi
