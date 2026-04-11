# Article Summarizer AI

Article Summarizer AI is a full-stack MERN application with a modern Tailwind CSS UI that can summarize, rewrite, convert to bullet points, and create multi-language summaries. It stores history in MongoDB and supports delete, copy, download, and dark mode.

## Features

- AI summarization
- AI rewrite
- Bullet summary
- Multi-language summary
- MongoDB history storage
- Auto-load history on page load
- Delete history items
- Copy summary
- Download summary
- Loading UI state
- Clear input button
- Character counter
- Dark mode
- Responsive Tailwind layout
- Error handling

## Tech Stack

- React.js
- Tailwind CSS
- Node.js
- Express.js
- MongoDB
- OpenAI API

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/your-username/article-summarizer-ai.git
cd article-summarizer-ai
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Install frontend dependencies

```bash
cd ../client
npm install
```

### 4. Configure environment variables

Create a `.env` file in the project root:

```env
MONGO_URI=your_mongodb_url
OPENAI_API_KEY=your_openai_api_key
# Optional: override ffmpeg binaries for large media preprocessing
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

Use `.env.example` as a template.

### 5. Install ffmpeg (recommended for large media)

Audio/video files above 25MB are automatically preprocessed and chunked for transcription.

- Windows (winget): `winget install Gyan.FFmpeg`
- macOS (brew): `brew install ffmpeg`
- Ubuntu/Debian: `sudo apt install ffmpeg`

If `ffmpeg` is not in PATH, set `FFMPEG_PATH` and `FFPROBE_PATH` in `.env`.

## Run the Project

### Backend

```bash
cd server
npm run dev
```

### Frontend

```bash
cd client
npm start
```

## API Endpoints

### Summarize, rewrite, bulletize, or translate summary

`POST /api/summarize`

Request body:

```json
{
  "text": "Your article text here",
  "mode": "summary",
  "language": "Spanish"
}
```

Supported modes:

- `summary`
- `rewrite`
- `bullet`
- `language`

### Get history

`GET /api/summarize/history`

### Delete history item

`DELETE /api/summarize/:id`

## Submission Checklist

- [x] AI summarization
- [x] MongoDB storage
- [x] History
- [x] Delete history
- [x] Copy summary
- [x] Download summary
- [x] Dark mode
- [x] Loading UI
- [x] Error handling
- [x] Responsive UI
- [x] Tailwind CSS setup
- [x] `.env.example`

## GitHub Push Commands

```bash
git init
git add .
git commit -m "Article Summarizer AI"
git branch -M main
git remote add origin <your_repo_url>
git push -u origin main
```

## Screenshots

Add application screenshots here before submission.

## Notes

- Keep your real `.env` file private.
- Add screenshots before final submission.
- Large audio/video support depends on ffmpeg availability on the server.
