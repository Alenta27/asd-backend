const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { generateUniqueId } = require('../utils/idGenerator');
const SpeechTherapy = require('../models/SpeechTherapy');
const Patient = require('../models/patient');
const User = require('../models/user');
const SpeechParent = require('../models/SpeechParent');
const SpeechChild = require('../models/SpeechChild');
const { authenticateToken } = require('../middlewares/auth');

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/speech-therapy');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'speech-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /webm|mp3|wav|ogg|m4a|mp4/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'));
    }
  }
});

/**
 * @route   POST /api/speech-therapy/parent
 * @desc    Register a parent for Speech Therapy (name, email, phone)
 * @access  Public
 */
router.post('/parent', async (req, res) => {
  try {
    const { parentName, parentEmail, phone } = req.body;

    if (!parentName || !parentEmail) {
      return res.status(400).json({ error: 'Parent name and email are required' });
    }

    // Check if parent already exists
    let parent = await SpeechParent.findOne({ parentEmail });
    if (parent) {
      return res.json({ 
        message: 'Parent profile already exists', 
        parentId: parent._id,
        parent 
      });
    }

    // Create new parent
    parent = new SpeechParent({
      parentName,
      parentEmail,
      phone: phone || ''
    });

    await parent.save();

    res.status(201).json({
      message: 'Parent registered successfully',
      parentId: parent._id,
      parent
    });
  } catch (error) {
    console.error('Error registering parent:', error);
    res.status(500).json({ error: 'Failed to register parent' });
  }
});

/**
 * @route   POST /api/speech-therapy/child
 * @desc    Register a child under a parent (requires parentId)
 * @access  Public
 */
router.post('/child', async (req, res) => {
  try {
    const { childName, age, preferredLanguage, parentId } = req.body;

    if (!childName || !age || !parentId) {
      return res.status(400).json({ error: 'Child name, age, and parentId are required' });
    }

    // Verify parent exists
    const parent = await SpeechParent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found. Please register parent first.' });
    }

    // Generate unique child ID
    const childId = generateUniqueId('child');
    
    // Create child profile
    const child = new SpeechChild({
      childId,
      childName,
      age: parseInt(age),
      preferredLanguage: preferredLanguage || 'en-US',
      parentId,
      subscriptionExpiry: null // Initially no subscription
    });

    await child.save();

    res.status(201).json({
      message: 'Child registered successfully',
      child
    });
  } catch (error) {
    console.error('Error registering child:', error);
    res.status(500).json({ error: 'Failed to register child' });
  }
});

/**
 * @route   GET /api/speech-therapy/subscription/:childId
 * @desc    Check Pro subscription status for a specific child (Legacy - kept for backwards compatibility)
 * @access  Public
 */
