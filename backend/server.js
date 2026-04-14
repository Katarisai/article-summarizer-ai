const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: true });

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const summaryRoutes = require("./routes/summaryRoutes");
const { liveUpdates } = require("./utils/liveUpdates");

const app = express();

const logStartupChecks = () => {
  const hasMongoUri = Boolean((process.env.MONGO_URI || "").trim());
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();
  const hasOpenAiKey = Boolean(openAiKey);
  const openAiLooksValid = openAiKey.startsWith("sk-");
  const ffmpegPath = (process.env.FFMPEG_PATH || "ffmpeg").trim();
  const ffprobePath = (process.env.FFPROBE_PATH || "ffprobe").trim();

  console.log("[Startup] Environment checks:");
  console.log(`[Startup] MONGO_URI: ${hasMongoUri ? "set" : "missing"}`);
  console.log(`[Startup] OPENAI_API_KEY: ${hasOpenAiKey ? "set" : "missing"}`);

  if (hasOpenAiKey && !openAiLooksValid) {
    console.warn("[Startup] OPENAI_API_KEY format may be invalid (expected prefix sk-).");
  }

  console.log(`[Startup] FFMPEG_PATH: ${ffmpegPath}`);
  console.log(`[Startup] FFPROBE_PATH: ${ffprobePath}`);
};

const enforceProductionSecrets = () => {
  const isProduction = (process.env.NODE_ENV || "").trim().toLowerCase() === "production";
  const openAiKey = (process.env.OPENAI_API_KEY || "").trim();
  const hasOpenAiKey = Boolean(openAiKey);
  const openAiLooksValid = openAiKey.startsWith("sk-");

  if (!isProduction) {
    return;
  }

  if (!hasOpenAiKey || !openAiLooksValid) {
    console.error("[Startup] Production requires a valid OPENAI_API_KEY (expected sk- prefix).");
    console.error("[Startup] Railway fix: set OPENAI_API_KEY in Variables and redeploy.");
    process.exit(1);
  }
};

logStartupChecks();
enforceProductionSecrets();
connectDB();

app.use(cors());
app.use(express.json());

app.use("/api", summaryRoutes);
app.use("/api/summarize", summaryRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, service: "article-summarizer-ai" });
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const sendEvent = (eventName, payload) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const handleSummaryChange = (payload) => sendEvent("summary-change", payload);
  const handleHistoryChange = (payload) => sendEvent("history-change", payload);

  liveUpdates.on("summary-change", handleSummaryChange);
  liveUpdates.on("history-change", handleHistoryChange);

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    liveUpdates.off("summary-change", handleSummaryChange);
    liveUpdates.off("history-change", handleHistoryChange);
    res.end();
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
