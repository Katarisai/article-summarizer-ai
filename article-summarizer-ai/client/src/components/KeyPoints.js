import React from "react";

function KeyPoints({ points }) {
  return (
    <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
      <h2 className="mb-3 text-xl font-extrabold text-cyan-100">Key Points</h2>

      {!points.length ? (
        <p className="text-sm text-cyan-300">No key points yet.</p>
      ) : (
        <ul className="space-y-2">
          {points.map((point, index) => (
            <li key={`${point}-${index}`} className="rounded-xl bg-slate-950/70 p-3 text-sm text-cyan-50">
              {point}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default KeyPoints;
