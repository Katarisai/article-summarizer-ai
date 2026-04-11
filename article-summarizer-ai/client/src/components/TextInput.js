import React from 'react';

function TextInput({ inputText, onInputChange, onSubmit, onClear, loading, error }) {
  return (
    <div className="text-input-container">
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="article-input">Enter Article or Text to Summarize</label>
          <textarea
            id="article-input"
            className="text-input"
            placeholder="Paste your article, news, or any text content here..."
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            disabled={loading}
            rows="10"
          ></textarea>
          <div className="char-count">
            {inputText.length} characters
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={loading || !inputText.trim()}
        >
          {loading ? 'Summarizing...' : 'Summarize'}
        </button>

        <button type="button" className="clear-button" onClick={onClear}>
          Clear
        </button>
      </form>
    </div>
  );
}

export default TextInput;
