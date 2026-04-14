const Summary = require("../models/Summary");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const pdfParseModule = require("pdf-parse");
const mammoth = require("mammoth");
const { fetchArticleContent } = require("../utils/fetchArticle");
const { emitSummaryChange, emitHistoryChange } = require("../utils/liveUpdates");
const {
  generateSummaryPackage,
  answerArticleQuestion,
  normalizeLanguage,
  transcribeMediaFile,
  analyzeImageWithVision,
  extractImageTextFromBuffer
} = require("../services/openaiService");

const MAX_TEXT_LENGTH = 120000;

const isMongoConnected = () => mongoose.connection.readyState === 1;

const countMatches = (text, regex) => (String(text || "").match(regex) || []).length;

const textQualityScore = (text) => {
  const value = String(text || "");
  const readableChars = countMatches(value, /[A-Za-z0-9]/g);
  const badMarkers = countMatches(value, /Ã|Â|â|�/g);
  return readableChars - badMarkers * 4;
};

const repairPotentialMojibake = (text) => {
  const original = String(text || "");
  if (!original) {
    return "";
  }

  const looksBroken = /Ã|Â|â|�/.test(original);
  if (!looksBroken) {
    return original;
  }

  try {
    const repaired = Buffer.from(original, "latin1").toString("utf8");
    return textQualityScore(repaired) > textQualityScore(original) ? repaired : original;
  } catch (_error) {
    return original;
  }
};

const normalizeUploadedName = (name, fallback) => {
  const repaired = repairPotentialMojibake(String(name || "")).trim();
  return repaired || fallback;
};

const isLikelyNoisyOcrLine = (line) => {
  const value = String(line || "").trim();
  if (!value || value.length < 3) {
    return true;
  }

  const alnum = countMatches(value, /[A-Za-z0-9]/g);
  const symbols = countMatches(value, /[^A-Za-z0-9\s]/g);
  const badChars = countMatches(value, /[|\\~`^â€]/g);

  // Filter out lines without meaningful alphanumeric content
  if (alnum < 3) {
    return true;
  }

  // Filter out symbol-heavy lines
  if (symbols > alnum) {
    return true;
  }

  // Filter out lines with mojibake indicators
  if (badChars > 0) {
    return true;
  }

  // Filter out lines that are mostly symbols or special chars
  return symbols > alnum * 1.5;
};

const parsePdfBuffer = async (buffer) => {
  if (typeof pdfParseModule === "function") {
    return pdfParseModule(buffer);
  }

  if (pdfParseModule && typeof pdfParseModule.PDFParse === "function") {
    const parser = new pdfParseModule.PDFParse({ data: buffer });
    return parser.getText();
  }

  throw new Error("PDF parser is not available.");
};

const cleanExtractedText = (text) =>
  repairPotentialMojibake(String(text || ""))
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^page\s+\d+(\s+of\s+\d+)?$/i.test(line))
    .filter((line) => !/^\d+\s*\/\s*\d+$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getPdfExtractedText = (parsed) => {
  const directText = cleanExtractedText(parsed?.text || "");
  if (directText) {
    return directText;
  }

  if (Array.isArray(parsed?.pages)) {
    const pageText = parsed.pages
      .map((page) => cleanExtractedText(page?.text || ""))
      .filter(Boolean)
      .join("\n\n");

    if (pageText) {
      return pageText;
    }
  }

  return "";
};

const validateText = (text) => {
  if (!text || typeof text !== "string" || !text.trim()) {
    return "Text is required.";
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return `Text cannot exceed ${MAX_TEXT_LENGTH} characters.`;
  }

  return "";
};

const normalizeOcrLines = (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }

  const seen = new Set();
  const lines = text
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => repairPotentialMojibake(line).replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3)
    .filter((line) => !/^[-_=~.]{2,}$/.test(line))
    .filter((line) => !/^[|\\`^~*]+$/.test(line))
    .filter((line) => !/[|\\]{3,}/.test(line))
    .filter((line) => !isLikelyNoisyOcrLine(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  return lines.slice(0, 120);
};

const buildOcrSummaryInput = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return "";
  }

  const text = lines.join(" ").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  return [
    "The following text was extracted from an image using local OCR fallback.",
    "Rewrite it as a clean, professional summary that sounds like an AI analysis, not a raw extraction log.",
    "Focus on the visible subject, purpose, and any useful details in the text.",
    "If the text is short or incomplete, make the summary concise and note that only limited text was visible.",
    `OCR text: ${text}`
  ]
    .join("\n\n")
    .slice(0, MAX_TEXT_LENGTH);
};

