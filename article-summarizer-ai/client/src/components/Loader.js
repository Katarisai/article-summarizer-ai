import React from "react";

function Loader({ label = "Generating..." }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-900/80 px-4 py-3 text-sm text-cyan-100 ring-1 ring-cyan-400/30">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-cyan-300" />
      <span>{label}</span>
    </div>
  );
}

export default Loader;
