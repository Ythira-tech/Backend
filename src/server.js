// src/server.js
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const cors = require("cors");

require("dotenv").config();


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.json());
app.use(express.json());
app.use(cors());

// Test if .env is loaded
console.log("Mongo URI:", process.env.MONGO_URI);
console.log("Server PORT:", port);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ Could not connect to MongoDB:", err));

// Routes
const authRoutes = require("./routes/authRoutes"); // make sure this file exists
app.use("/api/auth", authRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("🌿 Welcome to Agriconnect Backend API!");
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
