# Article Summarizer AI

Article Summarizer AI is a full-stack React + Express + MongoDB application that summarizes text, URLs, images, audio, video, and documents. It includes OpenAI Vision analysis, OCR fallback for images, AI chat follow-ups, history storage, and live history sync.

## Features

- Multi-source summarization:
  - Plain text
  - Web URLs
  - Images (Vision + OCR fallback)
  - Audio files
  - Video files
  - Documents (PDF, DOCX, TXT, image documents)
- Summary modes:
  - Summary
  - Rewrite
  - Bullet points
- Multi-language output
- AI chat Q&A based on generated summary/context
- Key points and markdown summary export
- Mind map rendering from summary key points
- Upload progress UI for media/document uploads
- OCR preprocessing pipeline for difficult images (grayscale, normalize, threshold)
- Vision failure transparency (fallback mode and visible Vision error details)
- MongoDB-backed history with delete support
- Live history updates via server-sent events (SSE)
- Responsive Tailwind CSS interface

## Tech Stack

- Frontend: React, Tailwind CSS, Axios
- Backend: Node.js, Express, Multer
- Database: MongoDB (Mongoose)
- AI/OCR: OpenAI API, Tesseract.js, Sharp
- Parsing/Extraction: Cheerio, Mammoth, pdf-parse
- Visualization: Mermaid

## Project Structure

- Root app launcher: `server.js` (loads `server/server.js`)
- Backend app: `server/`
- Frontend app: `client/`

## Installation

1. Clone repository

```bash
git clone https://github.com/Katarisai/article-summarizer-ai.git
cd article-summarizer-ai
```

2. Install dependencies

```bash
npm run install-all
```

## Environment Variables

Create a `.env` file in the project root (same level as `server.js`):

```env
MONGO_URI=your_mongodb_connection_string
OPENAI_API_KEY=sk-your_openai_key
PORT=5000

# Optional ffmpeg/ffprobe overrides (needed for large media preprocessing)
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

Notes:

- Keep `.env` private.
- If ffmpeg is not in your PATH, set `FFMPEG_PATH` and `FFPROBE_PATH` explicitly.

## Run Locally

Run backend and frontend in separate terminals.

Terminal 1 (backend):

```bash
npm run dev:server
```

Terminal 2 (frontend):

```bash
npm run dev:client
```

Frontend: http://localhost:3000
Backend: http://localhost:5000

## API Endpoints

Base route is mounted at both `/api` and `/api/summarize` for compatibility.

### Summarization

- `POST /api/summarize-text`
- `POST /api/summarize-url`
- `POST /api/summarize-image` (multipart field: `image`)
- `POST /api/summarize-video` (multipart field: `video`)
- `POST /api/summarize-audio` (multipart field: `audio`)
- `POST /api/summarize-document` (multipart field: `document`)

Compatibility aliases:

- `POST /api/summarize/image`
- `POST /api/summarize` (maps to text summarize)
- `POST /api/` (maps to text summarize)

### Chat

- `POST /api/chat`

### History

- `GET /api/history`
- `DELETE /api/history/:id`
- Legacy delete alias: `DELETE /api/:id`

### Live updates

- `GET /api/events` (SSE stream for summary/history changes)

## Upload Limits

- Image: 20MB
- Document: 100MB
- Audio: 512MB
- Video: 1GB

For audio/video transcription, large files are automatically preprocessed and chunked when ffmpeg is available.

## Troubleshooting

- Vision errors:
  - The app now returns and displays `visionError` details when Vision fails and OCR fallback is used.
- OCR low-confidence text:
  - Very short/low-confidence OCR fragments are hidden from UI and replaced with a low-confidence analysis summary.
- OpenAI key issues:
  - Ensure `OPENAI_API_KEY` is valid and has active billing/quota.
- Mongo connection issues:
  - Verify `MONGO_URI` and database network access.

## Scripts

From project root:

- `npm run install-all` - install root, backend, and frontend dependencies
- `npm run dev` - start backend dev server
- `npm run dev:server` - start backend dev server
- `npm run dev:client` - start frontend dev server
- `npm start` - start backend in production mode

## License

MIT
