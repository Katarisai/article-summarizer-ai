const OpenAI = require("openai");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { createWorker } = require("tesseract.js");
const sharp = require("sharp");

const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;
const TRANSCRIPTION_CHUNK_TARGET_BYTES = 23 * 1024 * 1024;
const TRANSCODE_AUDIO_BITRATE = "32k";
const FAST_ANALYSIS_INPUT_LIMIT = 12000;
const CHUNK_SIZE = 8000;
const CHUNK_OVERLAP = 500;
const MAX_CHUNKS = 12;
const VIDEO_EXTENSIONS = new Set([
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
]);

const SUPPORTED_LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Hindi",
  "Arabic",
  "Portuguese",
  "Urdu"
];

const LANGUAGE_CODES = {
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Hindi: "hi",
  Arabic: "ar",
  Portuguese: "pt",
  Urdu: "ur"
};

const normalizeLanguage = (language) => {
  if (!language || typeof language !== "string") {
    return "English";
  }

  const match = SUPPORTED_LANGUAGES.find(
    (item) => item.toLowerCase() === language.trim().toLowerCase()
  );

  return match || "English";
};

const apiKey = (process.env.OPENAI_API_KEY || "")
  .trim()
  .replace(/^"(.*)"$/, "$1")
  .replace(/^'(.*)'$/, "$1");

const getOpenAiApiKeyIssue = () => {
  if (!apiKey || apiKey === "your_openai_key" || apiKey === "your_openai_api_key_here") {
    return "OPENAI_API_KEY is missing in .env.";
  }

  if (apiKey.startsWith("AIza")) {
    return "OPENAI_API_KEY appears to be a Google API key (AIza...). Use an OpenAI API key that starts with sk-.";
  }

  if (!apiKey.startsWith("sk-")) {
    return "OPENAI_API_KEY format is invalid. Use an OpenAI API key that starts with sk-.";
  }

  return "";
};

const openAiApiKeyIssue = getOpenAiApiKeyIssue();
const hasUsableApiKey = !openAiApiKeyIssue;

const openai = hasUsableApiKey ? new OpenAI({ apiKey }) : null;

const getOpenAiSetupMessage = (featureName) => {
  const feature = String(featureName || "This feature").trim() || "This feature";
  return `${feature} requires a valid OPENAI_API_KEY. ${openAiApiKeyIssue || "Set OPENAI_API_KEY in .env."} Open .env. Replace OPENAI_API_KEY=AIza... with your real OpenAI key: OPENAI_API_KEY=sk-... Restart backend (npm start) so env vars reload.`;
};

const isQuotaBillingError = (message) => {
  const reason = String(message || "").toLowerCase();
  return reason.includes("quota") || reason.includes("insufficient_quota") || reason.includes("billing");
};

const resolveCommand = (envName, fallback) => {
  const custom = String(process.env[envName] || "").trim();
  return custom || fallback;
};

const ffmpegCommand = resolveCommand("FFMPEG_PATH", "ffmpeg");
const ffprobeCommand = resolveCommand("FFPROBE_PATH", "ffprobe");

const runProcess = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });

