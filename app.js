const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const cors = require("cors");
const userModel = require("./models/user.model");
const postModel = require("./models/post.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("Backend is running successfully 🚀");
});

// ================= Register =================
 app.post("/register", async (req, res) => {
  try {
    let { name, email, password } = req.body;

    let user = await userModel.findOne({ email });
    if (user) {
      return res.status(400).send("User already registered!");
    }

    bcrypt.hash(password, 10, async (err, hash) => {
      if (err) return res.status(500).send("Error hashing password");

      const newUser = await userModel.create({
        name,
        email,
        password: hash,
      });

      const token = jwt.sign(
        { email: email, userId: newUser._id },
        process.env.JWT_SECRET,
        { expiresIn: "1h" } // ✅ expiry lagana best practice hai
      );

      res.cookie("token", token, { httpOnly: true }); // ✅ httpOnly cookie
      return res
        .status(201)
        .json({ message: "User registered", user: newUser });
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// ================= Login =================

app.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    let user = await userModel.findOne({ email });

    if (!user) return res.status(400).send("User not registered!");
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) return res.status(401).send("Invalid credentials");
    let token = jwt.sign(
      { email: email, userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, { httpOnly: true }); // ✅ secure cookie
    res.status(200).send("Login successful");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// ================= Logout =================
app.get("/logout", (req, res) => {
  // ❌ pehle tumne comment kiya tha aur cookie ko khali string kar rahe the
  // ✅ sahi tarika: clearCookie
  res.clearCookie("token");
  res.send("User logged out");
});

// ================= Middleware =================

function isLoggedIn(req, res, next) {
  const token = req.cookies.token;
  if (!token){
     return res.status(401).json({ message: "Please login first!" });
  }

  try {
    let data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data;
    next(); // ✅ token valid → next route
  } catch (err) {
    res.status(401).json({ message: "Invalid token, please login again" });
  }
}

// ================= Profile =================
app.get("/profile", isLoggedIn, async (req, res) => {
  try {
    // ❌ tumne direct sare users bhej diye the
    // ✅ sirf logged in user ka profile bhejna chahiye
    let user = await userModel
      .findOne({ email: req.user.email })
      .populate("posts");

    if (!user) return res.status(404).send("User not found");

    res.json(user);
  } catch (error) {
    res.status(500).send("Server error");
  }
});


// ================= Create Post =================
app.post("/post", isLoggedIn, async (req, res) => {
  try {
    let user = await userModel.findOne({ email: req.user.email });
    if (!user) return res.status(404).send("User not found");

    let { title, description, img } = req.body;
    
    const post = await postModel.create({
      user: user._id,
      title,
      description,
      img,
    });

    user.posts.push(post._id);
    await user.save();

    res.status(201).send(post);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/post", isLoggedIn, async (req, res) => {
  try {
    let user = await userModel
      .findOne({ email: req.user.email })
      .populate("posts"); // user ke saare posts laa do

    if (!user) return res.status(404).send("User not found");

    res.json(user.posts);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// ================= Update User =================
// Update Post
app.put("/post/:id", isLoggedIn, async (req, res) => {
  try {
    const post = await postModel.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId }, // ✅ correct
      req.body,
      { new: true }
    );

    if (!post) return res.status(404).send("Post not found or unauthorized");

    res.json(post);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

//delete
app.delete("/post/:id", isLoggedIn, async (req, res) => {
  try {
    const post = await postModel.findOne({
      _id: req.params.id,
      user: req.user.userId,   // ✅ sahi field
    });

    if (!post) return res.status(404).send("Post not found or unauthorized");

    await postModel.findByIdAndDelete(req.params.id);

    await userModel.findByIdAndUpdate(req.user.userId, {
      $pull: { posts: req.params.id },
    });

    res.send("Post deleted");
  } catch (error) {
    res.status(500).send(error.message);
  }
});




module.exports = app;
