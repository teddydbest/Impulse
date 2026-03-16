#!/usr/bin/env python3
"""To-Do Dashboard - Local web UI for task management with priority levels."""

import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, Response

APP_DIR = Path(__file__).parent.resolve()
TASKS_FILE = APP_DIR / "tasks.json"
LOG_FILE = APP_DIR / "tasks.log"

app = Flask(__name__)


def log_activity(message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{timestamp}] {message}\n"
    with open(LOG_FILE, "a") as f:
        f.write(entry)


def load_tasks() -> list[dict]:
    if not TASKS_FILE.exists():
        return []
    with open(TASKS_FILE, "r") as f:
        return json.load(f)


def save_tasks(tasks: list[dict]) -> None:
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)


# ── API Routes ──────────────────────────────────────────────────────────────

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(load_tasks())


@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json()
    if not data or not data.get("title"):
        return jsonify({"error": "title is required"}), 400

    priority = data.get("priority", "medium")
    if priority not in ("low", "medium", "high", "critical"):
        return jsonify({"error": "priority must be low, medium, high, or critical"}), 400

    task = {
        "id": str(uuid.uuid4()),
        "title": data["title"],
        "description": data.get("description", ""),
        "priority": priority,
        "status": "pending",
        "created_at": datetime.now().isoformat(),
        "completed_at": None,
    }
    tasks = load_tasks()
    tasks.append(task)
    save_tasks(tasks)
    log_activity(f"CREATED task '{task['title']}' [priority={task['priority']}] id={task['id']}")
    return jsonify(task), 201


@app.route("/api/tasks/<task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json()
    tasks = load_tasks()
    for task in tasks:
        if task["id"] == task_id:
            if "title" in data:
                task["title"] = data["title"]
            if "description" in data:
                task["description"] = data["description"]
            if "priority" in data:
                if data["priority"] not in ("low", "medium", "high", "critical"):
                    return jsonify({"error": "invalid priority"}), 400
                task["priority"] = data["priority"]
            if "status" in data:
                if data["status"] not in ("pending", "in_progress", "completed"):
                    return jsonify({"error": "invalid status"}), 400
                task["status"] = data["status"]
                if data["status"] == "completed":
                    task["completed_at"] = datetime.now().isoformat()
            save_tasks(tasks)
            log_activity(f"UPDATED task '{task['title']}' id={task_id}")
            return jsonify(task)
    return jsonify({"error": "task not found"}), 404


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    tasks = load_tasks()
    for i, task in enumerate(tasks):
        if task["id"] == task_id:
            removed = tasks.pop(i)
            save_tasks(tasks)
            log_activity(f"DELETED task '{removed['title']}' id={task_id}")
            return jsonify({"message": "deleted"})
    return jsonify({"error": "task not found"}), 404


@app.route("/api/logs", methods=["GET"])
def get_logs():
    if not LOG_FILE.exists():
        return jsonify({"logs": ""})
    return jsonify({"logs": LOG_FILE.read_text()})


# ── Web UI ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return Response(HTML_PAGE, content_type="text/html")


HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>To-Do Dashboard</title>
<style>
  :root {
    --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a;
    --text: #e1e4ed; --muted: #8b8fa3;
    --accent: #6c63ff; --accent-hover: #5a52e0;
    --critical: #ff4d6a; --high: #ff9f43; --medium: #ffd93d; --low: #54d48c;
    --success: #54d48c; --danger: #ff4d6a;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg); color: var(--text); min-height: 100vh;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
  h1 { font-size: 1.8rem; margin-bottom: 1.5rem; }
  h1 span { color: var(--accent); }

  /* Tabs */
  .tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
  .tab {
    padding: .5rem 1rem; border-radius: 8px; cursor: pointer;
    background: var(--surface); border: 1px solid var(--border);
    color: var(--muted); font-size: .9rem; transition: .2s;
  }
  .tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  /* Form */
  .form-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;
  }
  .form-row { display: flex; gap: .75rem; flex-wrap: wrap; }
  .form-row input, .form-row select {
    flex: 1; min-width: 140px; padding: .6rem .8rem; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text);
    font-size: .9rem;
  }
  .form-row input:focus, .form-row select:focus { outline: none; border-color: var(--accent); }
  .btn {
    padding: .6rem 1.2rem; border-radius: 8px; border: none; cursor: pointer;
    font-size: .9rem; font-weight: 600; transition: .2s;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: var(--accent-hover); }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-sm { padding: .35rem .7rem; font-size: .8rem; }

  /* Task list */
  .task-list { display: flex; flex-direction: column; gap: .5rem; }
  .task-item {
    display: flex; align-items: center; gap: .75rem;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: .85rem 1rem; transition: .2s;
  }
  .task-item:hover { border-color: var(--accent); }
  .priority-dot {
    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  }
  .priority-dot.critical { background: var(--critical); }
  .priority-dot.high { background: var(--high); }
  .priority-dot.medium { background: var(--medium); }
  .priority-dot.low { background: var(--low); }
  .task-info { flex: 1; }
  .task-title { font-weight: 600; font-size: .95rem; }
  .task-title.done { text-decoration: line-through; color: var(--muted); }
  .task-meta { font-size: .78rem; color: var(--muted); margin-top: 2px; }
  .task-actions { display: flex; gap: .4rem; }
  .badge {
    padding: .2rem .5rem; border-radius: 6px; font-size: .72rem;
    font-weight: 600; text-transform: uppercase;
  }
  .badge-pending { background: #2a2d3a; color: var(--muted); }
  .badge-in_progress { background: #1e3a5f; color: #5eb8ff; }
  .badge-completed { background: #1a3d2a; color: var(--success); }

  /* Logs */
  .log-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 1rem; font-family: 'SF Mono', monospace;
    font-size: .82rem; white-space: pre-wrap; max-height: 500px;
    overflow-y: auto; color: var(--muted); line-height: 1.6;
  }

  /* Edit modal */
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6);
    z-index: 100; justify-content: center; align-items: center;
  }
  .modal-overlay.show { display: flex; }
  .modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 1.5rem; width: 420px; max-width: 90vw;
  }
  .modal h2 { font-size: 1.2rem; margin-bottom: 1rem; }
  .modal label { display: block; font-size: .85rem; color: var(--muted); margin: .6rem 0 .25rem; }
  .modal input, .modal select, .modal textarea {
    width: 100%; padding: .55rem .75rem; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg); color: var(--text);
    font-size: .9rem;
  }
  .modal textarea { resize: vertical; min-height: 60px; font-family: inherit; }
  .modal-actions { display: flex; gap: .5rem; justify-content: flex-end; margin-top: 1rem; }
  .empty { text-align: center; padding: 3rem; color: var(--muted); }