const getMediaDurationSeconds = async (filePath) => {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ffprobeCommand, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ffprobe exited with code ${code}`));
        return;
      }

      const duration = Number.parseFloat(String(stdout || "").trim());
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Could not detect media duration."));
        return;
      }

      resolve(duration);
    });
  });
};

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const deleteFileIfExists = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_error) {
    // Ignore cleanup errors.
  }
};

const deleteDirectoryIfExists = (dirPath) => {
  try {
    if (dirPath && fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (_error) {
    // Ignore cleanup errors.
  }
};

const buildTemporaryPaths = () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rootDir = path.join(os.tmpdir(), `media-transcribe-${stamp}`);
  const audioPath = path.join(rootDir, "source-audio.mp3");
  const chunksDir = path.join(rootDir, "chunks");
  return { rootDir, audioPath, chunksDir };
};

const compressMediaToAudio = async (inputPath, outputPath) => {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-b:a",
    TRANSCODE_AUDIO_BITRATE,
    outputPath
  ];

  await runProcess(ffmpegCommand, args);
};

const splitAudioByDuration = async ({ inputPath, chunksDir, segmentSeconds }) => {
  ensureDirectory(chunksDir);

  const outputPattern = path.join(chunksDir, "chunk-%03d.mp3");
  const args = [
    "-y",
    "-i",
    inputPath,
    "-f",
    "segment",
    "-segment_time",
    String(segmentSeconds),
    "-c",
    "copy",
    outputPattern
  ];

  await runProcess(ffmpegCommand, args);

  return fs
    .readdirSync(chunksDir)
    .filter((name) => name.endsWith(".mp3"))
    .sort()
    .map((name) => path.join(chunksDir, name))
    .filter((filePath) => fs.statSync(filePath).size > 0);
};

const createTranscriptionChunks = async (filePath, fileSizeBytes = 0) => {
  const fileExtension = path.extname(filePath || "").toLowerCase();
  const isVideoFile = VIDEO_EXTENSIONS.has(fileExtension);

  // Small files can go directly to OpenAI transcription API.
  // Requiring ffmpeg for every video blocks valid <=25MB uploads unnecessarily.
  if (fileSizeBytes > 0 && fileSizeBytes <= MAX_TRANSCRIPTION_BYTES) {
    return {
      chunks: [filePath],
      cleanup: () => {},
      transformed: false
    };
  }

  if (!isVideoFile && fileSizeBytes <= MAX_TRANSCRIPTION_BYTES) {
    return {
      chunks: [filePath],
      cleanup: () => {},
      transformed: false
    };
  }

  const { rootDir, audioPath, chunksDir } = buildTemporaryPaths();
  ensureDirectory(rootDir);

  try {
    await compressMediaToAudio(filePath, audioPath);
    const compressedSize = fs.statSync(audioPath).size;

    if (compressedSize <= MAX_TRANSCRIPTION_BYTES) {
      return {
        chunks: [audioPath],
        cleanup: () => deleteDirectoryIfExists(rootDir),
        transformed: true
      };
    }

    const duration = await getMediaDurationSeconds(audioPath);
    const totalSeconds = Math.max(1, Math.floor(duration));
    const estimatedBytesPerSecond = Math.max(1, Math.floor(compressedSize / totalSeconds));
    const segmentSeconds = Math.max(
      60,
      Math.floor(TRANSCRIPTION_CHUNK_TARGET_BYTES / estimatedBytesPerSecond)
    );

    const chunks = await splitAudioByDuration({
      inputPath: audioPath,
      chunksDir,
      segmentSeconds
    });

    const oversizedChunk = chunks.find((chunkPath) => fs.statSync(chunkPath).size > MAX_TRANSCRIPTION_BYTES);
    if (oversizedChunk) {
      throw new Error("Could not split media into transcription-sized chunks.");
    }

    if (!chunks.length) {
      throw new Error("No audio chunks were generated from media.");
    }

    return {
      chunks,
      cleanup: () => deleteDirectoryIfExists(rootDir),
      transformed: true
    };
  } catch (error) {
    deleteFileIfExists(audioPath);
    deleteDirectoryIfExists(chunksDir);
    deleteDirectoryIfExists(rootDir);
    throw error;
  }
};

const splitSentences = (text) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

const buildFastAnalysisText = (text) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= FAST_ANALYSIS_INPUT_LIMIT) {
    return normalized;
  }

  const head = normalized.slice(0, 8000);
  const tail = normalized.slice(-3000);
  return `${head}\n\n[...content trimmed for faster analysis...]\n\n${tail}`;
};

const chunkLongText = (text) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }

  if (normalized.length <= CHUNK_SIZE) {
    return [normalized];
  }

  const chunks = [];
  let cursor = 0;
  const step = Math.max(1, CHUNK_SIZE - CHUNK_OVERLAP);

  while (cursor < normalized.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(normalized.length, cursor + CHUNK_SIZE);

    if (end < normalized.length) {
      const nextSentenceBoundary = normalized.slice(cursor, end + 250).search(/[.!?]\s/);
      if (nextSentenceBoundary > 0) {
        end = Math.min(normalized.length, cursor + nextSentenceBoundary + 1);
      }
    }

    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    cursor += step;
  }

  return chunks;
};

const fallbackSummary = (text) => {
  const sentences = splitSentences(text);
  // Return more comprehensive summary: first 8-10 sentences instead of 3
  return sentences.slice(0, 10).join(" ") || text.slice(0, 800);
};

const fallbackKeyPoints = (text) => {
  const sentences = splitSentences(text);
  // Return 5-7 key points instead of just 5
  return sentences.slice(0, 7).map((line) => line.replace(/[.!?]+$/, ""));
};

const fallbackMarkdown = (summary, keyPoints) => {
  const bullets = keyPoints.map((item) => `- ${item}`).join("\n");
  return `## Summary\n\n${summary}\n\n## Key Points\n\n${bullets}`;
};

