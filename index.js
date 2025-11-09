require('dotenv').config({ debug: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();

const defaultOrigins = ['http://localhost:3000'];
const envOrigins = (process.env.FRONTEND_URL || '').split(',').map((item) => item.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin) || /^https?:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const credentialsDir = path.join(__dirname, 'credentials');
if (!fs.existsSync(credentialsDir)) {
  fs.mkdirSync(credentialsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isValid = file.originalname.toLowerCase().endsWith('.nii.gz') ||
                  file.originalname.toLowerCase().endsWith('.1d') ||
                  file.originalname.toLowerCase().endsWith('.txt');
  if (!isValid) return cb(new Error('Only .nii.gz, .1D, or .txt files are allowed'));
  cb(null, true);
};

const upload = multer({ storage, fileFilter });

app.use('/credentials', express.static(credentialsDir));

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'MRI bridge is running', timestamp: new Date().toISOString() });
});

// Mount existing auth routes (includes /api/auth/google)
try {
  console.log('Loading auth routes...');
  const authRoutes = require('./routes/auth');
  console.log('Mounting auth routes...');
  app.use(authRoutes);
  console.log('✓ Auth routes mounted');
} catch (e) {
  // If auth routes are not present, keep the server running for MRI bridge only
  console.error('❌ Auth routes error:', e.message);
  console.error(e.stack);
}

// Mount role-based API routes
try {
  console.log('Loading parent routes...');
  const parentRoutes = require('./routes/parent');
  console.log('Mounting parent routes...');
  app.use('/api/parent', parentRoutes);
  console.log('✓ Parent routes mounted');
} catch (e) {
  console.error('❌ Parent routes error:', e.message);
  console.error(e.stack);
}

try {
  console.log('Loading teacher routes...');
  const teacherRoutes = require('./routes/teacher');
  console.log('Mounting teacher routes...');
  app.use('/api/teacher', teacherRoutes);
  console.log('✓ Teacher routes mounted');
} catch (e) {
  console.error('❌ Teacher routes error:', e.message);
  console.error(e.stack);
}

try {
  console.log('Loading therapist routes...');
  const therapistRoutes = require('./routes/therapist');
  console.log('Mounting therapist routes...');
  app.use('/api/therapist', therapistRoutes);
  console.log('✓ Therapist routes mounted');
} catch (e) {
  console.error('❌ Therapist routes error:', e.message);
  console.error(e.stack);
}

try {
  console.log('Loading researcher routes...');
  const researcherRoutes = require('./routes/researcher');
  console.log('Mounting researcher routes...');
  app.use('/api/researcher', researcherRoutes);
  console.log('✓ Researcher routes mounted');
} catch (e) {
  console.error('❌ Researcher routes error:', e.message);
  console.error(e.stack);
}

try {
  console.log('Loading admin routes...');
  const adminRoutes = require('./routes/admin');
  console.log('Mounting admin routes...');
  app.use('/api/admin', adminRoutes);
  console.log('✓ Admin routes mounted');
} catch (e) {
  console.error('❌ Admin routes error:', e.message);
  console.error(e.stack);
}

// Mount image prediction route expected by frontend at /api/predict
try {
  console.log('Loading predict routes...');
  const predictRoutes = require('./routes/predictRoutes');
  console.log('Mounting predict routes...');
  app.use('/api/predict', predictRoutes);
  console.log('✓ Predict routes mounted');
} catch (e) {
  console.error('❌ Predict routes error:', e.message);
  console.error(e.stack);
}

// POST /api/predict-mri
app.post('/api/predict-mri', upload.single('file'), async (req, res) => {
  const uploadedPath = req.file?.path;
  if (!uploadedPath) {
    return res.status(400).json({ error: 'No file uploaded. Use form field name "file".' });
  }

  const pythonBin = process.env.PYTHON_BIN || 'python';
  const workerPath = path.join(__dirname, 'python_worker.py');

  const args = [workerPath, uploadedPath];

  let stdoutData = '';
  let stderrData = '';

  console.log(`🔍 MRI Prediction Request:`);
  console.log(`   File: ${req.file.originalname}`);
  console.log(`   Path: ${uploadedPath}`);
  console.log(`   Python: ${pythonBin}`);
  console.log(`   Worker: ${workerPath}`);

  const child = spawn(pythonBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.on('data', (chunk) => {
    stdoutData += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderrData += chunk.toString();
    console.error('Python stderr:', chunk.toString());
  });

  child.on('error', async (err) => {
    try { await fs.promises.unlink(uploadedPath); } catch (_) {}
    console.error('❌ Python Worker Error:', err);
    return res.status(500).json({ 
      error: 'Failed to start Python worker', 
      details: String(err),
      pythonBin: pythonBin,
      workerPath: workerPath
    });
  });

  child.on('close', async (code) => {
    // Cleanup temp file
    try { await fs.promises.unlink(uploadedPath); } catch (_) {}

    console.log(`Exit code: ${code}`);
    console.log(`Stdout length: ${stdoutData.length}, first 500 chars: ${stdoutData.trim().substring(0, 500)}`);
    console.log(`Stderr length: ${stderrData.length}, content: ${stderrData.trim().substring(0, 500)}`);

    if (code !== 0) {
      console.error('❌ Python worker failed with code:', code);
      console.error('Full stderr:', stderrData);
      console.error('Full stdout:', stdoutData);
      return res.status(500).json({ 
        error: 'Python worker failed', 
        code, 
        stderr: stderrData.trim(),
        stdout: stdoutData.trim(),
        details: 'Check server console for full output'
      });
    }

    const output = stdoutData.trim();
    // If Python returns JSON, pass it through; else wrap as { prediction }
    try {
      const parsed = JSON.parse(output);
      console.log('✅ MRI Prediction Success:', JSON.stringify(parsed));
      return res.json(parsed);
    } catch (parseErr) {
      // Try to extract JSON from mixed output (debug + JSON)
      const jsonMatch = output.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ MRI Prediction Success (extracted):', JSON.stringify(parsed));
          return res.json(parsed);
        } catch (e) {
          // Fall through to wrap as string
        }
      }
      console.warn('⚠️  Warning: Python output was not valid JSON');
      console.warn('Output:', output.substring(0, 200));
      return res.json({ prediction: output });
    }
  });
});

// Note: All role-based routes are already mounted above with their specific prefixes

const PORT = process.env.PORT || 5000;

async function start() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('MONGO_URI is not set. Set it in .env to enable DB features.');
  }

  try {
    if (mongoUri) {
      await mongoose.connect(mongoUri, {
        // modern mongoose no need for useNewUrlParser/useUnifiedTopology
      });
      console.log('MongoDB connected');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start();