router.get('/subscription/:childId', async (req, res) => {
  try {
    const { childId } = req.params;

    const child = await SpeechChild.findById(childId);
    if (!child) {
      return res.status(404).json({ error: 'Child not found' });
    }

    const now = new Date();
    const isPro = child.subscriptionExpiry && now < new Date(child.subscriptionExpiry);

    res.json({
      childId: child._id,
      childName: child.childName,
      isPro,
      subscriptionExpiry: child.subscriptionExpiry,
      preferredLanguage: child.preferredLanguage,
      message: isPro 
        ? `Pro subscription active until ${new Date(child.subscriptionExpiry).toLocaleDateString()}`
        : 'No active Pro subscription. Only English is available.'
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Failed to check subscription status' });
  }
});

/**
 * @route   GET /api/speech-therapy/subscription-status
 * @desc    Check subscription status for a child (Query-based, Production-Safe)
 * @access  Public
 * @param   {string} childId - Child ID (required)
 * @returns {object} { status: 'ACTIVE' | 'EXPIRED' | 'NONE', expiry: Date | null, childId: string }
 * 
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for subscription state
 * Frontend must NEVER cache this result in localStorage
 */
router.get('/subscription-status', async (req, res) => {
  try {
    const { childId } = req.query;

    if (!childId) {
      console.log('❌ Subscription check failed: No childId provided');
      return res.status(400).json({ 
        error: 'childId query parameter is required',
        status: 'NONE'
      });
    }

    const child = await SpeechChild.findById(childId);
    if (!child) {
      console.log('❌ Subscription check failed: Child not found:', childId);
      return res.status(404).json({ 
        error: 'Child not found',
        status: 'NONE'
      });
    }

    const now = new Date();
    let status = 'NONE';
    
    console.log('🔍 [SUBSCRIPTION CHECK] Checking subscription for child:', child.childName);
    console.log('  📋 Child ID:', childId);
    console.log('  📅 Subscription Expiry:', child.subscriptionExpiry);
    console.log('  🕐 Current Time:', now.toISOString());
    
    if (child.subscriptionExpiry) {
      const expiryDate = new Date(child.subscriptionExpiry);
      console.log('  📅 Expiry Date (parsed):', expiryDate.toISOString());
      console.log('  ⏰ Time until expiry (hours):', ((expiryDate - now) / (1000 * 60 * 60)).toFixed(2));
      
      if (now < expiryDate) {
        status = 'ACTIVE';
        console.log('  ✅ Status: ACTIVE');
      } else {
        status = 'EXPIRED';
        console.log('  ⚠️  Status: EXPIRED');
      }
    } else {
      console.log('  ℹ️  No subscription expiry date found');
      console.log('  ❌ Status: NONE');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 [SUBSCRIPTION RESPONSE] Sending status:', status);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    res.json({
      success: true,
      childId: child._id,
      childName: child.childName,
      status,
      expiry: child.subscriptionExpiry,
      preferredLanguage: child.preferredLanguage
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ 
      error: 'Failed to check subscription status',
      status: 'NONE'
    });
  }
});

/**
 * @route   GET /api/speech-therapy/children/:parentId
 * @desc    Get all children for a parent
 * @access  Public
 */
router.get('/children/:parentId', async (req, res) => {
  try {
    const { parentId } = req.params;
    
    const parent = await SpeechParent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const children = await SpeechChild.find({ parentId });
    res.json(children);
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

/**
 * @route   GET /api/speech-therapy/parent-status/:parentId
 * @desc    Fetch parent and children data for app restart safety
 * @access  Public
 */
router.get('/parent-status/:parentId', async (req, res) => {
  try {
    const { parentId } = req.params;
    const parent = await SpeechParent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const children = await SpeechChild.find({ parentId });
    
    res.json({
      parent,
      children
    });
  } catch (error) {
    console.error('Error fetching parent status:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

/**
 * @route   POST /api/speech-therapy/upload
 * @desc    Upload child's speech recording
 * @access  Public (Requires parentId)
 */
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const { childId, practicePrompt, sampleAudioPath, language, parentId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    if (!childId) {
      return res.status(400).json({ error: 'Child ID is required' });
    }

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required for lightweight authentication' });
    }

    // Verify child exists
    let child = await Patient.findById(childId);
    let speechChild = null;
    
    if (!child) {
      speechChild = await SpeechChild.findById(childId);
      if (!speechChild) {
        return res.status(404).json({ error: 'Child not found' });
      }
    }

    // Recalculate Pro status based on child's subscriptionExpiry
    const now = new Date();
    const subscriptionExpiry = child ? child.subscriptionExpiry : speechChild.subscriptionExpiry;
    const isPro = subscriptionExpiry && now < new Date(subscriptionExpiry);
    const isEnglish = language === 'English' || language === 'en-US' || language === 'en' || language === 'en-IN';

    // Premium Language Check
    if (!isEnglish && !isPro) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ 
        error: 'Premium language support requires an active child subscription',
        proFeature: true,
        message: 'Malayalam and Hindi speech therapy require a Pro plan.'
      });
    }

    // Daily limit check for FREE sessions (only if NOT Pro)
    if (!isPro && isEnglish) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      const query = child ? { childId } : { speechChildId: childId };
      const dailySessions = await SpeechTherapy.countDocuments({
        ...query,
        sessionDate: { $gte: startOfDay }
      });

      if (dailySessions >= 10) { 
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ 
          error: 'Daily limit reached for free English sessions',
          limitReached: true,
          message: 'Unlock Speech Therapy Pro for unlimited practice sessions.'
        });
      }
    }

    // Get session number for this child
    const query = child ? { childId } : { speechChildId: childId };
    const sessionCount = await SpeechTherapy.countDocuments(query);
    
    // Create new speech therapy session
    const sessionData = {
      audioFilePath: req.file.path,
      originalFileName: req.file.originalname,
      practicePrompt: practicePrompt || '',
      sampleAudioPath: sampleAudioPath || '',
      language: language || 'English',
      sessionNumber: sessionCount + 1,
      status: 'pending'
    };

    if (child) {
      sessionData.childId = childId;
    } else {
      sessionData.speechChildId = childId;
    }

    const newSession = new SpeechTherapy(sessionData);

    await newSession.save();

    // Generate AI feedback if child is PRO
    if (isPro) {
      // Mock AI Similarity Score
      const mockScore = Math.floor(Math.random() * 40) + 60; // 60-100
      let aiFeedback = '';
      if (mockScore > 90) aiFeedback = 'Excellent pronunciation! Very close to the sample.';
      else if (mockScore > 75) aiFeedback = 'Good job! Try to focus on the clarity of vowels.';
      else aiFeedback = 'Keep practicing. Listening to the sample again might help.';

      newSession.aiSimilarityScore = mockScore;
      newSession.aiFeedback = aiFeedback;
      await newSession.save();
    }

    res.status(201).json({
      message: 'Speech recording uploaded successfully',
      session: newSession
    });

  } catch (error) {
    console.error('Error uploading speech recording:', error);
    res.status(500).json({ error: 'Failed to upload speech recording' });
  }
});

