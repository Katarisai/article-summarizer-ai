import React from 'react';

function SummaryDisplay({ summary }) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(summary);
    alert('Summary copied to clipboard!');
  };

  return (
    <div className="summary-container">
      <div className="summary-header">
        <h2>📌 Generated Summary</h2>
        <button className="copy-button" onClick={copyToClipboard} title="Copy summary">
          📋 Copy
        </button>
      </div>
      <div className="summary-content">
        {summary}
      </div>
    </div>
  );
}

export default SummaryDisplay;
