const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  user: { type: String, default: "Anonymous" },
  text: { type: String, required: true },
  reply: { type: String },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
