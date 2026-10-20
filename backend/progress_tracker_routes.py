from datetime import date, datetime, time, timedelta
from flask import Blueprint, jsonify, request
from progress_tracker_db import get_connection, init_db

progress_tracker_bp = Blueprint("progress_tracker", __name__)
init_db()

def row_dict(row):
    return dict(row) if row is not None else None

def error(message, status=400):
    return jsonify({"error": message}), status

def parse_iso_date(value, field_name):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must use YYYY-MM-DD format.")

def monday_for(day):
    return day - timedelta(days=day.weekday())

@progress_tracker_bp.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "LifeWise AI Focus & Progress Tracker"})

# --------------------------- Study sessions ---------------------------

@progress_tracker_bp.get("/api/sessions")
def list_sessions():
    limit = request.args.get("limit", default=100, type=int)
    limit = max(1, min(limit or 100, 500))
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM study_sessions ORDER BY started_at DESC, id DESC LIMIT ?",
            (limit,)
        ).fetchall()
    return jsonify([row_dict(row) for row in rows])

@progress_tracker_bp.post("/api/sessions")
def create_session():
    data = request.get_json(silent=True) or {}
    subject = str(data.get("subject", "")).strip()
    status = str(data.get("status", "completed")).strip().lower()
    planned = data.get("planned_minutes", 25)
    duration = data.get("duration_minutes", 0)
    started_at = data.get("started_at")
    ended_at = data.get("ended_at") or datetime.now().astimezone().isoformat(timespec="seconds")

    if not subject:
        return error("Subject is required.")
    if status not in ("completed", "interrupted"):
        return error("Status must be 'completed' or 'interrupted'.")
    try:
        planned = int(planned)
        duration = int(duration)
        if not 1 <= planned <= 1440:
            return error("planned_minutes must be between 1 and 1440.")
        if not 0 <= duration <= 1440:
            return error("duration_minutes must be between 0 and 1440.")
        if started_at:
            datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        else:
            started_at = ended_at
        datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return error("Invalid duration or timestamp.")

    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO study_sessions
            (subject, planned_minutes, duration_minutes, status, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (subject, planned, duration, status, started_at, ended_at))
        row = conn.execute("SELECT * FROM study_sessions WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(row_dict(row)), 201

@progress_tracker_bp.delete("/api/sessions/<int:session_id>")
def delete_session(session_id):
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM study_sessions WHERE id = ?", (session_id,))
    if cursor.rowcount == 0:
        return error("Session not found.", 404)
    return jsonify({"message": "Session deleted."})

# ----------------------------- Study tasks -----------------------------

@progress_tracker_bp.get("/api/tasks")
def list_tasks():
    status = request.args.get("status", "all")
    query = "SELECT * FROM study_tasks"
    params = []
    if status == "pending":
        query += " WHERE is_completed = 0"
    elif status == "completed":
        query += " WHERE is_completed = 1"
    elif status != "all":
        return error("status must be all, pending, or completed.")
    query += " ORDER BY is_completed ASC, CASE WHEN deadline IS NULL OR deadline = '' THEN 1 ELSE 0 END, deadline ASC, id DESC"
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return jsonify([row_dict(row) for row in rows])

@progress_tracker_bp.post("/api/tasks")
def create_task():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    subject = str(data.get("subject", "")).strip()
    deadline = data.get("deadline") or None
    estimated = data.get("estimated_minutes", 30)
    if not title:
        return error("Task title is required.")
    try:
        estimated = int(estimated)
        if not 1 <= estimated <= 1440:
            return error("estimated_minutes must be between 1 and 1440.")
        if deadline:
            parse_iso_date(deadline, "deadline")
    except (ValueError, TypeError) as exc:
        return error(str(exc))
    with get_connection() as conn:
        cursor = conn.execute("""
            INSERT INTO study_tasks (title, subject, deadline, estimated_minutes)
            VALUES (?, ?, ?, ?)
        """, (title, subject, deadline, estimated))
        row = conn.execute("SELECT * FROM study_tasks WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(row_dict(row)), 201

@progress_tracker_bp.patch("/api/tasks/<int:task_id>")
def update_task(task_id):
    data = request.get_json(silent=True) or {}
    allowed = {"title", "subject", "deadline", "estimated_minutes", "is_completed"}
    if not any(key in data for key in allowed):
        return error("Provide at least one field to update.")
    with get_connection() as conn:
        existing = conn.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
        if not existing:
            return error("Task not found.", 404)
        title = str(data.get("title", existing["title"])).strip()
        subject = str(data.get("subject", existing["subject"])).strip()
        deadline = data.get("deadline", existing["deadline"]) or None
        estimated = data.get("estimated_minutes", existing["estimated_minutes"])
        completed = int(bool(data.get("is_completed", existing["is_completed"])))
        if not title:
            return error("Task title is required.")
        try:
            estimated = int(estimated)
            if not 1 <= estimated <= 1440:
                return error("estimated_minutes must be between 1 and 1440.")
            if deadline:
                parse_iso_date(deadline, "deadline")
        except (ValueError, TypeError) as exc:
            return error(str(exc))
        completed_at = existing["completed_at"]
        if completed and not existing["is_completed"]:
            completed_at = datetime.now().astimezone().isoformat(timespec="seconds")
        elif not completed:
            completed_at = None
        conn.execute("""
            UPDATE study_tasks
            SET title=?, subject=?, deadline=?, estimated_minutes=?, is_completed=?, completed_at=?
            WHERE id=?
        """, (title, subject, deadline, estimated, completed, completed_at, task_id))
        row = conn.execute("SELECT * FROM study_tasks WHERE id = ?", (task_id,)).fetchone()
    return jsonify(row_dict(row))

@progress_tracker_bp.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM study_tasks WHERE id = ?", (task_id,))
    if cursor.rowcount == 0:
        return error("Task not found.", 404)
    return jsonify({"message": "Task deleted."})

# -------------------------------- Goals --------------------------------

@progress_tracker_bp.get("/api/goals/current")
def get_current_goal():
    today = date.today()
    week_start = monday_for(today).isoformat()
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM study_goals WHERE week_start = ?", (week_start,)).fetchone()
        if row is None:
            conn.execute("INSERT OR IGNORE INTO study_goals (week_start, goal_minutes) VALUES (?, ?)", (week_start, 600))
            row = conn.execute("SELECT * FROM study_goals WHERE week_start = ?", (week_start,)).fetchone()
    return jsonify(row_dict(row))

@progress_tracker_bp.put("/api/goals/current")
def set_current_goal():
    data = request.get_json(silent=True) or {}
    try:
        goal_minutes = int(data.get("goal_minutes", 600))
        if not 1 <= goal_minutes <= 10080:
            return error("goal_minutes must be between 1 and 10080.")
    except (ValueError, TypeError):
        return error("goal_minutes must be a whole number.")
    week_start = monday_for(date.today()).isoformat()
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO study_goals (week_start, goal_minutes) VALUES (?, ?)
            ON CONFLICT(week_start) DO UPDATE SET goal_minutes=excluded.goal_minutes
        """, (week_start, goal_minutes))
        row = conn.execute("SELECT * FROM study_goals WHERE week_start = ?", (week_start,)).fetchone()
    return jsonify(row_dict(row))

# ------------------------------ Analytics ------------------------------

@progress_tracker_bp.get("/api/reports/weekly")
def weekly_report():
    today = date.today()
    start = monday_for(today)
    end = start + timedelta(days=6)
    start_dt = datetime.combine(start, time.min).astimezone().isoformat(timespec="seconds")
    end_dt = datetime.combine(end + timedelta(days=1), time.min).astimezone().isoformat(timespec="seconds")
    with get_connection() as conn:
        sessions = conn.execute("""
            SELECT * FROM study_sessions
            WHERE started_at >= ? AND started_at < ?
            ORDER BY started_at ASC
        """, (start_dt, end_dt)).fetchall()
        goal_row = conn.execute("SELECT goal_minutes FROM study_goals WHERE week_start = ?", (start.isoformat(),)).fetchone()
        tasks_total = conn.execute("""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) AS completed
            FROM study_tasks
        """).fetchone()

    daily = []
    for offset in range(7):
        day = start + timedelta(days=offset)
        day_sessions = []
        for session in sessions:
            try:
                session_day = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00")).date()
            except ValueError:
                continue
            if session_day == day:
                day_sessions.append(session)
        daily.append({
            "date": day.isoformat(),
            "day": day.strftime("%a"),
            "minutes": sum(s["duration_minutes"] for s in day_sessions),
            "sessions": len(day_sessions),
        })

    total_minutes = sum(item["minutes"] for item in daily)
    completed_sessions = sum(1 for s in sessions if s["status"] == "completed")
    goal_minutes = goal_row["goal_minutes"] if goal_row else 600
    task_total = tasks_total["total"] or 0
    task_completed = tasks_total["completed"] or 0
    percent = round(min(100, total_minutes / goal_minutes * 100)) if goal_minutes else 0

    if total_minutes == 0:
        insight = "Start with one short focus session today. Small, consistent sessions build a habit."
    elif total_minutes < goal_minutes:
        remaining = max(0, goal_minutes - total_minutes)
        insight = f"You have studied {total_minutes} minutes this week. Another {remaining} minutes will reach your weekly goal."
    else:
        insight = "Great work! You have reached your weekly study-time goal. Keep your routine sustainable."

    return jsonify({
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "total_minutes": total_minutes,
        "total_hours": round(total_minutes / 60, 1),
        "completed_sessions": completed_sessions,
        "all_sessions": len(sessions),
        "goal_minutes": goal_minutes,
        "goal_progress_percent": percent,
        "tasks_total": task_total,
        "tasks_completed": task_completed,
        "task_completion_percent": round(task_completed / task_total * 100) if task_total else 0,
        "daily": daily,
        "insight": insight,
    })

@progress_tracker_bp.get("/api/reports/summary")
def summary_report():
    today = date.today()
    today_start = datetime.combine(today, time.min).astimezone().isoformat(timespec="seconds")
    tomorrow_start = datetime.combine(today + timedelta(days=1), time.min).astimezone().isoformat(timespec="seconds")
    with get_connection() as conn:
        today_minutes = conn.execute("""
            SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
            FROM study_sessions WHERE started_at >= ? AND started_at < ?
        """, (today_start, tomorrow_start)).fetchone()["minutes"]
        pending = conn.execute("SELECT COUNT(*) AS count FROM study_tasks WHERE is_completed=0").fetchone()["count"]
        completed = conn.execute("SELECT COUNT(*) AS count FROM study_tasks WHERE is_completed=1").fetchone()["count"]
    return jsonify({"date": today.isoformat(), "today_minutes": today_minutes,
                    "pending_tasks": pending, "completed_tasks": completed})

@progress_tracker_bp.errorhandler(404)
def not_found(_):
    return jsonify({"error": "Endpoint not found."}), 404

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