</style>
</head>
<body>
<div class="container">
  <h1><span>&#9745;</span> To-Do Dashboard</h1>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('tasks')">Tasks</div>
    <div class="tab" onclick="switchTab('logs')">Activity Log</div>
  </div>

  <!-- Tasks view -->
  <div id="tasks-view">
    <div class="form-card">
      <div class="form-row">
        <input type="text" id="task-title" placeholder="Task title..." />
        <select id="task-priority">
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button class="btn btn-primary" onclick="addTask()">Add Task</button>
      </div>
    </div>
    <div id="task-list" class="task-list"></div>
  </div>

  <!-- Logs view -->
  <div id="logs-view" style="display:none;">
    <div class="log-box" id="log-content">Loading...</div>
  </div>
</div>

<!-- Edit modal -->
<div class="modal-overlay" id="edit-modal">
  <div class="modal">
    <h2>Edit Task</h2>
    <input type="hidden" id="edit-id" />
    <label>Title</label>
    <input type="text" id="edit-title" />
    <label>Description</label>
    <textarea id="edit-desc"></textarea>
    <label>Priority</label>
    <select id="edit-priority">
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="critical">Critical</option>
    </select>
    <label>Status</label>
    <select id="edit-status">
      <option value="pending">Pending</option>
      <option value="in_progress">In Progress</option>
      <option value="completed">Completed</option>
    </select>
    <div class="modal-actions">
      <button class="btn" style="background:var(--border);color:var(--text)" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEdit()">Save</button>
    </div>
  </div>
</div>

<script>
const API = '/api/tasks';
const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

async function fetchTasks() {
  const res = await fetch(API);
  const tasks = await res.json();
  tasks.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });
  renderTasks(tasks);
}

function renderTasks(tasks) {
  const el = document.getElementById('task-list');
  if (!tasks.length) {
    el.innerHTML = '<div class="empty">No tasks yet. Add one above!</div>';
    return;
  }
  el.innerHTML = tasks.map(t => `
    <div class="task-item">
      <div class="priority-dot ${t.priority}"></div>
      <div class="task-info">
        <div class="task-title ${t.status === 'completed' ? 'done' : ''}">${esc(t.title)}</div>
        <div class="task-meta">${t.priority} &middot; ${new Date(t.created_at).toLocaleDateString()}
          ${t.description ? ' &middot; ' + esc(t.description) : ''}</div>
      </div>
      <span class="badge badge-${t.status}">${t.status.replace('_', ' ')}</span>
      <div class="task-actions">
        <button class="btn btn-primary btn-sm" onclick='openEdit(${JSON.stringify(t)})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTask('${t.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function esc(s) {
  const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}

async function addTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) return;
  const priority = document.getElementById('task-priority').value;
  await fetch(API, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ title, priority })
  });
  document.getElementById('task-title').value = '';
  fetchTasks();
}

document.getElementById('task-title').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  fetchTasks();
}

function openEdit(task) {
  document.getElementById('edit-id').value = task.id;
  document.getElementById('edit-title').value = task.title;
  document.getElementById('edit-desc').value = task.description || '';
  document.getElementById('edit-priority').value = task.priority;
  document.getElementById('edit-status').value = task.status;
  document.getElementById('edit-modal').classList.add('show');
}

function closeModal() { document.getElementById('edit-modal').classList.remove('show'); }

async function saveEdit() {
  const id = document.getElementById('edit-id').value;
  await fetch(`${API}/${id}`, {
    method: 'PUT', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      title: document.getElementById('edit-title').value,
      description: document.getElementById('edit-desc').value,
      priority: document.getElementById('edit-priority').value,
      status: document.getElementById('edit-status').value,
    })
  });
  closeModal();
  fetchTasks();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', (tab === 'tasks' && i === 0) || (tab === 'logs' && i === 1));
  });
  document.getElementById('tasks-view').style.display = tab === 'tasks' ? '' : 'none';
  document.getElementById('logs-view').style.display = tab === 'logs' ? '' : 'none';
  if (tab === 'logs') fetchLogs();
}

async function fetchLogs() {
  const res = await fetch('/api/logs');
  const data = await res.json();
  document.getElementById('log-content').textContent = data.logs || 'No activity yet.';
}

fetchTasks();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    print(f"To-Do Dashboard running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