const translateText = async (text, language) => {
  const normalized = normalizeLanguage(language);

  if (normalized === "English") {
    return text;
  }

  try {
    const targetCode = LANGUAGE_CODES[normalized] || "en";
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetCode}&dt=t&q=${encodeURIComponent(
      text
    )}`;

    const response = await axios.get(url, { timeout: 12000 });
    const translated = Array.isArray(response.data?.[0])
      ? response.data[0]
          .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
          .join("")
          .trim()
      : "";

    return translated || text;
  } catch (_error) {
    return text;
  }
};

const parsePackageJson = (content) => {
  try {
    const parsed = JSON.parse(content);
    const keyPoints = Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map((point) => String(point).trim()).filter(Boolean)
      : [];

    return {
      summary: String(parsed.summary || "").trim(),
      keyPoints,
      markdownSummary: String(parsed.markdownSummary || "").trim()
    };
  } catch (_error) {
    return null;
  }
};

const getModeInstruction = (mode) => {
  const outputStyleByMode = {
    summary: "Create a clear, high-quality summary that captures all important points in a concise but complete way.",
    rewrite: "Rewrite the source in cleaner, professional language while preserving meaning.",
    bullet: "Use concise bullet style in the summary section."
  };

  return outputStyleByMode[mode] || outputStyleByMode.summary;
};

const summarizeWithOpenAI = async ({ text, mode, language }) => {
  const systemPrompt = [
    "You are an expert article summarizer.",
    getModeInstruction(mode),
    `Respond only in ${language}.`,
    "Return a strict JSON object with keys: summary (string, about 150-250 words), keyPoints (array of 5-7 strings), markdownSummary (string with proper formatting)."
  ].join(" ");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text }
    ],
    temperature: 0.3,
    max_tokens: 900,
    response_format: { type: "json_object" }
  });

  const content = response.choices?.[0]?.message?.content || "{}";
  const parsed = parsePackageJson(content);
  if (!parsed || !parsed.summary) {
    throw new Error("Invalid summarization response");
  }

  return {
    summary: parsed.summary,
    keyPoints: parsed.keyPoints,
    markdownSummary: parsed.markdownSummary || fallbackMarkdown(parsed.summary, parsed.keyPoints),
    source: "openai"
  };
};

const summarizeLongContentWithOpenAI = async ({ text, mode, language }) => {
  const chunks = chunkLongText(text);
  if (chunks.length <= 1) {
    return summarizeWithOpenAI({ text: chunks[0] || text, mode, language });
  }

  const chunkBriefs = [];
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const chunkResult = await summarizeWithOpenAI({
      text: `Chunk ${index + 1} of ${chunks.length}:\n\n${chunk}`,
      mode,
      language
    });

    chunkBriefs.push({
      index: index + 1,
      summary: chunkResult.summary,
      keyPoints: chunkResult.keyPoints
    });
  }

  const synthesisInput = chunkBriefs
    .map(
      (item) =>
        `Chunk ${item.index} summary: ${item.summary}\nChunk ${item.index} key points: ${item.keyPoints.join(" | ")}`
    )
    .join("\n\n")
    .slice(0, 30000);

  const synthesized = await summarizeWithOpenAI({
    text: `Synthesize a single final response from these chunk analyses without losing important details:\n\n${synthesisInput}`,
    mode,
    language
  });

  return {
    ...synthesized,
    source: "openai+chunked"
  };
};

const generateSummaryPackage = async ({ text, mode = "summary", language = "English" }) => {
  const selectedLanguage = normalizeLanguage(language);
  const normalizedText = String(text || "").replace(/\s+/g, " ").trim();
  const analysisText = buildFastAnalysisText(normalizedText);

  const buildFallbackPackage = async () => {
    const summary = await translateText(fallbackSummary(analysisText), selectedLanguage);
    const rawPoints = fallbackKeyPoints(analysisText);
    const translatedPoints = await Promise.all(rawPoints.map((line) => translateText(line, selectedLanguage)));
    const markdownSummary = await translateText(fallbackMarkdown(summary, translatedPoints), selectedLanguage);

    return {
      summary,
      keyPoints: translatedPoints,
      markdownSummary,
      source: "fallback"
    };
  };

  if (!openai) {
    return buildFallbackPackage();
  }

  try {
    if (normalizedText.length > FAST_ANALYSIS_INPUT_LIMIT) {
      return await summarizeLongContentWithOpenAI({
        text: normalizedText,
        mode,
        language: selectedLanguage
      });
    }

    return await summarizeWithOpenAI({
      text: analysisText,
      mode,
      language: selectedLanguage
    });
  } catch (_error) {
    return buildFallbackPackage();
  }
};

const answerArticleQuestion = async ({ context, question, language = "English" }) => {
  const selectedLanguage = normalizeLanguage(language);

  if (!openai) {
    const shortContext = context.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    const answer = `Based on the article context, ${shortContext || "I need more context to answer this question."}`;

    return {
      answer: await translateText(answer, selectedLanguage),
      source: "fallback"
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You answer questions using only article context. Respond in ${selectedLanguage}. If context is insufficient, say so clearly.`
        },
        {
          role: "user",
          content: `Article Context:\n${context}\n\nQuestion:\n${question}`
        }
      ],
      temperature: 0.3,
      max_tokens: 400
    });

    const answer = response.choices?.[0]?.message?.content?.trim() || "No answer generated.";

    return {
      answer,
      source: "openai"
    };
  } catch (_error) {
    const shortContext = context.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
    const answer = `Based on the article context, ${shortContext || "I need more context to answer this question."}`;

    return {
      answer: await translateText(answer, selectedLanguage),
      source: "fallback"
    };
  }
};

