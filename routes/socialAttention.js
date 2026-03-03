const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middlewares/auth');
const SocialAttentionSession = require('../models/SocialAttentionSession');
const SocialAttentionFrame = require('../models/SocialAttentionFrame');

// In-memory session store for high-performance gaze logging
const sessions = new Map();

/**
 * @route POST /api/social-attention/start
 * @desc Create session and return video assets
 */
router.post('/start', verifyToken, async (req, res) => {
  try {
    const { studentId, teacherId: bodyTeacherId, dryRun } = req.body;
    const teacherId = bodyTeacherId || req.user.id;
    
    if (!studentId && !dryRun) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    // Determine video URLs - Prefer local assets if they exist in backend/public/videos
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;
    
    const localSocialPath = path.join(__dirname, '../public/videos/social_face.mp4');
    const localPatternPath = path.join(__dirname, '../public/videos/abstract_patterns.mp4');
    
    // Stable, high-quality Pexels fallback URLs
    let leftVideo = "https://videos.pexels.com/video-files/4440954/4440954-sd_640_360_25fps.mp4";
    let rightVideo = "https://videos.pexels.com/video-files/3129957/3129957-sd_640_360_25fps.mp4";

    if (fs.existsSync(localSocialPath) && fs.statSync(localSocialPath).size > 1000) {
      leftVideo = `${baseUrl}/videos/social_face.mp4`;
    }
    if (fs.existsSync(localPatternPath) && fs.statSync(localPatternPath).size > 1000) {
      rightVideo = `${baseUrl}/videos/abstract_patterns.mp4`;
    }

    if (dryRun) {
      return res.status(200).json({ leftVideo, rightVideo });
    }

    const sessionId = crypto.randomUUID();
    
    const sessionData = {
      sessionId,
      studentId,
      teacherId,
      startTime: new Date(),
      leftLookTime: 0,
      rightLookTime: 0,
      status: 'ACTIVE',
      frames: []
    };

    // Store in-memory
    sessions.set(sessionId, sessionData);

    // Persist to DB
    const newSession = new SocialAttentionSession({
      sessionId,
      studentId,
      teacherId,
      startTime: sessionData.startTime,
      status: 'ACTIVE'
    });
    await newSession.save();
    
    // Return session ID and stimulus URLs
    res.status(200).json({ 
      sessionId,
      leftVideo,
      rightVideo
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Assessment service unavailable' });
  }
});

/**
 * @route POST /api/social-attention/frame
 * @desc Store gaze frame and accumulate look times
 */
router.post('/frame', verifyToken, async (req, res) => {
  try {
    const { sessionId, gaze, timestamp } = req.body;
    
    if (!sessionId || !gaze) {
      return res.status(400).json({ error: 'sessionId and gaze are required' });
    }

    const session = sessions.get(sessionId);
    if (!session || session.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Active session not found' });
    }

    // Accumulate times (each frame is ~300ms per frontend logging interval)
    if (gaze === 'left') {
      session.leftLookTime += 300;
    } else if (gaze === 'right') {
      session.rightLookTime += 300;
    }

    // Store frame in-memory for analytics
    session.frames.push({
      gaze,
      timestamp: timestamp || Date.now()
    });

    // Fire-and-forget DB update for individual frames
    SocialAttentionFrame.create({
      sessionId,
      gazeDirection: gaze,
      timestamp: timestamp || Date.now()
    }).catch(() => {});

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Frame logging error:', error);
    res.status(500).json({ error: 'Failed to store gaze frame' });
  }
});

/**
 * @route POST /api/social-attention/finish
 * @desc Compute results and end session
 */
router.post('/finish', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const totalValidTime = session.leftLookTime + session.rightLookTime;
    const socialPreferenceScore = totalValidTime > 0 
      ? Number(((session.leftLookTime / totalValidTime) * 100).toFixed(1))
      : 0;

    const leftPercentage = totalValidTime > 0 
      ? Number(((session.leftLookTime / totalValidTime) * 100).toFixed(1))
      : 0;
    
    const rightPercentage = totalValidTime > 0 
      ? Number(((session.rightLookTime / totalValidTime) * 100).toFixed(1))
      : 0;

    // Clinical Interpretation
    let clinicalSummary = "";
    let riskFlag = false;
    if (socialPreferenceScore < 40) {
      clinicalSummary = "Significant preference for non-social stimuli detected. This pattern is often observed in children with social-communication challenges.";
      riskFlag = true;
    } else if (socialPreferenceScore < 50) {
      clinicalSummary = "Reduced social preference noted. Visual attention is split between social and non-social stimuli.";
      riskFlag = true;
    } else {
      clinicalSummary = "Typical social preference pattern. The child showed sustained interest in the social stimulus.";
      riskFlag = false;
    }

    session.status = 'COMPLETED';
    session.endTime = new Date();

    // Persist final results
    await SocialAttentionSession.findOneAndUpdate(
      { sessionId },
      { 
        status: 'COMPLETED', 
        endTime: session.endTime,
        leftLookTime: session.leftLookTime,
        rightLookTime: session.rightLookTime,
        socialPreferenceScore, 
        socialAttentionScore: socialPreferenceScore, // Map to both fields for compatibility
        leftPercentage,
        rightPercentage,
        clinicalSummary,
        frames: session.frames,
        riskFlag
      }
    );

    res.status(200).json({
      sessionId: session.sessionId,
      leftLookTime: session.leftLookTime,
      rightLookTime: session.rightLookTime,
      leftTime: session.leftLookTime, // Compatibility with SocialAttentionResults.jsx
      rightTime: session.rightLookTime, // Compatibility with SocialAttentionResults.jsx
      leftPercentage,
      rightPercentage,
      socialPreferenceScore,
      socialAttentionScore: socialPreferenceScore,
      riskFlag,
      clinicalSummary,
      logs: session.frames.map(f => ({ side: f.gaze, timestamp: f.timestamp })) // Compatibility with timeline
    });

    // Cleanup memory after a bit
    setTimeout(() => sessions.delete(sessionId), 300000);
  } catch (error) {
    console.error('Error finishing session:', error);
    res.status(500).json({ error: 'Failed to finalize assessment' });
  }
});