/**
 * @route   GET /api/speech-therapy/child/:childId
 * @desc    Get all speech therapy sessions for a child
 * @access  Public (Requires parentId)
 */
router.get('/child/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const { parentId } = req.query;

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    // Security check: verify child belongs to that parent
    const parentUser = await User.findOne({ parentId });
    const child = await Patient.findById(childId);
    
    if (!parentUser || !child || child.parent_id.toString() !== parentUser._id.toString()) {
      return res.status(403).json({ error: 'Access denied. This child does not belong to you.' });
    }

    const sessions = await SpeechTherapy.find({ childId })
      .populate('evaluatedBy', 'username email')
      .sort({ sessionDate: -1 });

    res.json(sessions);

  } catch (error) {
    console.error('Error fetching speech therapy sessions:', error);
    res.status(500).json({ error: 'Failed to fetch speech therapy sessions' });
  }
});

/**
 * @route   GET /api/speech-therapy/pending
 * @desc    Get all pending speech therapy sessions for evaluation
 * @access  Authenticated (Teacher/Therapist)
 */
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    // Only teachers and therapists can access
    if (!['teacher', 'therapist'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const pendingSessions = await SpeechTherapy.find({ status: 'pending' })
      .populate('childId', 'name age gender grade')
      .sort({ sessionDate: -1 });

    res.json(pendingSessions);

  } catch (error) {
    console.error('Error fetching pending sessions:', error);
    res.status(500).json({ error: 'Failed to fetch pending sessions' });
  }
});

/**
 * @route   PUT /api/speech-therapy/evaluate/:sessionId
 * @desc    Teacher evaluates a speech therapy session
 * @access  Authenticated (Teacher/Therapist)
 */
router.put('/evaluate/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rating, feedback, notes } = req.body;

    // Only teachers and therapists can evaluate
    if (!['teacher', 'therapist'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!rating || !['Poor', 'Average', 'Good'].includes(rating)) {
      return res.status(400).json({ error: 'Valid rating is required (Poor/Average/Good)' });
    }

    const session = await SpeechTherapy.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.rating = rating;
    session.feedback = feedback || '';
    session.notes = notes || '';
    session.evaluatedBy = req.user.id;
    session.evaluatedAt = new Date();
    session.status = 'evaluated';

    await session.save();

    const updatedSession = await SpeechTherapy.findById(sessionId)
      .populate('childId', 'name age gender')
      .populate('evaluatedBy', 'username email');

    res.json({
      message: 'Session evaluated successfully',
      session: updatedSession
    });

  } catch (error) {
    console.error('Error evaluating session:', error);
    res.status(500).json({ error: 'Failed to evaluate session' });
  }
});

/**
 * @route   GET /api/speech-therapy/progress/:childId
 * @desc    Get progress report for a child
 * @access  Public (Requires parentId)
 */
