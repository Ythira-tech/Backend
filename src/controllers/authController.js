const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (req, res) => {
  console.log("🔐 REGISTER request received:", req.body);
  
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required: name, email, password" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ 
      name: name.trim(), 
      email: email.toLowerCase().trim(), 
      password: hashedPassword 
    });
    
    await newUser.save();
    console.log("✅ New user registered:", newUser.email);
    
    res.status(201).json({ 
      message: "User registered successfully", 
      user: { 
        id: newUser._id, 
        name: newUser.name, 
        email: newUser.email 
      } 
    });
  } catch (err) {
    console.error("❌ Register error:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({ message: "User already exists with this email" });
    }
    
    res.status(500).json({ message: "Server error during registration" });
  }
};

const loginUser = async (req, res) => {
  console.log("🔐 LOGIN request received:", req.body);
  
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      console.log("❌ Login failed: User not found for email:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Login failed: Invalid password for email:", email);
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Create token
    const token = jwt.sign(
      { id: user._id }, 
      process.env.JWT_SECRET || "fallback_secret_for_development_only", 
      { expiresIn: "7d" }
    );

    console.log("✅ Login successful for:", user.email);
    
    res.json({ 
      message: "Login successful", 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email 
      } 
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};

module.exports = { registerUser, loginUser };