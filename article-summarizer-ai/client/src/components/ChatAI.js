import React, { useState } from "react";

function ChatAI({ messages, onAsk, disabled, loading }) {
  const [question, setQuestion] = useState("");

  const submitQuestion = async (event) => {
    event.preventDefault();

    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    await onAsk(trimmed);
    setQuestion("");
  };

  return (
    <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
      <h2 className="mb-3 text-xl font-extrabold text-cyan-100">AI Chat with Article</h2>

      <div className="mb-3 max-h-56 space-y-2 overflow-auto rounded-2xl bg-slate-950/70 p-3">
        {!messages.length ? (
          <p className="text-sm text-cyan-300">Ask questions after generating a summary.</p>
        ) : (
          messages.map((item) => (
            <div key={item.id} className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">You</p>
              <p className="text-sm text-cyan-50">{item.question}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">AI</p>
              <p className="text-sm text-emerald-100">{item.answer}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submitQuestion} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask anything about this article"
          className="w-full rounded-xl border border-cyan-500/40 bg-slate-950 px-3 py-2 text-sm text-cyan-50 outline-none"
          disabled={disabled || loading}
        />
        <button
          type="submit"
          disabled={disabled || loading || !question.trim()}
          className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-60"
        >
          Ask AI
        </button>
      </form>
    </section>
  );
}

export default ChatAI;
