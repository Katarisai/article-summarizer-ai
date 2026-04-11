import React, { useState } from "react";

const MAX_TEXT_LENGTH = 120000;

function UrlInput({
  mode,
  setMode,
  url,
  setUrl,
  text,
  setText,
  videoFile,
  setVideoFile,
  audioFile,
  setAudioFile,
  documentFile,
  setDocumentFile,
  imageFile,
  setImageFile,
  language,
  setLanguage,
  onGenerate,
  loading
}) {
  const [fileMessage, setFileMessage] = useState("");
  const [speakerRecognition, setSpeakerRecognition] = useState(false);
  const [accuracy, setAccuracy] = useState("Medium");

  const inputMethods = [
    { id: "youtube", label: "YouTube", icon: "YT" },
    { id: "video", label: "Video", icon: "V" },
    { id: "audio", label: "Audio", icon: "A" },
    { id: "image", label: "Image", icon: "I" },
    { id: "pdf", label: "PDF, Image & More Files", icon: "F" },
    { id: "webpage", label: "Webpage", icon: "W" },
    { id: "text", label: "Long Text", icon: "T" }
  ];

  const moreTools = [
    { label: "PPT Summarizer", href: "/?tool=ppt" },
    { label: "Image Summarizer", href: "/?tool=image" },
    { label: "Word Summarizer", href: "/?tool=word" },
    { label: "Book Summarizer", href: "/?tool=book" }
  ];

  const modeConfig = {
    youtube: {
      heading: "Upload or paste a YouTube link.",
      sub: "Get transcript-based summaries, key ideas, and action points.",
      formats: "YouTube links"
    },
    video: {
      heading: "Upload or drag a video here.",
      sub: "Supports up to 1GB. Files above 25MB are preprocessed server-side with ffmpeg. Transcription requires an OpenAI key with active billing and available quota.",
      formats: "MP4, WebM, MOV, MKV, MPEG, AVI, WMV, FLV, M4V, 3GP"
    },
    audio: {
      heading: "Upload or drag an audio file here.",
      sub: "Supports up to 512MB. Files above 25MB are preprocessed server-side with ffmpeg. Transcription requires an OpenAI key with active billing and available quota.",
      formats: "MP3, WAV, M4A, AAC"
    },
    image: {
      heading: "Upload an image for AI vision analysis.",
      sub: "Analyze visual content, detect text, and generate summary and key points.",
      formats: "PNG, JPG, WEBP"
    },
    pdf: {
      heading: "Upload documents, images, or files.",
      sub: "Extract text from files and summarize the content quickly.",
      formats: "PDF, DOC, DOCX, TXT, PNG, JPG, WEBP"
    },
    webpage: {
      heading: "Paste a webpage URL.",
      sub: "Extract main article content and summarize in seconds.",
      formats: "HTTP / HTTPS links"
    },
    text: {
      heading: "Paste your long text.",
      sub: "Summarize large text blocks with key points and markdown.",
      formats: "Plain text up to 120,000 characters"
    }
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setAudioFile(null);
      setFileMessage(`Video selected: ${file.name}`);
    }
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setVideoFile(null);
      setFileMessage(`Audio selected: ${file.name}`);
    }
  };

  const handleGenericFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocumentFile(file);
      setVideoFile(null);
      setAudioFile(null);
      setFileMessage(`Document selected: ${file.name}`);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setVideoFile(null);
      setAudioFile(null);
      setDocumentFile(null);
      setFileMessage(`Image selected: ${file.name}`);
    }
  };

  const renderMainInput = () => {
    if (mode === "video") {
      return (
        <input
          type="file"
          accept="video/*,.avi,.wmv,.flv,.m4v,.3gp,.3g2,.ts,.mts,.m2ts"
          onChange={handleVideoUpload}
          disabled={loading}
          className="hidden"
        />
      );
    }

    if (mode === "audio") {
      return (
        <input
          type="file"
          accept="audio/*"
          onChange={handleAudioUpload}
          disabled={loading}
          className="hidden"
        />
      );
    }

    if (mode === "pdf") {
      return (
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
          onChange={handleGenericFileUpload}
          disabled={loading}
          className="hidden"
        />
      );
    }

    if (mode === "image") {
      return (
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleImageUpload}
          disabled={loading}
          className="hidden"
        />
      );
    }

    if (mode === "text") {
      return (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
          maxLength={MAX_TEXT_LENGTH}
          rows={7}
          placeholder="Paste your long text here"
          className="mt-4 w-full rounded-2xl border border-cyan-500/40 bg-slate-950/80 px-4 py-3 text-cyan-50 outline-none focus:border-cyan-300"
          disabled={loading}
        />
      );
    }

    return (
      <input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder={mode === "youtube" ? "Paste YouTube URL" : "Paste article or webpage URL"}
        className="mt-4 w-full rounded-2xl border border-cyan-500/40 bg-slate-950/80 px-4 py-3 text-cyan-50 outline-none focus:border-cyan-300"
        disabled={loading}
      />
    );
  };

  const currentConfig = modeConfig[mode] || modeConfig.webpage;
  const isFileMode = mode === "video" || mode === "audio" || mode === "pdf" || mode === "image";
  const uploadLabel =
    mode === "video"
      ? "Upload a Video"
      : mode === "audio"
        ? "Upload Audio"
        : mode === "image"
          ? "Upload Image"
          : mode === "pdf"
            ? "Upload Files"
            : "Apply Input";

  return (
    <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
      <div className="mb-5 rounded-2xl bg-slate-800/70 p-2 ring-1 ring-slate-600/60">
        <div className="flex flex-wrap gap-1.5">
          {inputMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => {
                setMode(method.id);
                setFileMessage("");
                if (method.id !== "video") {
                  setVideoFile(null);
                }
                if (method.id !== "audio") {
                  setAudioFile(null);
                }
                if (method.id !== "pdf") {
                  setDocumentFile(null);
                }
                if (method.id !== "image") {
                  setImageFile(null);
                }
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === method.id
                  ? "bg-blue-600/35 text-blue-300 ring-1 ring-blue-400/50"
                  : "text-slate-300 hover:bg-slate-700/80"
              }`}
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400/50 text-[10px]">
                {method.icon}
              </span>
              <span>{method.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-dashed border-slate-500/60 bg-slate-950/40">
          <label className={`block p-7 text-center ${isFileMode ? "cursor-pointer" : ""}`}>
            {isFileMode ? renderMainInput() : null}

            <div>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/20 text-xl text-emerald-300">
                AI
              </div>
              <p className="text-2xl text-cyan-50">{currentConfig.heading}</p>
              <p className="mt-2 text-sm text-slate-300">{currentConfig.sub}</p>
              <p className="mt-1 text-sm text-slate-400">Supported file formats: {currentConfig.formats}</p>

              {isFileMode ? (
                <div className="mt-4 inline-flex items-center overflow-hidden rounded-xl bg-blue-600 shadow-lg shadow-blue-900/30">
                  <span className="px-4 py-2 font-semibold text-white">{uploadLabel}</span>
                  <span className="border-l border-blue-400/60 px-3 py-2 text-white">v</span>
                </div>
              ) : null}

              {!isFileMode ? renderMainInput() : null}
            </div>
          </label>

          <div className="grid grid-cols-1 border-t border-slate-700/70 px-4 py-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-2 border-slate-700/70 sm:border-r sm:pr-4">
              <span>Language: Auto</span>
              <span className="text-slate-500">i</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-slate-700/70 sm:mt-0 sm:border-r sm:px-4">
              <span>Speaker Recognition</span>
              <button
                type="button"
                onClick={() => setSpeakerRecognition((prev) => !prev)}
                className={`relative h-6 w-11 rounded-full transition ${speakerRecognition ? "bg-blue-500" : "bg-slate-700"}`}
                aria-label="Toggle speaker recognition"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${speakerRecognition ? "left-5" : "left-0.5"}`}
                />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 sm:mt-0 sm:pl-4">
              <label htmlFor="accuracy" className="text-slate-300">
                Accuracy:
              </label>
              <select
                id="accuracy"
                value={accuracy}
                onChange={(event) => setAccuracy(event.target.value)}
                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-slate-200"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>
        </div>

        {fileMessage ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-900/60 to-green-900/60 border border-emerald-500/50 px-4 py-3 text-sm text-emerald-100 ring-1 ring-emerald-400/30 animate-in fade-in slide-in-from-top duration-300">
            <svg className="h-5 w-5 flex-shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-emerald-100">✓ File Ready</p>
              <p className="text-xs text-emerald-200">{fileMessage}</p>
            </div>
          </div>
        ) : null}
        {mode === "text" ? (
          <p className="text-xs text-cyan-200">{text.length}/{MAX_TEXT_LENGTH} characters</p>
        ) : null}

        <div>
          <h3 className="mb-3 text-2xl font-bold text-cyan-50">More summary tools</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {moreTools.map((tool) => (
              <a
                key={tool.label}
                href={tool.href}
                className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-left text-cyan-200 hover:border-cyan-400/50"
              >
                <span>{tool.label}</span>
                <span>{">"}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-cyan-100">Language:</label>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="rounded-xl border border-cyan-500/40 bg-slate-950 px-3 py-2 text-sm text-cyan-50 outline-none"
          disabled={loading}
        >
          <option>English</option>
          <option>Spanish</option>
          <option>French</option>
          <option>German</option>
          <option>Hindi</option>
          <option>Arabic</option>
          <option>Portuguese</option>
          <option>Urdu</option>
        </select>

        <button
          type="button"
          onClick={onGenerate}
          disabled={
            loading ||
            (mode === "video" && !videoFile) ||
            (mode === "audio" && !audioFile) ||
            (mode === "image" && !imageFile) ||
            (mode === "pdf" && !documentFile) ||
            ((mode === "youtube" || mode === "webpage") && !url) ||
            (mode === "text" && !text)
          }
          className={`ml-auto rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 ${
            fileMessage || url || text
              ? "bg-gradient-to-r from-cyan-400 via-emerald-300 to-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/50 hover:shadow-xl disabled:opacity-60"
              : "bg-gradient-to-r from-cyan-400 to-emerald-300 text-slate-950 disabled:opacity-60"
          }`}
        >
          {loading ? "⏳ Processing..." : "🚀 Generate Summary"}
        </button>
      </div>
    </section>
  );
}

export default UrlInput;
