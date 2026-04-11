import React from "react";

function History({ items, onLoad, onDelete }) {
  return (
    <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
      <h2 className="mb-3 text-xl font-extrabold text-cyan-100">History / Notes</h2>

      {!items.length ? (
        <p className="text-sm text-cyan-300">No history yet.</p>
      ) : (
        <div className="max-h-[30rem] space-y-3 overflow-auto pr-1">
          {items.map((item) => (
            <article key={item._id} className="rounded-2xl bg-slate-950/70 p-3">
              <p className="line-clamp-3 text-sm text-cyan-50">{item.summaryText}</p>
              {item.sourceUrl ? <p className="mt-1 line-clamp-1 text-xs text-cyan-300">{item.sourceUrl}</p> : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLoad(item)}
                  className="rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-bold text-slate-950"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item._id)}
                  className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-bold text-white"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default History;
