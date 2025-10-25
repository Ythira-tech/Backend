const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

// Check required environment variables
console.log("🔧 Environment Check:");
console.log("   PORT:", process.env.PORT || 5001);
console.log("   MONGO_URI:", process.env.MONGO_URI ? "✅ Set" : "❌ Missing");
console.log("   JWT_SECRET:", process.env.JWT_SECRET ? "✅ Set" : "❌ Missing");
console.log("   HUGGINGFACE_API_KEY:", process.env.HUGGINGFACE_API_KEY ? "✅ Set" : "❌ Missing - using fallback");

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({ 
  origin: "http://localhost:3000", 
  credentials: true 
}));
app.use(express.json());

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Import models
const Message = require("./src/models/Message");

// Create namespaces
const privateChat = io.of('/private-chat');
const communityChat = io.of('/community-chat');

// Debug middleware
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log("   Body:", req.body);
  }
  next();
});

// ✅ Connect to MongoDB
console.log("🔄 Attempting to connect to MongoDB...");

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/agriconnect", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ Connected to MongoDB");
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err.message);
  console.log("⚠️  Continuing without MongoDB - some features may not work");
});

// ✅ Load routes with error handling
try {
  console.log("🔄 Loading auth routes...");
  const authRoutes = require("./src/routes/authRoutes");
  app.use("/api/auth", authRoutes);
  console.log("✅ Auth routes loaded successfully");
} catch (error) {
  console.error("❌ Failed to load auth routes:", error.message);
  // Create fallback auth routes
  app.post("/api/auth/register", (req, res) => {
    res.status(500).json({ message: "Auth routes not loaded properly" });
  });
  app.post("/api/auth/login", (req, res) => {
    res.status(500).json({ message: "Auth routes not loaded properly" });
  });
}

// 🌐 Basic routes
app.get("/", (req, res) => {
  res.json({ 
    message: "🌱 AgriConnect API Server is Running!",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      test: "/api/test",
      socket: "WebSocket on /"
    }
  });
});

app.get("/api/test", (req, res) => {
  res.json({ 
    message: "✅ API test route is working!",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "✅ Connected" : "❌ Disconnected"
  });
});

