import React from "react";

function SummarySection({ result, handleRetryVision, handleFallbackChatPrompt, retryVisionLoading, loading, imageFile, canChat, chatLoading }) {
  const isOCRMode = String(result.source || "").includes("ocr");
  const hasVisibleOcrText = String(result.extractedText || "").trim().length > 0;
  const isShortOcrText = isOCRMode && hasVisibleOcrText && String(result.extractedText || "").trim().length < 40;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-cyan-100">📋 {isOCRMode ? "OCR-Assisted Summary" : "Summary"}</h3>
      
      {result.transcriptionNote ? (
        <div className="rounded-lg border border-amber-300/40 bg-amber-900/20 p-3 text-xs text-amber-100">
          {result.transcriptionNote}
        </div>
      ) : null}

      {result.visionError ? (
        <div className="rounded-lg border border-red-400/40 bg-red-950/20 p-3 text-xs text-red-100">
          <p className="font-semibold text-red-50">Vision error</p>
          <p className="mt-1 break-words text-red-100">{result.visionError}</p>
        </div>
      ) : null}

      {/* Main AI Summary - Always Prominent */}
      {result.summary && (
        <div className={`rounded-2xl p-4 ${
          isOCRMode 
            ? "border border-amber-300/40 bg-gradient-to-br from-amber-900/30 to-amber-950/30" 
            : "border border-cyan-400/40 bg-gradient-to-br from-cyan-900/30 to-cyan-950/30"
        }`}>
          {isOCRMode ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200">
              <span className="rounded-full border border-amber-300/30 bg-amber-950/30 px-2 py-0.5">OCR fallback</span>
              <span>{isShortOcrText ? "Low-confidence OCR analysis" : "AI-refined summary from extracted text"}</span>
            </div>
          ) : null}
          <div className={`text-sm leading-7 ${isOCRMode ? "text-amber-50" : "text-cyan-50"}`}>
            {result.summary}
          </div>
        </div>
      )}

      {/* OCR Mode Specific Content */}
      {isOCRMode && (
        <div className="space-y-3 pt-2 border-t border-amber-300/20">
          <div className="rounded-lg border border-amber-300/40 bg-amber-900/20 p-3">
            <p className="text-xs font-semibold text-amber-50">
              <span className="inline-block mr-2">⚡</span>OCR fallback active
            </p>
            <p className="mt-1 text-xs text-amber-200">
              AI Vision is temporarily unavailable. A low-confidence OCR analysis is shown instead.
            </p>
            {!hasVisibleOcrText ? (
              <p className="mt-2 text-xs text-amber-100">
                Raw OCR text is hidden because the extracted fragment was too short or low-confidence.
              </p>
            ) : null}
          </div>

          {/* Extracted Text - Collapsible */}
          {hasVisibleOcrText && (
            <details className="cursor-pointer group">
              <summary className="rounded-lg border border-amber-200/20 bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-950/40 transition group-open:bg-amber-950/40">
                📄 View extracted OCR text ({result.extractedText.length} chars)
              </summary>
              <div className="mt-2 rounded-md border border-amber-200/30 bg-slate-900/40 p-3">
                <p className="mb-2 text-[11px] font-semibold text-amber-50">
                  {isShortOcrText ? "Partial OCR fragment" : "Extracted text"}
                </p>
                <p className="text-[11px] leading-5 text-amber-100 max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
                  {result.extractedText.slice(0, 1000)}
                  {result.extractedText.length > 1000 ? "\n\n[Text truncated...]" : ""}
                </p>
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRetryVision}
              disabled={retryVisionLoading || loading || !imageFile}
              className="rounded-md bg-gradient-to-r from-amber-400 to-amber-300 px-4 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 hover:shadow-lg hover:shadow-amber-500/50 transition"
            >
              {retryVisionLoading ? "🔄 Retrying Vision..." : "🔄 Retry Vision"}
            </button>
            {!imageFile && (
              <span className="text-[11px] text-amber-200">
                Re-upload the image to retry Vision.
              </span>
            )}
          </div>

          {/* Recovery Steps */}
          <div className="mt-2 rounded-md border border-amber-200/30 bg-amber-950/30 p-3 text-[11px] leading-5 text-amber-100">
            <p className="mb-2 font-semibold text-amber-50">💡 Tips to recover Vision API</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Temporary outages often recover quickly - try retrying.</li>
              <li>Increase contrast and reduce glare for better text recognition.</li>
              <li>Use a tighter crop focusing on key content.</li>
            </ul>
          </div>

          {/* AI Deep Analysis Section */}
          <div className="mt-3 rounded-md border border-cyan-300/30 bg-cyan-950/20 p-3 text-[11px] leading-5 text-cyan-100">
            <p className="font-semibold text-cyan-50">🤖 Ask AI for deeper analysis</p>
            <p className="mt-1 text-xs">
              Use AI Chat to extract additional details and insights from the OCR text.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  handleFallbackChatPrompt(
                    "Based on the extracted text, what are the key details and main points?"
                  )
                }
                disabled={chatLoading || !canChat}
                className="rounded-md bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-cyan-300 transition"
              >
                📌 Key Details
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFallbackChatPrompt(
                    "Provide a more detailed analysis and interpretation of this content."
                  )
                }
                disabled={chatLoading || !canChat}
                className="rounded-md border border-cyan-300/60 bg-transparent px-3 py-1.5 text-xs font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-cyan-950/40 transition"
              >
                🔍 Deep Dive
              </button>
              <button
                type="button"
                onClick={() =>
                  handleFallbackChatPrompt(
                    "Extract and organize key information into a structured format."
                  )
                }
                disabled={chatLoading || !canChat}
                className="rounded-md border border-emerald-300/60 bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 hover:bg-emerald-900/40 transition"
              >
                ✓ Structure Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Description (for images) */}
      {result.description && !isOCRMode && (
        <div className="rounded-lg bg-slate-800/60 p-3">
          <h4 className="mb-1 text-sm font-bold text-cyan-200">📸 Image Description</h4>
          <p className="text-sm text-cyan-50">{result.description}</p>
        </div>
      )}

      {/* Detected Items (for images) */}
      {Array.isArray(result.detectedItems) && result.detectedItems.length > 0 && !isOCRMode && (
        <div className="rounded-lg bg-slate-800/60 p-3">
          <h4 className="mb-2 text-sm font-bold text-cyan-200">🎯 Detected Items</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {result.detectedItems.map((item, idx) => (
              <div key={`${item?.name || "item"}-${idx}`} className="rounded-md border border-cyan-300/20 bg-slate-900/60 p-2">
                <p className="text-sm font-semibold text-cyan-100">{item?.name || "Unknown"}</p>
                {typeof item?.confidence === "number" && (
                  <p className="text-xs text-cyan-300">
                    📊 {Math.round(item.confidence * 100)}% confidence
                  </p>
                )}
                {Array.isArray(item?.attributes) && item.attributes.length > 0 && (
                  <p className="text-xs text-cyan-50">{item.attributes.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markdown Export */}
      {result.markdownSummary && (
        <div className="mt-4 border-t border-cyan-300/20 pt-4">
          <h4 className="mb-2 text-sm font-bold text-cyan-200">📄 Markdown Export</h4>
          <pre className="overflow-x-auto rounded bg-slate-850 p-3 text-xs text-emerald-200 max-h-48 overflow-y-auto">
            {result.markdownSummary}
          </pre>
        </div>
      )}
    </div>
  );
}

export default SummarySection;
