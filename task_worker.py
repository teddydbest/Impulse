#!/usr/bin/env python3
"""Autonomous task worker - processes tasks from tasks.json by priority.

Designed to run via cron. On each run it:
1. Loads pending tasks from tasks.json
2. Sorts by priority (critical > high > medium > low)
3. Works through each task: marks in_progress, simulates work, marks completed
4. Logs every action to tasks.log
"""

import json
import time
from datetime import datetime
from pathlib import Path

APP_DIR = Path(__file__).parent.resolve()
TASKS_FILE = APP_DIR / "tasks.json"
LOG_FILE = APP_DIR / "tasks.log"

PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] WORKER: {message}"
    print(entry)
    with open(LOG_FILE, "a") as f:
        f.write(entry + "\n")


def load_tasks() -> list[dict]:
    if not TASKS_FILE.exists():
        return []
    with open(TASKS_FILE, "r") as f:
        return json.load(f)


def save_tasks(tasks: list[dict]) -> None:
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)


def run() -> None:
    tasks = load_tasks()
    pending = [t for t in tasks if t["status"] in ("pending", "in_progress")]

    if not pending:
        log("No pending tasks. Nothing to do.")
        return

    # Sort by priority
    pending.sort(key=lambda t: PRIORITY_ORDER.get(t["priority"], 99))

    log(f"Found {len(pending)} pending task(s). Starting work...")

    for task in pending:
        task_id = task["id"]
        title = task["title"]
        priority = task["priority"]

        # Find this task in the main list and update in place
        for t in tasks:
            if t["id"] == task_id:
                # Mark in progress
                t["status"] = "in_progress"
                save_tasks(tasks)
                log(f"STARTED [{priority.upper()}] '{title}' (id={task_id})")

                # Simulate autonomous work on the task
                time.sleep(1)

                # Mark completed
                t["status"] = "completed"
                t["completed_at"] = datetime.now().isoformat()
                save_tasks(tasks)
                log(f"COMPLETED [{priority.upper()}] '{title}' (id={task_id})")
                break

    remaining = sum(1 for t in tasks if t["status"] in ("pending", "in_progress"))
    log(f"Worker finished. {len(pending)} task(s) completed. {remaining} remaining.")


if __name__ == "__main__":
    log("=== Worker run started ===")
    run()
    log("=== Worker run finished ===")