/**
 * @route GET /api/social-attention/:sessionId/result
 * @desc Returns session metrics
 */
router.get('/:sessionId/result', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await SocialAttentionSession.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const responseData = {
      ...session.toObject(),
      leftTime: session.leftLookTime,
      rightTime: session.rightLookTime,
      socialAttentionScore: session.socialPreferenceScore, // Compatibility
      logs: session.frames.map(f => ({ side: f.gaze, timestamp: f.timestamp }))
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Error fetching result:', error);
    res.status(500).json({ error: 'Failed to fetch assessment result' });
  }
});

// Legacy support for 'end' endpoint
router.post('/end', verifyToken, async (req, res) => {
    // Redirect to finish
    req.url = '/finish';
    return router.handle(req, res);
});

/**
 * @route POST /api/social-attention/therapist/save
 * @desc Store direct scoring result from therapist dashboard
 */
router.post('/therapist/save', verifyToken, async (req, res) => {
  try {
    const { 
      patientId, 
      socialPreferenceScore, 
      socialTime, 
      nonSocialTime, 
      totalTime, 
      confidence,
      timestamp 
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    const sessionId = `direct-${crypto.randomUUID()}`;

    // Map to the common session model
    const newSession = new SocialAttentionSession({
      sessionId,
      studentId: patientId,
      teacherId: req.user.id,
      startTime: timestamp || new Date(),
      endTime: new Date(),
      status: 'COMPLETED',
      leftLookTime: socialTime * 1000, // store in ms
      rightLookTime: nonSocialTime * 1000,
      socialPreferenceScore,
      socialAttentionScore: socialPreferenceScore,
      confidenceScore: confidence,
      totalTrackedTime: totalTime,
      source: 'therapist_direct_score'
    });

    await newSession.save();
    res.status(200).json({ success: true, sessionId });
  } catch (error) {
    console.error('Error saving direct score:', error);
    res.status(500).json({ error: 'Failed to save assessment results' });
  }
});

module.exports = router;
