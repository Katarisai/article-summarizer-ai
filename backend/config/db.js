const mongoose = require("mongoose");

const maskMongoUri = (uri = "") => {
  if (!uri) {
    return "";
  }

  // Hide credentials while keeping enough context for debugging.
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^@\/]*)@/i, "$1****:****@");
};

const getMongoHost = (uri = "") => {
  try {
    const sanitized = uri.replace(/mongodb\+srv:\/\//i, "https://").replace(/mongodb:\/\//i, "https://");
    const parsed = new URL(sanitized);
    return parsed.host || "unknown-host";
  } catch (_error) {
    return "unknown-host";
  }
};

const connectDB = async () => {
  const mongoUri = (process.env.MONGO_URI || "").trim();

  if (!mongoUri) {
    console.warn("[MongoDB] MONGO_URI is not set. Summaries will work, but history will be disabled.");
    console.warn("[MongoDB] Railway fix: set MONGO_URI in Railway Variables and redeploy.");
    return false;
  }

  try {
    const host = getMongoHost(mongoUri);
    console.log(`[MongoDB] Connecting to ${host} ...`);

    await mongoose.connect(mongoUri);

    console.log("[MongoDB] Connected");
    return true;
  } catch (error) {
    const maskedUri = maskMongoUri(mongoUri);
    const code = error?.code || "UNKNOWN";
    const message = error?.message || "Unknown MongoDB error";

    console.error(`[MongoDB] Connection failed (${code}): ${message}`);
    console.error(`[MongoDB] URI used: ${maskedUri}`);
    console.warn("[MongoDB] Summaries will work, but history will be disabled.");
    console.warn("[MongoDB] Railway checks: verify MONGO_URI, allow network access, and ensure DB user/password are correct.");
    return false;
  }
};

module.exports = connectDB;