const isWeakOcrResult = (text) => {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) {
    return true;
  }

  const lettersAndDigits = countMatches(value, /[A-Za-z0-9]/g);
  const words = value.split(/\s+/).filter(Boolean);

  return value.length < 12 || lettersAndDigits < 6 || words.length < 3;
};

const buildWeakOcrFallbackPackage = async ({ text, language }) => {
  const selectedLanguage = normalizeLanguage(language);
  const cleanedText = String(text || "").replace(/\s+/g, " ").trim();
  const summaryInput = [
    "A local OCR pass extracted only a very small amount of text from an image.",
    "Rewrite this as a professional AI summary that explains the text is likely partial, blurred, cropped, or otherwise unreadable.",
    "Do not echo the raw fragment unless it is useful as a short quoted example.",
    "Focus on the likely limitation of the image and suggest that a clearer upload would help.",
    cleanedText ? `OCR fragment: ${cleanedText}` : "OCR fragment: unavailable"
  ]
    .join("\n\n")
    .slice(0, MAX_TEXT_LENGTH);

  try {
    const summaryPackage = await generateSummaryPackage({
      text: summaryInput,
      mode: "summary",
      language: selectedLanguage
    });

    const summary = String(summaryPackage.summary || "").trim() || "The image contains too little readable text for a reliable OCR summary, so this is a short low-confidence analysis.";
    const keyPoints = Array.isArray(summaryPackage.keyPoints) && summaryPackage.keyPoints.length > 0
      ? summaryPackage.keyPoints
      : [
          "OCR captured only a partial fragment",
          "The image is likely blurred, cropped, or low-contrast",
          "A clearer upload would improve recognition"
        ];

    return {
      summary,
      keyPoints,
      markdownSummary: summaryPackage.markdownSummary || fallbackMarkdown(summary, keyPoints),
      source: `${summaryPackage.source || "fallback"}+weak-ocr`,
      extractedText: "",
      transcriptionNote: "Only a small OCR fragment was recovered, so the raw text has been hidden."
    };
  } catch (_error) {
    const summary = cleanedText
      ? "The image contains too little readable text for a reliable OCR summary, so this is a short low-confidence analysis."
      : "OCR could not recover enough readable text from the image, so this is a short low-confidence analysis.";

    const keyPoints = [
      "Only a partial OCR fragment was recovered",
      "The image likely contains unreadable or low-confidence text",
      "Try a sharper crop, higher contrast, or a clearer upload"
    ];

    return {
      summary,
      keyPoints,
      markdownSummary: fallbackMarkdown(summary, keyPoints),
      source: "fallback+weak-ocr",
      extractedText: "",
      transcriptionNote: "Only a small OCR fragment was recovered, so the raw text has been hidden."
    };
  }
};

const persistSummary = async ({
  sourceType,
  sourceUrl,
  title,
  originalText,
  summaryText,
  description = "",
  extractedText = "",
  keyPoints,
  detectedItems = [],
  markdownSummary,
  transcriptionNote = "",
  language
}) => {
  if (!isMongoConnected()) {
    return null;
  }

  const entry = new Summary({
    sourceType,
    sourceUrl,
    title,
    originalText,
    summaryText,
    description,
    extractedText,
    keyPoints,
    detectedItems,
    markdownSummary,
    transcriptionNote,
    language
  });

  await entry.save();
  emitSummaryChange({
    action: "created",
    summaryId: String(entry._id),
    sourceType,
    title,
    updatedAt: entry.createdAt || new Date().toISOString()
  });
  emitHistoryChange({
    action: "created",
    summaryId: String(entry._id)
  });
  return entry;
};

