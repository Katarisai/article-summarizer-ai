const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn("MONGO_URI is not set. Summaries will work, but history will be disabled.");
    return false;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
    return true;
  } catch (error) {
    console.error(error);
    console.warn("MongoDB connection failed. Summaries will work, but history will be disabled.");
    return false;
  }
};

module.exports = connectDB;
