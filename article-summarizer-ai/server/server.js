const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env"), override: true });

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const summaryRoutes = require("./routes/summaryRoutes");
const { liveUpdates } = require("./utils/liveUpdates");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api", summaryRoutes);
app.use("/api/summarize", summaryRoutes);

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

// Serve React frontend
app.use(express.static(path.join(__dirname, "../client/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