exports.summarizeText = async (req, res) => {
  try {
    const { text, mode = "summary", language = "English" } = req.body;
    const validationError = validateText(text);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const selectedLanguage = normalizeLanguage(language);
    const summaryPackage = await generateSummaryPackage({
      text,
      mode,
      language: selectedLanguage
    });

    const entry = await persistSummary({
      sourceType: "text",
      sourceUrl: "",
      title: "Text Input",
      originalText: text,
      summaryText: summaryPackage.summary,
      keyPoints: summaryPackage.keyPoints,
      markdownSummary: summaryPackage.markdownSummary,
      transcriptionNote: "",
      language: selectedLanguage
    });

    return res.json({
      originalText: text,
      title: "Text Input",
      summary: summaryPackage.summary,
      keyPoints: summaryPackage.keyPoints,
      markdownSummary: summaryPackage.markdownSummary,
      source: summaryPackage.source,
      summaryId: entry?._id || ""
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
};

exports.summarizeUrl = async (req, res) => {
  try {
    const { url, mode = "summary", language = "English" } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required." });
    }

    const selectedLanguage = normalizeLanguage(language);
    const article = await fetchArticleContent(url);

    const validationError = validateText(article.text);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const summaryPackage = await generateSummaryPackage({
      text: article.text,
      mode,
      language: selectedLanguage
    });

    const entry = await persistSummary({
      sourceType: "url",
      sourceUrl: article.url,
      title: article.title,
      originalText: article.text,
      summaryText: summaryPackage.summary,
      keyPoints: summaryPackage.keyPoints,
      markdownSummary: summaryPackage.markdownSummary,
      transcriptionNote: "",
      language: selectedLanguage
    });

    return res.json({
      title: article.title,
      sourceUrl: article.url,
      originalText: article.text,
      summary: summaryPackage.summary,
      keyPoints: summaryPackage.keyPoints,
      markdownSummary: summaryPackage.markdownSummary,
      source: summaryPackage.source,
      summaryId: entry?._id || ""
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Unable to summarize this URL." });
  }
};

exports.summarizeVideo = async (req, res) => {
  let uploadedPath = "";

  try {
    const file = req.file;
    const { mode = "summary", language = "English" } = req.body;

    if (!file) {
      return res.status(400).json({ error: "Video file is required." });
    }

    const safeTitle = normalizeUploadedName(file.originalname, "Uploaded Video");

    uploadedPath = file.path;
    const selectedLanguage = normalizeLanguage(language);
    
    try {
      const transcription = await transcribeMediaFile(uploadedPath, file.size || 0);
      const transcriptText = cleanExtractedText(String(transcription?.text || transcription || "")).slice(0, MAX_TEXT_LENGTH);
      const transcriptionNote = transcription?.partial
        ? "Transcription ended early because your OpenAI key needs active billing and available quota. Summary is based on the captured portion."
        : "";

      const summaryPackage = await generateSummaryPackage({
        text: transcriptText,
        mode,
        language: selectedLanguage
      });

      const entry = await persistSummary({
        sourceType: "video",
        sourceUrl: "",
        title: safeTitle,
        originalText: transcriptText,
        summaryText: summaryPackage.summary,
        keyPoints: summaryPackage.keyPoints,
        markdownSummary: summaryPackage.markdownSummary,
        transcriptionNote,
        language: selectedLanguage
      });

      return res.json({
        title: safeTitle,
        sourceUrl: "",
        originalText: transcriptText,
        summary: summaryPackage.summary,
        keyPoints: summaryPackage.keyPoints,
        markdownSummary: summaryPackage.markdownSummary,
      source: `${summaryPackage.source}+video${transcription?.partial ? "+partial" : ""}`,
      transcriptionNote,
      summaryId: entry?._id || ""
      });
    } catch (transcriptionError) {
      throw transcriptionError;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Unable to summarize uploaded video." });
  } finally {
    if (uploadedPath) {
      fs.unlink(uploadedPath, () => {});
    }
  }
};

exports.summarizeAudio = async (req, res) => {
  let uploadedPath = "";

  try {
    const file = req.file;
    const { mode = "summary", language = "English" } = req.body;

    if (!file) {
      return res.status(400).json({ error: "Audio file is required." });
    }

    const safeTitle = normalizeUploadedName(file.originalname, "Uploaded Audio");

    uploadedPath = file.path;
    const selectedLanguage = normalizeLanguage(language);
    
    try {
      const transcription = await transcribeMediaFile(uploadedPath, file.size || 0);
      const transcriptText = cleanExtractedText(String(transcription?.text || transcription || "")).slice(0, MAX_TEXT_LENGTH);
      const transcriptionNote = transcription?.partial
        ? "Transcription ended early because your OpenAI key needs active billing and available quota. Summary is based on the captured portion."
        : "";

      const summaryPackage = await generateSummaryPackage({
        text: transcriptText,
        mode,
        language: selectedLanguage
      });

      const entry = await persistSummary({
        sourceType: "audio",
        sourceUrl: "",
        title: safeTitle,
        originalText: transcriptText,
        summaryText: summaryPackage.summary,
        keyPoints: summaryPackage.keyPoints,
        markdownSummary: summaryPackage.markdownSummary,
        transcriptionNote,
        language: selectedLanguage
      });

      return res.json({
        title: safeTitle,
        sourceUrl: "",
        originalText: transcriptText,
        summary: summaryPackage.summary,
        keyPoints: summaryPackage.keyPoints,
        markdownSummary: summaryPackage.markdownSummary,
      source: `${summaryPackage.source}+audio${transcription?.partial ? "+partial" : ""}`,
      transcriptionNote,
      summaryId: entry?._id || ""
      });
    } catch (transcriptionError) {
      throw transcriptionError;
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Unable to summarize uploaded audio." });
  } finally {
    if (uploadedPath) {
      fs.unlink(uploadedPath, () => {});
    }
  }
};

exports.summarizeImage = async (req, res) => {
  try {
    console.log(req.file);

    const file = req.file;
    const { language = "English" } = req.body;

    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const safeTitle = normalizeUploadedName(file.originalname, "Uploaded Image");
    const selectedLanguage = normalizeLanguage(language);
    const imageBuffer = file.buffer;

    const analysis = await analyzeImageWithVision({
      imageBase64: imageBuffer.toString("base64"),
      mimeType: file.mimetype || "image/png",
      language: selectedLanguage
    });

    const result = String(analysis?.summary || analysis?.extractedText || analysis?.description || "").trim();

    if (!result) {
      throw new Error("Vision returned empty");
    }

    const description = analysis.description || "";
    const extractedText = analysis.extractedText || result;
    const detectedItems = Array.isArray(analysis.detectedItems) ? analysis.detectedItems : [];
    const summary = analysis.summary || extractedText || description || "No summary generated.";
    const keyPoints = Array.isArray(analysis.keyPoints) ? analysis.keyPoints : [];
    const detectedItemsSection = detectedItems.length > 0
      ? detectedItems
          .map((item) => {
            const confidenceLabel = typeof item?.confidence === "number"
              ? ` (${Math.round(item.confidence * 100)}%)`
              : "";
            const attributes = Array.isArray(item?.attributes) && item.attributes.length > 0
              ? `: ${item.attributes.join(", ")}`
              : "";
            return `- ${item.name}${confidenceLabel}${attributes}`;
          })
          .join("\n")
      : "- No specific items detected.";
    const markdownSummary = `## Image Description\n\n${description}\n\n## Detected Items\n\n${detectedItemsSection}\n\n## Extracted Text\n\n${extractedText || "No text detected."}\n\n## Transcript\n\n${extractedText || "No transcript available."}\n\n## Summary\n\n${summary}\n\n## Key Points\n\n${keyPoints
      .map((point) => `- ${point}`)
      .join("\n")}`;

    const entry = await persistSummary({
      sourceType: "image",
      sourceUrl: "",
      title: safeTitle,
      originalText: extractedText || description,
      summaryText: summary,
      description,
      extractedText,
      keyPoints,
      detectedItems,
      markdownSummary,
      transcriptionNote: "",
      language: selectedLanguage
    });

    return res.json({
      description,
      detectedItems,
      extractedText,
      summary,
      keyPoints,
      title: safeTitle,
      sourceUrl: "",
      originalText: extractedText || description,
      markdownSummary,
      source: "openai+vision",
      visionError: "",
      summaryId: entry?._id || ""
    });
  } catch (error) {
    console.error("VISION API FULL ERROR:", error);

    try {
      const file = req.file;

      if (!file || !file.buffer) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      const safeTitle = normalizeUploadedName(file.originalname, "Uploaded Image");
      const selectedLanguage = normalizeLanguage(req.body?.language || "English");
      const imageBuffer = file.buffer;
      const visionError = String(error?.message || "Vision analysis failed.").trim();
      const ocrText = await extractImageTextFromBuffer(imageBuffer);

      if (!ocrText || ocrText.trim() === "") {
        return res.status(400).json({ error: "Could not read text from image" });
      }

      const normalizedLines = normalizeOcrLines(ocrText);
      const extractedText = normalizedLines.length > 0 ? normalizedLines.join("\n") : ocrText.trim();
      const detectedItems = [];
      const isWeakOcr = isWeakOcrResult(extractedText);
      const ocrSummaryPackage = isWeakOcr
        ? await buildWeakOcrFallbackPackage({ text: extractedText, language: selectedLanguage })
        : await generateSummaryPackage({
            text: buildOcrSummaryInput(normalizedLines.length > 0 ? normalizedLines : [extractedText]),
            mode: "summary",
            language: selectedLanguage
          });

      const description = `Image uploaded: ${safeTitle}. Local OCR extracted text from the image.`;
      const summary = ocrSummaryPackage.summary || extractedText;
      const keyPoints = Array.isArray(ocrSummaryPackage.keyPoints) && ocrSummaryPackage.keyPoints.length > 0
        ? ocrSummaryPackage.keyPoints
        : ["Local OCR fallback was used", "Text was extracted from the uploaded image"];
      const visibleExtractedText = isWeakOcr ? "" : extractedText;
      const transcriptionNote = ocrSummaryPackage.transcriptionNote || (isWeakOcr ? "Only a small OCR fragment was recovered, so the raw text has been hidden." : "");

      const markdownSummary = ocrSummaryPackage.markdownSummary || `## Image Description\n\n${description}\n\n## Detected Items\n\n- Item recognition unavailable in OCR fallback mode.\n\n## Extracted Text\n\n${visibleExtractedText || "Raw OCR text was omitted because the result was too short or low-confidence."}\n\n## Summary\n\n${summary}\n\n## Key Points\n\n${keyPoints
        .map((point) => `- ${point}`)
        .join("\n")}`;

      const entry = await persistSummary({
        sourceType: "image",
        sourceUrl: "",
        title: safeTitle,
        originalText: visibleExtractedText || description,
        summaryText: summary,
        description,
        extractedText: visibleExtractedText,
        keyPoints,
        detectedItems,
        markdownSummary,
        transcriptionNote,
        visionError,
        language: selectedLanguage
      });

      return res.json({
        description,
        detectedItems,
        extractedText: visibleExtractedText,
        summary,
        keyPoints,
        title: safeTitle,
        sourceUrl: "",
        originalText: visibleExtractedText || description,
        markdownSummary,
        source: isWeakOcr ? "fallback+weak-ocr" : "fallback+ocr",
        transcriptionNote,
        visionError,
        summaryId: entry?._id || ""
      });
    } catch (ocrError) {
      console.error("OCR failed:", ocrError);

      return res.status(500).json({
        error: String(ocrError?.message || error?.message || "Image reading failed"),
        fallback: true,
        visionError: String(error?.message || "Vision analysis failed.")
      });
    }
  }
};

exports.summarizeDocument = async (req, res) => {
  let uploadedPath = "";

  try {
    const file = req.file;
    const { mode = "summary", language = "English" } = req.body;

    if (!file) {
      return res.status(400).json({ error: "Document file is required." });
    }

    const safeTitle = normalizeUploadedName(file.originalname, "Uploaded Document");

    uploadedPath = file.path;
    const selectedLanguage = normalizeLanguage(language);
    const ext = path.extname(safeTitle).toLowerCase();

    let extractedText = "";

    if (ext === ".pdf") {
      const bytes = fs.readFileSync(uploadedPath);
      const parsed = await parsePdfBuffer(bytes);
      extractedText = getPdfExtractedText(parsed);
    } else if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: uploadedPath });
      extractedText = cleanExtractedText(result.value || "");
    } else if (ext === ".txt") {
      extractedText = cleanExtractedText(fs.readFileSync(uploadedPath, "utf8"));
    } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      const imageBuffer = fs.readFileSync(uploadedPath);

      try {
        const imageBase64 = imageBuffer.toString("base64");
        const analysis = await analyzeImageWithVision({
          imageBase64,
          mimeType: file.mimetype || "image/png",
          language: selectedLanguage
        });
        extractedText = cleanExtractedText(analysis.extractedText || analysis.description || "");
      } catch (_imageVisionError) {
        const ocrText = await extractImageTextFromBuffer(imageBuffer);
        extractedText = cleanExtractedText(ocrText);
      }
    } else if (ext === ".doc") {
      return res.status(400).json({ error: "DOC files are not supported yet. Please convert to DOCX." });
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use PDF, DOCX, TXT, PNG, JPG, or WEBP." });
    }

    if (!extractedText) {
      if (ext === ".pdf") {
        return res.status(400).json({
          error:
            "No readable text found in this PDF. It may be a scanned/image-only PDF. Please upload a searchable PDF or convert pages to images for OCR."
        });
      }

      return res.status(400).json({ error: "Could not extract readable text from the uploaded document." });
    }

    const validationError = validateText(extractedText);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const summaryPackage = await generateSummaryPackage({
      text: extractedText,
      mode,
      language: selectedLanguage
    });

    const entry = await persistSummary({
      sourceType: "document",
      sourceUrl: "",
      title: safeTitle,
      originalText: extractedText,
      summaryText: summaryPackage.summary,
      keyPoints: summaryPackage.keyPoints,
      markdownSummary: summaryPackage.markdownSummary,
      transcriptionNote: "",
      language: selectedLanguage
    });

    return res.json({
      title: safeTitle,
      sourceUrl: "",
      originalText: extractedText,
      summary: summaryPackage.summary,
      keyPoints: summaryPackage.keyPoints,
      markdownSummary: summaryPackage.markdownSummary,
      source: `${summaryPackage.source}+document`,
      summaryId: entry?._id || ""
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Unable to summarize uploaded document." });
  } finally {
    if (uploadedPath) {
      fs.unlink(uploadedPath, () => {});
    }
  }
};

exports.chatWithArticle = async (req, res) => {
  try {
    const { question, summaryId, contextText = "", language = "English" } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    let context = contextText;

    if (!context && summaryId && isMongoConnected()) {
      const historyItem = await Summary.findById(summaryId);
      if (historyItem) {
        context = `${historyItem.summaryText}\n\n${historyItem.originalText}`;
      }
    }

    if (!context.trim()) {
      return res.status(400).json({ error: "Article context is required before chat." });
    }

    const answer = await answerArticleQuestion({
      context,
      question,
      language: normalizeLanguage(language)
    });

    return res.json(answer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error" });
  }
};

exports.getHistory = async (_req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json([]);
    }

    const history = await Summary.find().sort({ createdAt: -1 }).limit(50);
    return res.json(history);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error fetching history" });
  }
};

exports.deleteHistory = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json({ message: "History is disabled because MongoDB is not connected." });
    }

    await Summary.findByIdAndDelete(req.params.id);
    emitHistoryChange({
      action: "deleted",
      summaryId: req.params.id
    });
    return res.json({ message: "Deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Delete failed" });
  }
};
