#!/bin/zsh
# Instaluje comiesięczny backup (1. dzień miesiąca, 9:00) jako LaunchAgent macOS.
# Jeśli Mac śpi o tej porze, launchd uruchomi backup po wybudzeniu.
#
#   ./setup/install-backup-schedule.sh             zainstaluj / zaktualizuj
#   ./setup/install-backup-schedule.sh --uninstall usuń harmonogram
#
# Przed instalacją uruchom backup raz ręcznie (node setup/backup-finance-docs.mjs),
# żeby się zalogować. Harmonogram korzysta z zapisanego tokenu.
set -euo pipefail

LABEL="com.logisticfit.finance-backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT="$(cd "$(dirname "$0")" && pwd)/backup-finance-docs.mjs"
LOG_DIR="$HOME/LogisticFit-Finance-Backup/logs"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Harmonogram usunięty."
  exit 0
fi

NODE="$(command -v node)" || { echo "Nie znaleziono node w PATH"; exit 1; }
[[ -f "$HOME/.logisticfit-finance/token.json" ]] || {
  echo "Brak zapisanego logowania. Najpierw uruchom: node $SCRIPT"; exit 1; }

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$SCRIPT</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Day</key><integer>1</integer><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/backup.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Zainstalowano: backup co miesiąc 1. dnia o 9:00. Log: $LOG_DIR/backup.log"
echo "Test od razu: launchctl kickstart gui/$(id -u)/$LABEL"
