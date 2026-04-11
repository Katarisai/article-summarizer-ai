import React from "react";

function UploadProgress({ progress = 0, fileName = "File", isUploading = false }) {
  if (!isUploading && progress === 0) {
    return null;
  }

  const displayProgress = Math.min(Math.max(progress, 0), 100);
  const isComplete = displayProgress >= 99;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 animate-in fade-in duration-300">
      <div className="mx-auto max-w-2xl rounded-3xl bg-gradient-to-r from-blue-900/95 to-cyan-900/95 p-6 shadow-2xl ring-2 ring-blue-400/50 backdrop-blur-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              {isComplete ? (
                <div className="h-6 w-6 animate-bounce rounded-full bg-green-400 flex items-center justify-center">
                  <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="relative h-6 w-6">
                  <div className="absolute h-full w-full rounded-full border-2 border-blue-300/30" />
                  <div
                    className="absolute h-full w-full rounded-full border-2 border-transparent border-t-blue-400 border-r-blue-400 animate-spin"
                    style={{
                      borderTopColor: "rgb(96, 165, 250)",
                      borderRightColor: "rgb(96, 165, 250)"
                    }}
                  />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-blue-100">
                {isComplete ? "✓ Upload Complete" : "📤 Uploading..."}
              </p>
              <p className="text-xs text-blue-200 truncate max-w-xs">
                {fileName}
              </p>
            </div>
          </div>
          <span className="text-lg font-bold text-blue-300">{displayProgress}%</span>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="h-3 overflow-hidden rounded-full bg-slate-700/50 border border-blue-400/30">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                isComplete
                  ? "bg-gradient-to-r from-green-400 to-emerald-400"
                  : "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 shadow-lg shadow-blue-500/50"
              }`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>

        {/* Status Message */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-blue-200">
            {displayProgress < 20 && "🔄 Initializing upload..."}
            {displayProgress >= 20 && displayProgress < 50 && "📊 Uploading file..."}
            {displayProgress >= 50 && displayProgress < 99 && "⚡ Almost there..."}
            {displayProgress >= 99 && "🔄 Processing on server..."}
          </p>
          {!isComplete && (
            <p className="text-xs font-semibold text-cyan-300 animate-pulse">
              Do not close this window
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadProgress;
