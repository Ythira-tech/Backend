const express = require("express");
const router = express.Router();
// Update this path to point to src/controllers/
const { registerUser, loginUser } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);

module.exports = router;