const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 8080;

app.use(express.static(__dirname));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Frontend server is running.");
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://127.0.0.1:${PORT}`);
});
