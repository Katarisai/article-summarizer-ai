import React from "react";

function Header() {
  return (
    <header className="rounded-3xl bg-white/10 p-6 shadow-xl ring-1 ring-white/20 backdrop-blur-md">
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Article Summarizer AI</h1>
      <p className="mt-2 max-w-3xl text-sm text-cyan-100 sm:text-base">
        Enter URL | Click Generate | Get Summary | Ask AI
      </p>
    </header>
  );
}

export default Header;