// 🧠 IMPROVED Hugging Face chatbot helper with better debugging
async function getHuggingFaceResponse(userInput) {
  console.log(`🤖 [HuggingFace] Processing: "${userInput}"`);
  
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.log("❌ [HuggingFace] No API key found");
    return "🌱 I'm here to help with farming questions! Ask me about crops, weather, pests, or farming techniques. (API key required for full AI features)";
  }

  // Simple farming-related fallback responses
  const farmingKeywords = {
    'hello': '👋 Hello! I\'m your AgriConnect assistant. How can I help with your farming today?',
    'hi': '👋 Hi there! Ready to talk farming?',
    'agriculture': '🌾 Agriculture is the practice of cultivating plants and livestock. I can help with crop rotation, soil health, irrigation, pest control, and modern farming techniques!',
    'crop': '🌱 Crops are plants cultivated for food, fiber, and other uses. Popular crops include maize, wheat, rice, and vegetables. Need specific advice?',
    'weather': '☀️ Weather greatly affects farming! I can help you understand seasonal patterns, rainfall needs, and how to protect crops from extreme weather.',
    'pest': '🐛 Pest management is crucial! Integrated Pest Management (IPM) combines biological, cultural, and chemical methods. Tell me what pests you\'re dealing with!',
    'soil': '🌍 Healthy soil = healthy crops! Soil needs proper pH, nutrients, and organic matter. Soil testing can guide fertilizer use.',
    'fertilizer': '💪 Fertilizers provide essential nutrients (N-P-K). Organic options include manure and compost, while synthetic ones offer precise nutrient control.',
    'water': '💧 Proper irrigation is key! Drip irrigation saves water, while sprinklers cover large areas. The right method depends on your crops and local climate.',
    'maize': '🌽 Maize (corn) needs warm weather, well-drained soil, and regular water. Plant after last frost and harvest when kernels are firm.',
    'tomato': '🍅 Tomatoes need full sun, support stakes, and consistent watering. Watch for blight and use mulch to retain moisture.',
    'help': '🤔 I can help with: crop advice, weather impacts, pest control, soil health, irrigation, and general farming best practices. What do you need?'
  };

  // Check for keywords first
  const lowerInput = userInput.toLowerCase();
  for (const [keyword, response] of Object.entries(farmingKeywords)) {
    if (lowerInput.includes(keyword)) {
      console.log(`✅ [HuggingFace] Using keyword response for: ${keyword}`);
      return response;
    }
  }

  try {
    console.log(`🔗 [HuggingFace] Calling API...`);
    
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill",
      { 
        inputs: userInput,
        parameters: {
          max_length: 150,
          temperature: 0.9,
          do_sample: true
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    console.log("📨 [HuggingFace] Raw API response received");

    // Handle different response formats
    let reply = "🌱 Thanks for your question! As a farming assistant, I can help with crop advice, weather impacts, pest control, and sustainable practices.";
    
    if (response.data?.generated_text) {
      reply = response.data.generated_text;
    } else if (response.data?.[0]?.generated_text) {
      reply = response.data[0].generated_text;
    } else if (response.data?.conversation?.generated_responses?.[0]) {
      reply = response.data.conversation.generated_responses[0];
    } else {
      console.log("❌ [HuggingFace] Unexpected response format");
      reply = "🌱 I understand you're asking about farming! I specialize in crop management, soil health, and sustainable agriculture practices. Can you tell me more about your specific needs?";
    }

    console.log(`✅ [HuggingFace] Final reply: ${reply}`);
    return reply;
    
  } catch (error) {
    console.error("❌ [HuggingFace] API error:", error.message);
    
    if (error.response?.status === 503) {
      return "🔄 The AI model is loading. Please try again in 20-30 seconds. Meanwhile, I can tell you about crop rotation or soil health!";
    } else if (error.code === 'ECONNABORTED') {
      return "⏰ The AI is taking too long to respond. Let me help directly: I specialize in farming advice like crop selection, pest management, and irrigation techniques!";
    } else if (error.response?.status === 401) {
      return "🔐 API authentication issue. But I can still help with farming advice! Ask me about crops, soil, or weather patterns.";
    } else {
      // Use farming-focused fallback based on input
      if (lowerInput.includes('?')) {
        return "🌱 That's a great farming question! While I work on a detailed answer, remember: proper soil preparation and timely planting are key to successful crops. What specific crop are you working with?";
      } else {
        return "🌱 Thanks for sharing! As your farming assistant, I can help with crop advice, weather planning, pest control, and sustainable practices. What would you like to know more about?";
      }
    }
  }
}

// 🟢 PRIVATE CHAT Namespace (AI Assistant)
privateChat.on("connection", async (socket) => {
  console.log(`🟢 User connected to PRIVATE chat: ${socket.id}`);
  
  // Send welcome message immediately
  socket.emit("receive_private_message", {
    user: "AgriBot 🤖",
    text: "👋 Hello! I'm your AgriConnect AI assistant. How can I help with your farming today?",
    timestamp: new Date()
  });

  try {
    // Send private chat history
    const messages = await Message.find({ chatType: 'private' }).sort({ timestamp: 1 }).limit(20);
    console.log(`📨 Sending ${messages.length} previous PRIVATE messages to ${socket.id}`);
    socket.emit("private_chat_history", messages);
  } catch (error) {
    console.error("❌ Error fetching private chat history:", error.message);
  }

  // Handle new user message in PRIVATE chat
  socket.on("send_private_message", async (data) => {
    console.log(`📨 New PRIVATE message from ${socket.id}:`, data);
    
    if (!data.text || data.text.trim() === "") {
      console.log("❌ Empty private message received, ignoring");
      return;
    }

    try {
      // Save user message to database with private chat type
      const userMsg = new Message({
        user: data.user || "Anonymous Farmer",
        text: data.text.trim(),
        chatType: "private"
      });
      await userMsg.save();
      console.log("✅ Private user message saved to DB");

      // ✅ FIXED: Send user message only to the original sender (not broadcast)
      const userMessageData = {
        _id: userMsg._id,
        user: userMsg.user,
        text: userMsg.text,
        timestamp: userMsg.timestamp
      };
      socket.emit("receive_private_message", userMessageData); // ✅ CHANGED: socket.emit instead of privateChat.emit
      console.log("✅ Private user message sent to sender");

      // Get AI response - WITH TIMEOUT PROTECTION
      console.log("🤖 Starting AI response process for private chat...");
      const aiReplyText = await Promise.race([
        getHuggingFaceResponse(data.text),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI response timeout')), 15000)
        )
      ]);
      
      console.log(`✅ AI response received: ${aiReplyText}`);

      // Save AI response to database
      const replyMsg = new Message({
        user: "AgriBot 🤖",
        text: aiReplyText,
        chatType: "private"
      });
      await replyMsg.save();
      console.log("✅ AI response saved to DB");

      // ✅ FIXED: Send AI response only to the original sender (not broadcast)
      const aiMessageData = {
        _id: replyMsg._id,
        user: replyMsg.user,
        text: replyMsg.text,
        timestamp: replyMsg.timestamp
      };
      socket.emit("receive_private_message", aiMessageData); // ✅ CHANGED: socket.emit instead of privateChat.emit
      console.log("✅ AI response sent to private chat");

    } catch (error) {
      console.error("❌ Error in private send_message handler:", error.message);
      
      // Send helpful farming-focused error message
      const errorReply = "🌱 I'm having a temporary issue, but I can still help! Here's some general farming advice: Always test your soil before planting, use crop rotation to maintain soil health, and consider drip irrigation to save water. What specific problem are you facing?";
      
      const errorMsg = new Message({
        user: "AgriBot 🤖",
        text: errorReply,
        chatType: "private"
      });
      
      try {
        await errorMsg.save();
        socket.emit("receive_private_message", errorMsg); // ✅ CHANGED: socket.emit instead of privateChat.emit
        console.log("✅ Private fallback message sent");
      } catch (dbError) {
        console.error("❌ Couldn't save private fallback message:", dbError);
        socket.emit("receive_private_message", {
          user: "AgriBot 🤖",
          text: errorReply,
          timestamp: new Date()
        });
      }
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔴 User disconnected from PRIVATE chat: ${socket.id} - Reason: ${reason}`);
  });
});

// 🟢 COMMUNITY CHAT Namespace (Farmer Community)
communityChat.on("connection", async (socket) => {
  console.log(`🟢 User connected to COMMUNITY chat: ${socket.id}`);
  
  try {
    // Send community chat history
    const messages = await Message.find({ chatType: 'community' }).sort({ timestamp: 1 }).limit(50);
    console.log(`📨 Sending ${messages.length} previous COMMUNITY messages to ${socket.id}`);
    socket.emit("community_chat_history", messages);
  } catch (error) {
    console.error("❌ Error fetching community chat history:", error.message);
  }

  // Handle new user message in COMMUNITY chat
  socket.on("send_community_message", async (data) => {
    console.log(`📨 New COMMUNITY message from ${socket.id}:`, data);
    
    if (!data.text || data.text.trim() === "") {
      console.log("❌ Empty community message received, ignoring");
      return;
    }

    try {
      // Save community message to database
      const communityMsg = new Message({
        user: data.user || "Community Farmer",
        text: data.text.trim(),
        chatType: "community"
      });
      await communityMsg.save();
      console.log("✅ Community message saved to DB");

      // Broadcast to all users in community chat (NO AI RESPONSE)
      const messageData = {
        _id: communityMsg._id,
        user: communityMsg.user,
        text: communityMsg.text,
        timestamp: communityMsg.timestamp
      };
      communityChat.emit("receive_community_message", messageData);
      console.log("✅ Community message broadcasted");

    } catch (error) {
      console.error("❌ Error in community send_message handler:", error.message);
      
      // Send error message only to the sender
      socket.emit("receive_community_message", {
        user: "System",
        text: "❌ Failed to send message. Please try again.",
        timestamp: new Date(),
        type: "error"
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`🔴 User disconnected from COMMUNITY chat: ${socket.id} - Reason: ${reason}`);
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Start server
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`\n🚀 AgriConnect Server Started Successfully!`);
  console.log(`📍 Base URL: http://localhost:${PORT}`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`🤖 Socket.IO Namespaces:`);
  console.log(`   - Private Chat: /private-chat`);
  console.log(`   - Community Chat: /community-chat`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    mongoose.connection.close();
    console.log("✅ MongoDB connection closed");
    process.exit(0);
  });
});