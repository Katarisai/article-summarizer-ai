import React, { useEffect } from 'react';
import mermaid from 'mermaid';

function MindMap({ title, keyPoints }) {
  const diagramId = `mindmap-${Date.now()}`;

  useEffect(() => {
    mermaid.contentLoaded();
  }, [keyPoints]);

  if (!keyPoints || keyPoints.length === 0) {
    return (
      <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
        <h2 className="mb-3 text-xl font-extrabold text-cyan-100">Mind Map</h2>
        <p className="text-sm text-cyan-300">Generate a summary first to see the mind map.</p>
      </section>
    );
  }

  const sanitize = (text) =>
    text
      .replace(/["[\]{}()]/g, '')
      .trim()
      .slice(0, 60);

  const rootTitle = sanitize(title || 'Article');
  const points = keyPoints.slice(0, 6).map(sanitize).filter(Boolean);

  if (points.length === 0) {
    return (
      <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
        <h2 className="mb-3 text-xl font-extrabold text-cyan-100">Mind Map</h2>
        <p className="text-sm text-cyan-300">Not enough key points to generate a mind map.</p>
      </section>
    );
  }

  let mermaidCode = `mindmap\n  root((${rootTitle}))`;
  points.forEach((point, index) => {
    mermaidCode += `\n    ${index + 1}. ${point}`;
  });

  return (
    <section className="rounded-3xl bg-slate-900/80 p-5 ring-1 ring-cyan-300/20">
      <h2 className="mb-3 text-xl font-extrabold text-cyan-100">Mind Map</h2>
      <div className="rounded-2xl bg-slate-950/70 p-4 overflow-auto max-h-96">
        <div id={diagramId} className="mermaid">
          {mermaidCode}
        </div>
      </div>
    </section>
  );
}

export default MindMap;