const transcribeMediaFile = async (filePath, fileSizeBytes = 0) => {
  if (!openai) {
    throw new Error(getOpenAiSetupMessage("Video transcription"));
  }

  const models = ["gpt-4o-mini-transcribe", "whisper-1"];
  const failures = [];

  let chunkInfo;
  try {
    chunkInfo = await createTranscriptionChunks(filePath, fileSizeBytes);
  } catch (error) {
    const reason = String(error?.message || "").toLowerCase();
    if (
      reason.includes("ffmpeg") ||
      reason.includes("ffprobe") ||
      reason.includes("enoent") ||
      reason.includes("spawn")
    ) {
      throw new Error(
        "Large media preprocessing requires ffmpeg/ffprobe. Install ffmpeg or set FFMPEG_PATH and FFPROBE_PATH in .env."
      );
    }

    throw new Error("Could not preprocess media for transcription. Please upload a valid audio/video file.");
  }

  const transcriptByChunk = [];
  let requestFailureDetected = false;
  let quotaFailureDetected = false;

  try {
    for (let chunkIndex = 0; chunkIndex < chunkInfo.chunks.length; chunkIndex += 1) {
      const chunkPath = chunkInfo.chunks[chunkIndex];
      let chunkText = "";
      let requestSucceeded = false;

      for (const model of models) {
        try {
          const transcript = await openai.audio.transcriptions.create({
            file: fs.createReadStream(chunkPath),
            model,
            temperature: 0,
            prompt: "Transcribe all spoken words clearly. If the audio is a song, transcribe audible lyrics."
          });

          requestSucceeded = true;
          chunkText = String(transcript?.text || "").trim();
          if (chunkText) {
            break;
          }
        } catch (error) {
          const errorMessage = String(error?.message || "unknown");
          failures.push(`chunk ${chunkIndex + 1}/${chunkInfo.chunks.length} (${model}): ${errorMessage}`);

          if (isQuotaBillingError(errorMessage)) {
            quotaFailureDetected = true;
            requestFailureDetected = true;
            break;
          }
        }
      }

      if (!chunkText) {
        if (!requestSucceeded) {
          requestFailureDetected = true;
          break;
        }

        throw new Error(`No speech text detected in media chunk ${chunkIndex + 1}.`);
      }

      transcriptByChunk.push(chunkText);

      if (requestFailureDetected) {
        break;
      }
    }
  } finally {
    chunkInfo.cleanup();
  }

  const fullTranscript = transcriptByChunk.join("\n\n").trim();
  if (fullTranscript && !requestFailureDetected) {
    return {
      text: fullTranscript,
      partial: false
    };
  }

  if (fullTranscript && quotaFailureDetected) {
    return {
      text: fullTranscript,
      partial: true,
      reason: "Your OpenAI key needs active billing and available quota."
    };
  }

  const reason = failures.join(" | ").toLowerCase();
  if (reason.includes("incorrect api key") || reason.includes("unauthorized") || reason.includes("401")) {
    throw new Error("Transcription failed: invalid OpenAI API key. Update OPENAI_API_KEY in .env and restart server.");
  }

  if (isQuotaBillingError(reason)) {
    throw new Error("Transcription failed: your OpenAI key needs active billing and available quota.");
  }

  if (reason.includes("rate limit") || reason.includes("429")) {
    throw new Error("Transcription failed: rate limit exceeded. Please retry in a minute.");
  }

  if (reason.includes("too large") || reason.includes("maximum") || reason.includes("25mb") || reason.includes("413")) {
    throw new Error(
      "Transcription failed: media chunk still exceeds API limit (25MB). Re-encode to lower bitrate or shorter duration."
    );
  }

  if (reason.includes("decode") || reason.includes("codec") || reason.includes("no audio")) {
    throw new Error("Transcription failed: unsupported codec or no readable audio track in the file.");
  }

  if (reason.includes("no speech") || reason.includes("no speech text") || reason.includes("empty")) {
    throw new Error("Transcription failed: no clear speech/lyrics detected in this audio.");
  }

  throw new Error("Could not transcribe the uploaded media. Check API key/quota, then try clearer speech audio or a shorter file.");
};