router.get('/progress/:childId', async (req, res) => {
  try {
    const { childId } = req.params;
    const { parentId } = req.query;

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    // Security check: verify child belongs to that parent
    let isAuthorized = false;

    // Check new models
    const speechChild = await SpeechChild.findById(childId);
    if (speechChild && speechChild.parentId.toString() === parentId) {
      isAuthorized = true;
    } else {
      // Check legacy models
      const parentUser = await User.findOne({ parentId });
      const legacyChild = await Patient.findById(childId);
      if (parentUser && legacyChild && legacyChild.parent_id.toString() === parentUser._id.toString()) {
        isAuthorized = true;
      }
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied. This child does not belong to you.' });
    }

    const sessions = await SpeechTherapy.find({ 
      $or: [{ childId }, { speechChildId: childId }] 
    }).sort({ sessionDate: 1 });

    if (sessions.length === 0) {
      return res.json({
        totalSessions: 0,
        evaluatedSessions: 0,
        averageRating: 0,
        improvement: 'No data yet',
        sessions: []
      });
    }

    // Calculate statistics
    const evaluatedSessions = sessions.filter(s => s.status === 'evaluated');
    const ratingValues = { 'Poor': 1, 'Average': 2, 'Good': 3 };
    
    const ratingsSum = evaluatedSessions.reduce((sum, s) => {
      return sum + (ratingValues[s.rating] || 0);
    }, 0);

    const averageRating = evaluatedSessions.length > 0 
      ? (ratingsSum / evaluatedSessions.length).toFixed(2)
      : 0;

    // Calculate improvement trend (comparing first 3 and last 3 sessions)
    let improvement = 'Insufficient data';
    if (evaluatedSessions.length >= 6) {
      const first3Avg = evaluatedSessions.slice(0, 3).reduce((sum, s) => 
        sum + (ratingValues[s.rating] || 0), 0) / 3;
      const last3Avg = evaluatedSessions.slice(-3).reduce((sum, s) => 
        sum + (ratingValues[s.rating] || 0), 0) / 3;
      
      const diff = last3Avg - first3Avg;
      if (diff > 0.3) improvement = 'Improving';
      else if (diff < -0.3) improvement = 'Needs attention';
      else improvement = 'Stable';
    }

    res.json({
      totalSessions: sessions.length,
      evaluatedSessions: evaluatedSessions.length,
      pendingSessions: sessions.length - evaluatedSessions.length,
      averageRating: parseFloat(averageRating),
      improvement,
      ratingDistribution: {
        poor: evaluatedSessions.filter(s => s.rating === 'Poor').length,
        average: evaluatedSessions.filter(s => s.rating === 'Average').length,
        good: evaluatedSessions.filter(s => s.rating === 'Good').length
      },
      sessions: sessions.map(s => ({
        date: s.sessionDate,
        sessionNumber: s.sessionNumber,
        rating: s.rating,
        feedback: s.feedback,
        practicePrompt: s.practicePrompt
      }))
    });

  } catch (error) {
    console.error('Error fetching progress report:', error);
    res.status(500).json({ error: 'Failed to fetch progress report' });
  }
});

/**
 * @route   GET /api/speech-therapy/audio/:sessionId
 * @desc    Stream audio file for a session
 * @access  Public (Requires parentId)
 */
router.get('/audio/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parentId } = req.query;

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    const session = await SpeechTherapy.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Security check: verify child belongs to that parent
    let isAuthorized = false;
    const targetChildId = session.childId || session.speechChildId;

    const speechChild = await SpeechChild.findById(targetChildId);
    if (speechChild && speechChild.parentId.toString() === parentId) {
      isAuthorized = true;
    } else {
      const parentUser = await User.findOne({ parentId });
      const legacyChild = await Patient.findById(targetChildId);
      if (parentUser && legacyChild && legacyChild.parent_id.toString() === parentUser._id.toString()) {
        isAuthorized = true;
      }
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied. This recording does not belong to your child.' });
    }

    if (!fs.existsSync(session.audioFilePath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    // Stream the audio file
    const stat = fs.statSync(session.audioFilePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(session.audioFilePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/webm',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'audio/webm',
      };
      res.writeHead(200, head);
      fs.createReadStream(session.audioFilePath).pipe(res);
    }

  } catch (error) {
    console.error('Error streaming audio:', error);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

/**
 * @route   DELETE /api/speech-therapy/:sessionId
 * @desc    Delete a speech therapy session
 * @access  Public (Requires parentId)
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { parentId } = req.query;

    if (!parentId) {
      return res.status(400).json({ error: 'Parent ID is required' });
    }

    const session = await SpeechTherapy.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Security check: verify child belongs to that parent
    let isAuthorized = false;
    const targetChildId = session.childId || session.speechChildId;

    const speechChild = await SpeechChild.findById(targetChildId);
    if (speechChild && speechChild.parentId.toString() === parentId) {
      isAuthorized = true;
    } else {
      const parentUser = await User.findOne({ parentId });
      const legacyChild = await Patient.findById(targetChildId);
      if (parentUser && legacyChild && legacyChild.parent_id.toString() === parentUser._id.toString()) {
        isAuthorized = true;
      }
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'Access denied. You do not have permission to delete this session.' });
    }

    // Delete audio file
    if (fs.existsSync(session.audioFilePath)) {
      fs.unlinkSync(session.audioFilePath);
    }

    // Delete session from database
    await SpeechTherapy.findByIdAndDelete(sessionId);

    res.json({ message: 'Session deleted successfully' });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;

