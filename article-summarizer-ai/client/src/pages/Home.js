import React, { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import UrlInput from "../components/UrlInput";
import ChatAI from "../components/ChatAI";
import History from "../components/History";
import Loader from "../components/Loader";
import UploadProgress from "../components/UploadProgress";
import MindMap from "../components/MindMap";
import SummarySection from "../components/SummarySection";
import {
  summarizeText,
  summarizeUrl,
  summarizeVideo,
  summarizeAudio,
  summarizeDocument,
  summarizeImage,
  askArticleChat,
  getHistory,
  deleteHistoryItem
} from "../services/api";

function Home() {
  const [mode, setMode] = useState("webpage");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [language, setLanguage] = useState("English");
  const [result, setResult] = useState({
    summary: "",
    keyPoints: [],
    markdownSummary: "",
    description: "",
    extractedText: "",
    detectedItems: [],
    imagePreview: "",
    title: "",
    sourceUrl: "",
    originalText: "",
    source: "",
    transcriptionNote: "",
    visionError: ""
  });
  const [summaryId, setSummaryId] = useState("");
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [retryVisionLoading, setRetryVisionLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [liveSyncState, setLiveSyncState] = useState("connecting");

  const getFriendlyErrorMessage = (requestError, fallbackMessage) => {
    const message = String(requestError?.response?.data?.error || "").toLowerCase();

    if (message.includes("quota") || message.includes("billing") || message.includes("insufficient_quota")) {
      return "Your OpenAI key needs active billing and available quota.";
    }

    return requestError?.response?.data?.error || fallbackMessage;
  };

  const createMessageId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const applySummaryResult = (data, currentMode, selectedImageFile) => {
    const imagePreview = currentMode === "image" && selectedImageFile ? URL.createObjectURL(selectedImageFile) : "";

    setResult({
      summary: data.summary || "",
      keyPoints: data.keyPoints || [],
      markdownSummary: data.markdownSummary || "",
      description: data.description || "",
      extractedText: data.extractedText || "",
      detectedItems: Array.isArray(data.detectedItems) ? data.detectedItems : [],
      imagePreview,
      title: data.title || "",
      sourceUrl: data.sourceUrl || "",
      source: data.source || "",
      transcriptionNote: data.transcriptionNote || "",
      visionError: data.visionError || "",
      originalText:
        currentMode === "text"
          ? text
          : data.originalText || data.extractedText || data.description || ""
    });
    setSummaryId(data.summaryId || "");
    setMessages([]);
    setActiveTab("summary");
  };

  const refreshHistory = async () => {
    try {
      const data = await getHistory();
      setHistory(data || []);
    } catch (_error) {
      setHistory([]);
    }
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    let mounted = true;
    let eventSource;
    let fallbackTimer;

    const refreshOnLiveChange = () => {
      if (mounted) {
        refreshHistory();
      }
    };

    if (typeof window !== "undefined" && typeof window.EventSource === "function") {
      eventSource = new window.EventSource("/api/events");

      eventSource.addEventListener("connected", () => {
        if (mounted) {
          setLiveSyncState("live");
        }
      });

      eventSource.addEventListener("summary-change", refreshOnLiveChange);
      eventSource.addEventListener("history-change", refreshOnLiveChange);

      eventSource.onerror = () => {
        if (mounted) {
          setLiveSyncState("reconnecting");
        }
      };
    } else {
      fallbackTimer = setInterval(refreshOnLiveChange, 15000);
      if (mounted) {
        setLiveSyncState("polling");
      }
    }

    return () => {
      mounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackTimer) {
        clearInterval(fallbackTimer);
      }
    };
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tool = (searchParams.get("tool") || "").toLowerCase();

    const toolModeMap = {
      ppt: "pdf",
      image: "image",
      word: "pdf",
      book: "text"
    };

    if (toolModeMap[tool]) {
      setMode(toolModeMap[tool]);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    setUploadProgress(0);
    setIsUploading(false);

    // Check for unsupported modes
    if (mode === "video" && !videoFile) {
      setError("Please upload a video file first.");
      setLoading(false);
      return;
    }

    if (mode === "audio" && !audioFile) {
      setError("Please upload an audio file first.");
      setLoading(false);
      return;
    }

    if (mode === "pdf" && !documentFile) {
      setError("Please upload a document file first.");
      setLoading(false);
      return;
    }

    if (mode === "image" && !imageFile) {
      setError("Please upload an image file first.");
      setLoading(false);
      return;
    }

    const handleUploadProgress = (progress) => {
      setUploadProgress(progress);
      setIsUploading(progress < 100);
      if (progress === 100) {
        setIsUploading(false);
      }
    };

    try {
      // Handle YouTube and Webpage as URL inputs
      const inputUrl = mode === "youtube" || mode === "webpage" ? url : null;
      const inputText = mode === "text" ? text : null;

      let data;
      if (mode === "video") {
        setUploadingFileName(videoFile?.name);
        setIsUploading(true);
        data = await summarizeVideo({ file: videoFile, language, onUploadProgress: handleUploadProgress });
      } else if (mode === "audio") {
        setUploadingFileName(audioFile?.name);
        setIsUploading(true);
        data = await summarizeAudio({ file: audioFile, language, onUploadProgress: handleUploadProgress });
      } else if (mode === "pdf") {
        setUploadingFileName(documentFile?.name);
        setIsUploading(true);
        data = await summarizeDocument({ file: documentFile, language, onUploadProgress: handleUploadProgress });
      } else if (mode === "image") {
        setUploadingFileName(imageFile?.name);
        setIsUploading(true);
        data = await summarizeImage({ file: imageFile, language, onUploadProgress: handleUploadProgress });
      } else {
        data =
          inputUrl
            ? await summarizeUrl({ url: inputUrl, language })
            : await summarizeText({ text: inputText, language });
      }

      applySummaryResult(data, mode, imageFile);
      if (mode === "video") {
        setVideoFile(null);
      }
      if (mode === "audio") {
        setAudioFile(null);
      }
      if (mode === "pdf") {
        setDocumentFile(null);
      }
      await refreshHistory();
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError, "Failed to generate summary."));
    } finally {
      setLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName("");
    }
  };

  const handleRetryVision = async () => {
    if (!imageFile) {
      setError("To retry vision, upload the image again and click Generate Summary.");
      return;
    }

    setError("");
    setRetryVisionLoading(true);
    setUploadProgress(0);
    setUploadingFileName(imageFile?.name);
    setIsUploading(true);

    const handleUploadProgress = (progress) => {
      setUploadProgress(progress);
      setIsUploading(progress < 100);
      if (progress === 100) {
        setIsUploading(false);
      }
    };

    try {
      const data = await summarizeImage({ file: imageFile, language, onUploadProgress: handleUploadProgress });
      applySummaryResult(data, "image", imageFile);
      await refreshHistory();
    } catch (requestError) {
      setError(getFriendlyErrorMessage(requestError, "Vision retry failed. Please try again."));
    } finally {
      setRetryVisionLoading(false);
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName("");
    }
  };

  const handleFallbackChatPrompt = async (prompt) => {
    if (!canChat || chatLoading) {
      return;
    }

    setActiveTab("chat");
    await handleAsk(prompt);
  };

  const handleAsk = async (question) => {
    setChatLoading(true);

    try {
      const response = await askArticleChat({
        question,
        summaryId,
        contextText: result.originalText || result.summary,
        language
      });

      const answer = response.answer || "No answer generated.";
      setMessages((prev) => [...prev, { id: createMessageId(), question, answer }]);
      setActiveTab("chat");
    } catch (requestError) {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          question,
          answer: getFriendlyErrorMessage(requestError, "Unable to answer right now.")
        }
      ]);
      setActiveTab("chat");
    } finally {
      setChatLoading(false);
    }
  };

  const loadHistoryItem = (item) => {
    setResult({
      summary: item.summaryText || "",
      keyPoints: item.keyPoints || [],
      markdownSummary: item.markdownSummary || "",
      description: item.description || "",
      extractedText: item.extractedText || "",
      detectedItems: Array.isArray(item.detectedItems) ? item.detectedItems : [],
      imagePreview: "",
      title: item.title || "",
      sourceUrl: item.sourceUrl || "",
      originalText: item.originalText || "",
      source: "",
      transcriptionNote: item.transcriptionNote || ""
    });
    setSummaryId(item._id || "");
    
    // Determine mode from sourceUrl or sourceType
    let newMode = "text";
    if (item.sourceType === "video") {
      newMode = "video";
    } else if (item.sourceType === "audio") {
      newMode = "audio";
    } else if (item.sourceType === "image") {
      newMode = "image";
    } else if (item.sourceType === "document") {
      newMode = "pdf";
    } else if (item.sourceType === "url") {
      // Check if it's a YouTube URL
      if (item.sourceUrl && (item.sourceUrl.includes("youtube.com") || item.sourceUrl.includes("youtu.be"))) {
        newMode = "youtube";
      } else {
        newMode = "webpage";
      }
    }
    
    setMode(newMode);
    setText(item.originalText || "");
    setUrl(item.sourceUrl || "");
    setVideoFile(null);
    setAudioFile(null);
    setDocumentFile(null);
    setImageFile(null);
    setLanguage(item.language || "English");
    setMessages([]);
    setActiveTab("summary");
  };

  const removeHistory = async (id) => {
    try {
      await deleteHistoryItem(id);
      await refreshHistory();
    } catch (_error) {
      setError("Failed to delete history item.");
    }
  };

  const canChat = useMemo(() => Boolean(result.summary), [result.summary]);
  const hasSummary = useMemo(() => Boolean(result.summary), [result.summary]);

  const tabs = [
    { id: "summary", label: "Summary", icon: "S" },
    { id: "keypoints", label: "Key Points", icon: "*" },
    { id: "mindmap", label: "Mind Map", icon: "M" },
    { id: "chat", label: "AI Chat", icon: "Q" }
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#042f2e,#020617_55%,#020617)] px-4 py-6 text-white sm:px-6">
      {/* Upload Progress - Shows at top of page */}
      {isUploading && (
        <UploadProgress 
          progress={uploadProgress} 
          fileName={uploadingFileName}
          isUploading={isUploading}
        />
      )}

      <div className="mx-auto max-w-full space-y-6">
        <Header />

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-300/20 bg-slate-900/60 px-4 py-2 text-xs text-cyan-100">
          <span className="rounded-full bg-cyan-400/15 px-2 py-1 font-semibold text-cyan-200">Live sync</span>
          <span>
            {liveSyncState === "live"
              ? "Connected. New summaries and history updates appear automatically."
              : liveSyncState === "reconnecting"
                ? "Reconnecting to live updates..."
                : liveSyncState === "polling"
                  ? "Live stream unavailable. Refreshing history automatically."
                  : "Connecting to live updates..."}
          </span>
        </div>

        <UrlInput
          mode={mode}
          setMode={setMode}
          url={url}
          setUrl={setUrl}
          text={text}
          setText={setText}
          videoFile={videoFile}
          setVideoFile={setVideoFile}
          audioFile={audioFile}
          setAudioFile={setAudioFile}
          documentFile={documentFile}
          setDocumentFile={setDocumentFile}
          imageFile={imageFile}
          setImageFile={setImageFile}
          language={language}
          setLanguage={setLanguage}
          onGenerate={handleGenerate}
          loading={loading}
        />

        {loading && !isUploading ? <Loader label="Generating summary, key points, and markdown..." /> : null}

        {error ? (
          <div className="rounded-2xl border border-rose-400/50 bg-rose-900/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {hasSummary ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
              <h2 className="mb-3 text-xl font-extrabold text-cyan-100">Full Article</h2>
              {result.imagePreview ? (
                <div className="mb-3 overflow-hidden rounded-2xl ring-1 ring-cyan-400/30">
                  <img src={result.imagePreview} alt="Uploaded preview" className="h-52 w-full object-cover" />
                </div>
              ) : null}
              <div className="max-h-[70vh] overflow-y-auto rounded-2xl bg-slate-950/70 p-4 text-sm leading-6 text-cyan-50">
                <p>{result.originalText || "No article content."}</p>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-cyan-300">
                <span className="font-semibold">{result.title}</span>
                {result.sourceUrl && (
                  <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    (Open original)
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
              <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-950/70 p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeTab === tab.id
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-slate-800 text-cyan-100 hover:bg-slate-700"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="max-h-[65vh] overflow-y-auto rounded-2xl bg-slate-950/70 p-4">
                {activeTab === "summary" && (
                  <SummarySection
                    result={result}
                    handleRetryVision={handleRetryVision}
                    handleFallbackChatPrompt={handleFallbackChatPrompt}
                    retryVisionLoading={retryVisionLoading}
                    loading={loading}
                    imageFile={imageFile}
                    canChat={canChat}
                    chatLoading={chatLoading}
                  />
                )}

                {activeTab === "keypoints" && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-cyan-100">Key Points</h3>
                    {result.keyPoints.length === 0 ? (
                      <p className="text-sm text-cyan-300">No key points available.</p>
                    ) : (
                      result.keyPoints.map((point, idx) => (
                        <div key={idx} className="rounded-lg bg-slate-800/50 p-3">
                          <p className="text-sm text-cyan-50">{point}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "mindmap" && (
                  <div>
                    <h3 className="mb-3 text-lg font-bold text-cyan-100">Mind Map</h3>
                    <MindMap title={result.title} keyPoints={result.keyPoints} />
                  </div>
                )}

                {activeTab === "chat" && (
                  <div>
                    <ChatAI messages={messages} onAsk={handleAsk} disabled={!canChat} loading={chatLoading} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {hasSummary ? (
          <div className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
            <History items={history} onLoad={loadHistoryItem} onDelete={removeHistory} />
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default Home;
