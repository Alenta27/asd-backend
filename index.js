require('dotenv').config({ debug: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Make io accessible in routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔌 Client connected to socket:', socket.id);
  
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    console.log(`👤 Client joined session room: ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected');
  });
});

// ✅ Simplified CORS for localhost & deployed front-end
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads and credentials directories exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const gazeUploadsDir = path.join(__dirname, 'uploads/gaze');
if (!fs.existsSync(gazeUploadsDir)) fs.mkdirSync(gazeUploadsDir, { recursive: true });

const credentialsDir = path.join(__dirname, 'credentials');
if (!fs.existsSync(credentialsDir)) fs.mkdirSync(credentialsDir, { recursive: true });

// Serve static files - CRITICAL for stimulus videos and guest session images
app.use('/credentials', express.static(credentialsDir));
app.use('/uploads', express.static(uploadsDir)); 
app.use('/uploads/gaze', express.static(gazeUploadsDir)); 
app.use('/videos', express.static(path.join(__dirname, 'public/videos')));

console.log('📁 Serving uploads from:', uploadsDir);
console.log('📸 Serving gaze images from:', gazeUploadsDir);

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

// ✅ Gaze Live Session Routes
try {
  app.use('/api/gaze', require('./routes/gaze'));
} catch (e) {
  console.error('Gaze Routes Error:', e.message);
}

// ✅ Guest Routes (Unauthenticated)
try {
  app.use('/api/guest', require('./routes/guest'));
} catch (e) {
  console.error('Guest Routes Error:', e.message);
}

// ✅ Behavioral Assessment Routes
try {
  app.use('/api/behavioral', require('./routes/behavioral'));
} catch (e) {
  console.error('Behavioral Routes Error:', e.message);
}

// ✅ Social Attention Test Routes
try {
  const socialAttentionRoutes = require('./routes/socialAttention');
  app.use('/api/social-attention', socialAttentionRoutes);
  console.log('✅ Social Attention Routes Registered');
} catch (e) {
  console.error('Social Attention Routes Error:', e.message);
}

// ✅ Speech Therapy Routes
try {
  app.use('/api/speech-therapy', require('./routes/speechTherapy'));
  console.log('✅ Speech Therapy Routes Registered');
} catch (e) {
  console.error('Speech Therapy Routes Error:', e.message);
}

// ✅ Subscription Routes
try {
  app.use('/api/subscription', require('./routes/subscription'));
  console.log('✅ Subscription Routes Registered');
} catch (e) {
  console.error('Subscription Routes Error:', e.message);
}

// ✅ MRI Scan Model: accept file upload and return stub JSON
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

app.post('/api/predict-mri', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // TODO: integrate real MRI prediction pipeline. For now, return a stub prediction
    const diagnosis = Math.random() < 0.5 ? 'ASD' : 'Control';
    const confidence = Number((0.6 + Math.random() * 0.35).toFixed(2));
    const asd_probability = diagnosis === 'ASD' ? confidence : Number((1 - confidence).toFixed(2));
    const control_probability = Number((1 - asd_probability).toFixed(2));

    return res.status(200).json({
      diagnosis,
      confidence,
      asd_probability,
      control_probability,
      filename: req.file.filename,
    });
  } catch (err) {
    console.error('MRI prediction route error:', err);
    return res.status(500).json({ error: 'MRI prediction failed' });
  }
});

// ✅ Gaze Snapshot Analysis: capture and analyze gaze from webcam snapshot

app.post('/api/predict-gaze-snapshot', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = path.resolve(req.file.path);
    const gazeWorkerPath = path.resolve(__dirname, 'gaze_worker.py');

    console.log('📷 Processing gaze snapshot:', imagePath);
    console.log('📍 Gaze worker path:', gazeWorkerPath);
    console.log('📝 File exists:', fs.existsSync(imagePath));
    console.log('📝 Worker exists:', fs.existsSync(gazeWorkerPath));

    return new Promise((resolve) => {
      const pythonProcess = spawn('py', ['-3.10', gazeWorkerPath, imagePath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const timeout = setTimeout(() => {
        pythonProcess.kill();
        console.error('Python process timeout after 60 seconds');
        resolve(res.status(500).json({
          error: 'Gaze analysis timed out',
          gaze_direction: 'unknown',
          attention_score: 0,
          head_pitch: 0,
          head_yaw: 0,
        }));
      }, 60000);

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        console.log('📊 Python process exit code:', code);
        console.log('📊 Python stdout length:', output.length);
        console.log('📊 Python stderr length:', errorOutput.length);
        
        if (errorOutput) {
          console.error('Python stderr:', errorOutput);
        }

        if (!output.trim()) {
          console.error('No output from Python process');
          return resolve(res.status(500).json({
            error: 'No output from gaze analysis process. Check Python dependencies.',
            gaze_direction: 'unknown',
            attention_score: 0,
            head_pitch: 0,
            head_yaw: 0,
          }));
        }

        try {
          const result = JSON.parse(output.trim());

          if (result.error) {
            console.error('Gaze analysis error:', result.error);
            return resolve(res.status(400).json({
              error: result.error || 'Gaze analysis failed',
              gaze_direction: 'unknown',
              attention_score: 0,
              head_pitch: 0,
              head_yaw: 0,
            }));
          }

          console.log('✅ Gaze analysis complete:', result);

          resolve(res.status(200).json({
            gaze_direction: result.gaze_direction,
            attention_score: Number(result.attention_score.toFixed(3)),
            head_pitch: Number(result.head_pitch.toFixed(2)),
            head_yaw: Number(result.head_yaw.toFixed(2)),
            filename: req.file.filename,
          }));
        } catch (parseError) {
          console.error('JSON parse error:', parseError, 'output:', output);
          resolve(res.status(500).json({
            error: 'Failed to parse gaze analysis response',
            gaze_direction: 'unknown',
            attention_score: 0,
            head_pitch: 0,
            head_yaw: 0,
          }));
        }
      });

      pythonProcess.on('error', (err) => {
        console.error('Python process error:', err);
        resolve(res.status(500).json({
          error: 'Gaze analysis process failed: ' + err.message,
          gaze_direction: 'unknown',
          attention_score: 0,
          head_pitch: 0,
          head_yaw: 0,
        }));
      });
    });
  } catch (err) {
    console.error('Gaze prediction route error:', err);
    return res.status(500).json({
      error: 'Gaze analysis failed: ' + err.message,
      gaze_direction: 'unknown',
      attention_score: 0,
      head_pitch: 0,
      head_yaw: 0,
    });
  }
});

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
      
      // 🧹 DEV MODE: Clear all subscriptions on server start
      // Set CLEAR_SUBSCRIPTIONS=true in .env to enable
      if (process.env.CLEAR_SUBSCRIPTIONS === 'true') {
        const { clearAllSubscriptions } = require('./utils/clearSubscriptions');
        await clearAllSubscriptions();
      }
    } catch (err) {
      console.error('❌ MongoDB Connection Failed:', err.message);
    }
  }
app.get('/', (req, res) => {
  res.send('✅ ASD Backend Server is Running');
});

  // Fallback JSON for unknown /api routes to avoid HTML responses
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  server.listen(PORT, () => console.log(`🚀 Server Live on Port ${PORT}`));
}

start();
