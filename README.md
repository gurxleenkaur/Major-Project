# StudySpark AI (Flask backend)

StudySpark AI frontend and Flask backend. Existing Groq model and study features are preserved.

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
Put your actual key after `GROQ_API_KEY=` in `backend/.env`. Do not share this file.

### 2. Start Flask
From the `backend` folder, with the virtual environment activated:
```powershell
python -m flask --app main run --host 127.0.0.1 --port 5000 --debug
```
Check `http://127.0.0.1:5000/` in your browser.

### 3. Start React in a second PowerShell window
```powershell
cd path\to\StudySpark_AI\frontend
npm ci
npm run dev
```
Open the Vite URL printed in the terminal, usually `http://localhost:5173`.

## API routes
- `GET /` — health check
- `POST /api/study` — summary, quiz, flashcards, and weak-topic recommendations
- `POST /api/upload-pdf` — extracts selectable PDF text (10 MB maximum)

The frontend points to Flask at `http://127.0.0.1:5000`. No LifeWise AI integration or authentication layer is included.
