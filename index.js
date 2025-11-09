require('dotenv').config({ debug: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();

// ✅ Simplified CORS for localhost & deployed front-end
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads and credentials directories exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const credentialsDir = path.join(__dirname, 'credentials');
if (!fs.existsSync(credentialsDir)) fs.mkdirSync(credentialsDir, { recursive: true });

app.use('/credentials', express.static(credentialsDir));

// ✅ Health Check Route (Render Requirement)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server running', timestamp: new Date().toISOString() });
});

// ✅ Auth Routes
try {
  app.use(require('./routes/auth'));
} catch (e) {
  console.error('Auth Routes Error:', e.message);
}

// ✅ Parent Routes
try {
  app.use('/api/parent', require('./routes/parent'));
} catch (e) {
  console.error('Parent Routes Error:', e.message);
}

// ✅ Teacher Routes
try {
  app.use('/api/teacher', require('./routes/teacher'));
} catch (e) {
  console.error('Teacher Routes Error:', e.message);
}

// ✅ Therapist Routes
try {
  app.use('/api/therapist', require('./routes/therapist'));
} catch (e) {
  console.error('Therapist Routes Error:', e.message);
}

// ✅ Researcher Routes
try {
  app.use('/api/researcher', require('./routes/researcher'));
} catch (e) {
  console.error('Researcher Routes Error:', e.message);
}

// ✅ Admin Routes
try {
  app.use('/api/admin', require('./routes/admin'));
} catch (e) {
  console.error('Admin Routes Error:', e.message);
}

// ✅ Image Prediction (CNN Face Model)
try {
  app.use('/api/predict', require('./routes/predictRoutes'));
} catch (e) {
  console.error('Predict Routes Error:', e.message);
}

// ❌ TEMP DISABLED: MRI Scan Model (Python not supported on Render free tier)
/*
const multer = require('multer');
const { spawn } = require('child_process');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

app.post('/api/predict-mri', upload.single('file'), async (req, res) => {
  return res.status(503).json({
    message: "MRI Prediction temporarily disabled on Render free tier. Will be enabled in cloud ML runner.",
  });
});
*/

// ✅ Start Server + Connect DB
const PORT = process.env.PORT || 5000;

async function start() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('⚠ MONGO_URI is missing. Set it in Render environment variables.');
  } else {
    try {
      await mongoose.connect(mongoUri);
      console.log('✅ MongoDB Connected');
    } catch (err) {
      console.error('❌ MongoDB Connection Failed:', err.message);
    }
  }
app.get('/', (req, res) => {
  res.send('✅ ASD Backend Server is Running');
});

  app.listen(PORT, () => console.log(`🚀 Server Live on Port ${PORT}`));
}

start();
