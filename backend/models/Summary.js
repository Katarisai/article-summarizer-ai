const mongoose = require("mongoose");

const SummarySchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ["text", "url", "video", "audio", "document", "image"],
    default: "text"
  },
  sourceUrl: {
    type: String,
    default: ""
  },
  title: {
    type: String,
    default: ""
  },
  originalText: {
    type: String,
    required: true
  },
  summaryText: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  extractedText: {
    type: String,
    default: ""
  },
  keyPoints: {
    type: [String],
    default: []
  },
  detectedItems: {
    type: [
      {
        name: {
          type: String,
          default: ""
        },
        confidence: {
          type: Number,
          default: null
        },
        attributes: {
          type: [String],
          default: []
        }
      }
    ],
    default: []
  },
  markdownSummary: {
    type: String,
    default: ""
  },
  transcriptionNote: {
    type: String,
    default: ""
  },
  language: {
    type: String,
    default: "English"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Summary", SummarySchema);