const analyzeImageWithVision = async ({ imageBase64, mimeType = "image/png", language = "English" }) => {
  const selectedLanguage = normalizeLanguage(language);

  if (!openai) {
    throw new Error(getOpenAiSetupMessage("Image summarization"));
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new Error("Invalid image data.");
  }

  const safeMimeType = ["image/png", "image/jpeg", "image/webp"].includes(mimeType)
    ? mimeType
    : "image/png";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an image analysis assistant. Respond only in ${selectedLanguage}. Return strict JSON with keys: description (string), extractedText (string), summary (string), detectedItems (array of objects with keys name, confidence, attributes), keyPoints (array of 4-7 strings). Identify as many visible items and objects as possible, including brand/product cues when visible. If the image has no readable text, set extractedText to "No visible text detected." and still provide a strong visual description and summary.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analyze this image directly and carefully. Focus first on objects/items, scene, actions, and context. Provide: 1) clear visual description, 2) extracted visible text (if any), 3) concise summary of what the image conveys, 4) detectedItems as a list of all visible things with confidence and short attributes, 5) key points."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${safeMimeType};base64,${imageBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 500
    });

    console.log("Vision response:", {
      id: response?.id,
      model: response?.model,
      finishReason: response?.choices?.[0]?.finish_reason
    });

    const raw = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    const description = String(parsed.description || "").trim();
    const extractedTextRaw = String(parsed.extractedText || "").trim();
    const extractedText = extractedTextRaw || "No visible text detected.";
    const summary = String(parsed.summary || description || "").trim();
    const detectedItems = Array.isArray(parsed.detectedItems)
      ? parsed.detectedItems
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const name = String(item.name || "").trim();
            if (!name) {
              return null;
            }

            const confidence = Number.parseFloat(item.confidence);
            const normalizedConfidence = Number.isFinite(confidence)
              ? Math.max(0, Math.min(1, confidence))
              : null;
            const attributes = Array.isArray(item.attributes)
              ? item.attributes.map((attr) => String(attr || "").trim()).filter(Boolean).slice(0, 6)
              : [];

            return {
              name,
              confidence: normalizedConfidence,
              attributes
            };
          })
          .filter(Boolean)
          .slice(0, 20)
      : [];
    let keyPoints = Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints.map((point) => String(point).trim()).filter(Boolean)
      : [];

    if (!description) {
      throw new Error("Vision response missing description.");
    }

    if (!summary) {
      keyPoints = keyPoints.length > 0 ? keyPoints : [
        "Primary objects and visual elements identified",
        "Likely scene context inferred from the image",
        "No readable text was detected in the image"
      ];
    }

    if (detectedItems.length > 0 && keyPoints.length < 7) {
      const itemHighlights = detectedItems
        .slice(0, Math.max(0, 7 - keyPoints.length))
        .map((item) => `Detected item: ${item.name}`);
      keyPoints = [...keyPoints, ...itemHighlights].slice(0, 7);
    }

    return {
      description,
      extractedText,
      summary: summary || `The image appears to show ${description.toLowerCase()}.`,
      detectedItems,
      keyPoints
    };
  } catch (error) {
    console.log("Vision error:", error);
    const reason = String(error?.message || "").toLowerCase();
    if (reason.includes("incorrect api key") || reason.includes("unauthorized") || reason.includes("401")) {
      throw new Error("Image analysis failed: invalid OpenAI API key.");
    }
    if (reason.includes("quota") || reason.includes("insufficient_quota") || reason.includes("billing")) {
      throw new Error("Image analysis failed: your OpenAI key needs active billing and available quota.");
    }
    if (reason.includes("rate limit") || reason.includes("429")) {
      throw new Error("Image analysis failed: rate limit exceeded. Please retry in a minute.");
    }

    throw new Error("Image analysis failed. Please retry with a valid image file.");
  }
};

const extractImageTextFromBuffer = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    return "";
  }

  const tessdataPath = path.resolve(__dirname, "..");
  let worker;

  try {
    const processedBuffer = await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .threshold(128)
      .toBuffer();

    worker = await createWorker("eng", 1, {
      langPath: tessdataPath,
      gzip: false
    });

    const result = await worker.recognize(processedBuffer);
    const text = String(result?.data?.text || "")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    console.log("OCR confidence:", result?.data?.confidence);

    return text;
  } catch (_error) {
    return "";
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (_error) {
        // Ignore worker shutdown errors to preserve request flow.
      }
    }
  }
};

module.exports = {
  generateSummaryPackage,
  answerArticleQuestion,
  normalizeLanguage,
  transcribeMediaFile,
  analyzeImageWithVision,
  extractImageTextFromBuffer
};
