const { EventEmitter } = require("events");

const liveUpdates = new EventEmitter();

const emitSummaryChange = (payload = {}) => {
  liveUpdates.emit("summary-change", payload);
};

const emitHistoryChange = (payload = {}) => {
  liveUpdates.emit("history-change", payload);
};

module.exports = {
  liveUpdates,
  emitSummaryChange,
  emitHistoryChange
};