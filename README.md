# CheatSheet.ai ⚡

> **Turn any documentation URL into a clean, structured, downloadable cheat sheet in seconds.**

[![Live Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://cheatsheet-generator-eight.vercel.app/)
[![Live Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://cheatsheetgenerator.onrender.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Groq](https://img.shields.io/badge/AI-Groq%20LPU-f55036)](https://groq.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](https://www.python.org/)

---

## 🌐 Live Deployments

- **Frontend App**: [https://cheatsheet-generator-eight.vercel.app/](https://cheatsheet-generator-eight.vercel.app/)
- **Backend API**: [https://cheatsheetgenerator.onrender.com/](https://cheatsheetgenerator.onrender.com/)

---

## 🚀 Overview

**CheatSheet.ai** is an AI-powered developer tool designed to condense verbose official documentation into concise, actionable, and beautifully formatted technical reference sheets.

Instead of reading through dozens of doc pages, paste any URL (e.g. `https://go.dev/doc/` or `https://react.dev/learn`). The backend crawls the site, strips out navigation and boilerplate, sends structured context to **Groq's ultra-fast LPU inference**, and streams back a real-time Markdown cheat sheet over **Server-Sent Events (SSE)**.

---

## ✨ Features

- 🕷️ **HTML Scraper & Cleaner**: Fetches target documentation and strips scripts, styles, forms, and boilerplate using BeautifulSoup4.
- ⚡ **Ultra-Fast Streaming**: Uses Server-Sent Events (`text/event-stream`) to stream tokens in real-time as the model generates them.
- 🤖 **Groq LLM Acceleration**: Powered by high-throughput models (`openai/gpt-oss-120b`) via Groq's OpenAI-compatible API.
- 🎨 **Modern Cyberpunk/Cyan UI**: Custom `#40f2dd` themed user interface with Lucide React iconography.
- 💻 **Syntax-Highlighted Code Blocks**: Copy-to-clipboard buttons on all generated code snippets with language detection (`highlight.js`).
- 📄 **PDF Export**: Server-side programmatic PDF generation with headings, bullet points, and code formatting via **ReportLab**.
- 📝 **Markdown Download**: Instant one-click export of raw Markdown (`.md`).
- 🔒 **Zero Persistence**: No database, no user tracking, no authentication required.

---

## 🏗️ Architecture & Pipeline

```text
[ Documentation URL ]
         │
         ▼
[ BeautifulSoup4 Scraper ] ──> Strips <script>, <style>, <nav>, ads
         │
         ▼
[ Structured Prompt Builder ]
         │
         ▼
[ Groq AI Inference Engine ] ──> gpt-oss-120b (streaming)
         │
         ▼ (SSE stream: status -> token -> done)
[ Next.js 16 + React Markdown ] ──> Real-time token rendering
         │
    ┌────┴─────────────────┐
    ▼                      ▼
[ Download .md ]    [ Programmatic PDF (ReportLab) ]
```

### Server-Sent Events (SSE) Protocol

| Event Type | Payload | Description |
|---|---|---|
| `status` | `{"type": "status", "message": "Fetching page…"}` | Progress updates during crawl/prep |
| `token` | `{"type": "token", "token": "..."}` | Real-time generated Markdown token stream |
| `done` | `{"type": "done"}` | Stream completion signal |
| `error` | `{"type": "error", "message": "..."}` | Error message if extraction or LLM fails |

---

## 📂 Project Structure

```text
Cheatsheet Generator/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI application, CORS & SSE streaming
│   │   ├── llm.py           # Groq/OpenAI streaming generator
│   │   ├── pdf.py           # Programmatic PDF generation with ReportLab
│   │   ├── schemas.py       # Pydantic request models
│   │   └── scraper.py       # Web scraping & HTML sanitization
│   ├── .env                 # Backend environment variables (ignored)
│   ├── .env.sample          # Sample environment variables
│   └── requirements.txt     # Python dependencies
│
├── frontend/
│   ├── app/
│   │   ├── globals.css      # Custom color tokens (#40f2dd theme) & typography
│   │   ├── layout.tsx       # Metadata, openGraph & favicon configuration
│   │   ├── page.tsx         # Main UI, SSE event consumer & PDF exporter
│   │   └── icon.png         # Next.js app icon
│   ├── lib/
│   │   └── stream.ts        # SSE streaming utility client
│   ├── public/
│   │   └── cheaticon.png    # Brand logo & favicon source
│   ├── .env.local           # Local environment variables
│   ├── .env.example         # Example frontend environment variables
│   ├── package.json         # Node.js dependencies
│   └── tsconfig.json        # TypeScript configuration
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Markdown & Syntax Highlighting**: `react-markdown`, `remark-gfm`, `rehype-highlight`, `rehype-raw`, `highlight.js`

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
- **AI & LLM**: [Groq API](https://groq.com/) via [OpenAI Python SDK](https://github.com/openai/openai-python)
- **HTML Parsing**: [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) + [lxml](https://lxml.de/)
- **PDF Generation**: [ReportLab](https://www.reportlab.com/)
- **Streaming**: Native FastAPI `StreamingResponse` (`text/event-stream`)

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
# Required: Your Groq API key (https://console.groq.com/keys)
GROQ_API_KEY=gsk_your_groq_api_key

# Optional: Comma-separated allowed CORS origins
ALLOWED_ORIGINS=http://localhost:3000,https://cheatsheet-generator-eight.vercel.app
```

### Frontend (`frontend/.env.local` or Vercel Settings)

```env
# Backend API base URL
NEXT_PUBLIC_BACKEND_URL=https://cheatsheetgenerator.onrender.com
```

*(For local development, set `NEXT_PUBLIC_BACKEND_URL=http://localhost:8000`)*

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Python**: 3.10+
- **Node.js**: 18+ and `npm`

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file and add your GROQ_API_KEY
cp .env.sample .env

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

The backend will be live at `http://localhost:8000`. Test health: `http://localhost:8000/`.

### 3. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be live at `http://localhost:3000`.

---

## 📡 API Reference

### `GET /`
Health check endpoint.
- **Response**: `{"message": "Cheatsheet Generator API"}`

### `POST /api/generate`
Streams generated cheatsheet over Server-Sent Events.
- **Request Body**:
  ```json
  {
    "url": "https://go.dev/doc/"
  }
  ```
- **Response**: `text/event-stream` chunks (`data: {"type": "token", "token": "..."}\n\n`)

### `POST /api/download/pdf`
Generates and downloads a formatted PDF from Markdown.
- **Request Body**:
  ```json
  {
    "markdown": "# Go Cheatsheet\n\n## Variables\n..."
  }
  ```
- **Response**: `application/pdf` binary download with `Content-Disposition: attachment; filename=cheatsheet.pdf`.

---

## 👤 Author

**Lakshya**
- GitHub: [@Lakshya787](https://github.com/Lakshya787)
- Frontend: [cheatsheet-generator-eight.vercel.app](https://cheatsheet-generator-eight.vercel.app/)

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
