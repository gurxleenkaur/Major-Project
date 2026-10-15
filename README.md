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