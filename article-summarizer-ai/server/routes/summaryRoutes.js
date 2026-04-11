const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const {
  summarizeText,
  summarizeUrl,
  summarizeVideo,
  summarizeAudio,
  summarizeDocument,
  summarizeImage,
  chatWithArticle,
  getHistory,
  deleteHistory
} = require("../controllers/summaryController");

const uploadDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MAX_AUDIO_UPLOAD_BYTES = 512 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname.replace(/\s+/g, "-")}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-matroska",
      "video/mpeg",
      "video/x-msvideo",
      "video/x-ms-wmv",
      "video/x-flv",
      "video/x-m4v",
      "video/3gpp",
      "video/3gpp2",
      "video/mp2t"
    ];
    const allowedExtensions = [
      ".mp4",
      ".webm",
      ".mov",
      ".mkv",
      ".mpeg",
      ".mpg",
      ".avi",
      ".wmv",
      ".flv",
      ".m4v",
      ".3gp",
      ".3g2",
      ".ts",
      ".mts",
      ".m2ts"
    ];
    const ext = path.extname(file.originalname || "").toLowerCase();

    if ((file.mimetype || "").startsWith("video/") || allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported video format. Use MP4, WebM, MOV, MKV, or MPEG."));
  }
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/aac",
      "audio/ogg",
      "audio/webm"
    ];

    const allowedExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".webm"];
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported audio format. Use MP3, WAV, M4A, AAC, OGG, or WEBM."));
  }
});

const uploadDocument = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 100 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const allowedExt = [".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp"];

    if (allowedExt.includes(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported file. Use PDF, DOC, DOCX, TXT, PNG, JPG, or WEBP."));
  }
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 20 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const allowedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const ext = path.extname(file.originalname || "").toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error("Unsupported image format. Use PNG, JPG, or WEBP."));
  }
});

router.post("/summarize-text", summarizeText);
router.post("/summarize-url", summarizeUrl);
const handleImageUpload = [
  (req, res, next) => {
    uploadImage.single("image")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Image size must be 20MB or less." });
        return;
      }

      res.status(400).json({ error: error.message || "Failed to upload image." });
    });
  },
  summarizeImage
];

router.post("/summarize-image", handleImageUpload);
router.post("/summarize/image", handleImageUpload);
router.post(
  "/summarize-video",
  (req, res, next) => {
    upload.single("video")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error:
            "Video size must be 1GB or less. For files larger than 25MB, install ffmpeg for automatic preprocessing."
        });
        return;
      }

      res.status(400).json({ error: error.message || "Failed to upload video." });
    });
  },
  summarizeVideo
);
router.post(
  "/summarize-audio",
  (req, res, next) => {
    uploadAudio.single("audio")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          error:
            "Audio size must be 512MB or less. For files larger than 25MB, install ffmpeg for automatic preprocessing."
        });
        return;
      }

      res.status(400).json({ error: error.message || "Failed to upload audio." });
    });
  },
  summarizeAudio
);
router.post(
  "/summarize-document",
  (req, res, next) => {
    uploadDocument.single("document")(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ error: "Document size must be 100MB or less." });
        return;
      }

      res.status(400).json({ error: error.message || "Failed to upload document." });
    });
  },
  summarizeDocument
);
router.post("/chat", chatWithArticle);
router.get("/history", getHistory);
router.delete("/history/:id", deleteHistory);

// Backward compatible endpoint for older client versions.
router.post("/summarize", summarizeText);
router.post("/", summarizeText);
router.delete("/:id", deleteHistory);

module.exports = router;
