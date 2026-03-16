#!/usr/bin/env bash
# Sets up an hourly cron job to run the task worker.
# Usage: bash setup_cron.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER="$SCRIPT_DIR/task_worker.py"
PYTHON="$(which python3)"

CRON_CMD="0 * * * * $PYTHON $WORKER >> $SCRIPT_DIR/tasks.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -qF "task_worker.py"; then
    echo "Cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -vF "task_worker.py" | { cat; echo "$CRON_CMD"; } | crontab -
else
    echo "Installing new cron job..."
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
fi

echo "Done. Hourly cron job installed:"
echo "  $CRON_CMD"
echo ""
echo "Verify with: crontab -l"
