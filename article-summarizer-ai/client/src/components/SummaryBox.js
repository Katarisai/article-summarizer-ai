import React from "react";

function SummaryBox({ title, sourceUrl, summary, markdownSummary }) {
  const copySummary = async () => {
    if (!summary) {
      return;
    }

    await navigator.clipboard.writeText(summary);
  };

  const downloadMarkdown = () => {
    if (!markdownSummary) {
      return;
    }

    const blob = new Blob([markdownSummary], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "summary.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold text-cyan-100">Summary</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copySummary}
            className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={downloadMarkdown}
            className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            Download
          </button>
        </div>
      </div>

      {title ? <p className="mb-2 text-sm text-cyan-200">Title: {title}</p> : null}
      {sourceUrl ? <p className="mb-3 break-all text-xs text-cyan-300">Source: {sourceUrl}</p> : null}

      <p className="rounded-2xl bg-slate-950/70 p-4 text-sm leading-6 text-cyan-50">{summary || "No summary yet."}</p>

      <h3 className="mt-4 text-sm font-bold text-cyan-200">Markdown Output</h3>
      <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950/90 p-4 text-xs text-emerald-200">{markdownSummary || "No markdown generated yet."}</pre>
    </section>
  );
}

export default SummaryBox;
