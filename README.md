# StudySpark AI (Flask Backend)

StudySpark AI combines a React frontend with a Flask backend. Existing Groq model integration and study features are preserved.

## Requirements

- Python 3.10+
- Node.js and npm
- A Groq API key

## Run on Windows PowerShell

### 1. Configure the backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
```

Add your actual API key after `GROQ_API_KEY=` in `backend/.env`. Never commit or share this file.

### 2. Start Flask

From the `backend` folder, with the virtual environment activated:

```powershell
python -m flask --app main run --host 127.0.0.1 --port 5000 --debug
```

Check `http://127.0.0.1:5000/` in your browser.

### 3. Start the React frontend

Open a second PowerShell window:

```powershell
cd path\to\StudySpark_AI\frontend
npm ci
npm run dev
```

Open the Vite URL displayed in the terminal, usually `http://localhost:5173`.

## API Routes

- `GET /` — health check
- `POST /api/study` — summary, quiz, flashcards, and weak-topic recommendations
- `POST /api/upload-pdf` — extracts selectable PDF text (10 MB maximum)

The frontend connects to Flask at `http://127.0.0.1:5000`.

**Note:** This project does not include LifeWise AI integration or an authentication layer.

## Progress Tracker module (integrated)

The LifeWise Progress Tracker is available as a separate **Progress Tracker** navigation tab immediately below **Prediction History**.

### Included features
- Neon-glass study dashboard and weekly focus-performance bars
- Adjustable Pomodoro focus timer with sound cues
- Study task creation, completion, and deletion
- Recent study sessions, daily focus summary, and configurable weekly goal

### Backend
The existing Flask application registers `progress_tracker_routes.py` as a blueprint. Tracker data uses a separate local SQLite database (`backend/progress_tracker.db`) and does not reuse or modify the StudySpark authentication/prediction database.

### Run on Windows
1. Start the backend using the existing backend environment and project instructions:
   `cd backend`
   `python -m flask --app main run --host 127.0.0.1 --port 5000 --debug`
2. In a second terminal:
   `cd frontend`
   `npm install`
   `npm run dev`
3. Sign in to StudySpark and select **Progress Tracker** in the sidebar.

The local tracker database is created automatically the first time the backend starts. Do not commit `.env`, local databases, virtual environments, or `node_modules`.
