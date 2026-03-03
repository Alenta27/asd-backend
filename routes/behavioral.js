const express = require('express');
const router = express.Router();
const { verifyToken, teacherCheck } = require('../middlewares/auth');
const BehavioralAssessment = require('../models/BehavioralAssessment');
const Patient = require('../models/patient');

// All routes require teacher authentication
router.use(verifyToken);

// Submit assessment results
router.post('/submit', async (req, res) => {
  try {
    const { 
      studentId, 
      sessionId,
      game,
      assessmentType, 
      score, 
      metrics, 
      indicators, 
      rawGameData,
      // Eye-Gaze Tracker specific fields
      eyeContactTime,
      objectFocusTime,
      eyeContactRatio,
      objectFocusRatio,
      gazeShiftCount,
      sessionDuration,
      // Imitation game specific fields
      totalActions,
      correctImitations,
      imitationAccuracy,
      averageReactionTime,
      meanSimilarityScore
    } = req.body;
    const teacherId = req.user.id;

    const assessment = new BehavioralAssessment({
      studentId,
      teacherId,
      sessionId,
      game,
      assessmentType,
      score,
      eyeContactTime,
      objectFocusTime,
      eyeContactRatio,
      objectFocusRatio,
      gazeShiftCount,
      sessionDuration,
      totalActions,
      correctImitations,
      imitationAccuracy,
      averageReactionTime,
      meanSimilarityScore,
      metrics,
      indicators,
      rawGameData
    });

    await assessment.save();
    res.status(201).json(assessment);
  } catch (error) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assessments for a specific student
router.get('/student/:studentId', async (req, res) => {
  try {
    const assessments = await BehavioralAssessment.find({ 
      studentId: req.params.studentId 
    }).sort({ completedAt: -1 });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assessments for a specific tool type
router.get('/tool/:toolId', async (req, res) => {
  try {
    const assessments = await BehavioralAssessment.find({ 
      assessmentType: req.params.toolId,
      teacherId: req.user.id
    })
    .populate('studentId', 'name')
    .sort({ completedAt: -1 });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific session detail
router.get('/session/:sessionId', async (req, res) => {
  try {
    const assessment = await BehavioralAssessment.findById(req.params.sessionId)
      .populate('studentId', 'name age grade');
    if (!assessment) {
      return res.status(404).json({ message: 'Session not found' });
    }
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get aggregated stats for the teacher
router.get('/stats', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const assessments = await BehavioralAssessment.find({ teacherId });

    const totalSessions = assessments.length;
    const activeStudents = new Set(assessments.map(a => a.studentId.toString())).size;
    
    // Calculate average engagement (score as a proxy for engagement across all games)
    const avgScore = assessments.length > 0
      ? assessments.reduce((acc, curr) => acc + curr.score, 0) / assessments.length
      : 0;

    // Calculate monthly trend (simplified)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const recentSessions = assessments.filter(a => a.completedAt >= oneMonthAgo).length;
    const oldSessions = totalSessions - recentSessions;
    const trend = oldSessions > 0 ? ((recentSessions - oldSessions) / oldSessions) * 100 : 0;

    res.json({
      totalSessions,
      activeStudents,
      avgEngagement: Math.round(avgScore),
      trend: Math.round(trend)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Analyze behavioral data and generate comprehensive ASD risk report
router.get('/analyze/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const teacherId = req.user.id;

    // Get all assessments for this student
    const assessments = await BehavioralAssessment.find({ 
      studentId,
      teacherId 
    }).sort({ completedAt: -1 });

    // Fetch latest Social Attention Session
    const SocialAttentionSession = require('../models/SocialAttentionSession');
    const latestSocialAttention = await SocialAttentionSession.findOne({
      studentId,
      teacherId,
      status: 'COMPLETED'
    }).sort({ endTime: -1 });

    if (assessments.length === 0 && !latestSocialAttention) {
      return res.status(404).json({ 
        message: 'No assessments found for this student. Please complete at least one assessment game.' 
      });
    }

    // Group assessments by type and get latest
    const gameData = {};
    const gameTypes = [
      'emotion-match',
      'eye-gaze-tracker',
      'social-attention',
      'imitation',
      'sound-sensitivity',
      'pattern-fixation',
      'story-understanding',
      'turn-taking'
    ];

    gameTypes.forEach(type => {
      if (type === 'social-attention' && latestSocialAttention) {
        gameData[type] = {
          assessmentType: 'social-attention',
          score: latestSocialAttention.socialPreferenceScore,
          metrics: {
            socialPreferenceScore: latestSocialAttention.socialPreferenceScore,
            leftPercentage: latestSocialAttention.leftPercentage,
            rightPercentage: latestSocialAttention.rightPercentage,
            leftLookTime: latestSocialAttention.leftLookTime,
            rightLookTime: latestSocialAttention.rightLookTime
          },
          completedAt: latestSocialAttention.endTime
        };
      } else {
        const gameAssessments = assessments.filter(a => a.assessmentType === type);
        if (gameAssessments.length > 0) {
          gameData[type] = gameAssessments[0]; // Use latest assessment
        }
      }
    });

    // Normalize and extract metrics
    const normalizedMetrics = normalizeGameMetrics(gameData);

    // Detect behavioral patterns
    const behavioralProfile = detectBehavioralPatterns(normalizedMetrics, gameData);

    // Calculate risk level and probability
    const riskAnalysis = calculateRiskLevel(normalizedMetrics, behavioralProfile);

    // Generate game-wise analysis
    const gameAnalysis = generateGameWiseAnalysis(gameData, normalizedMetrics);

    // Get progress tracking (compare with previous sessions)
    const progressTracking = generateProgressTracking(assessments, gameData);

    // Generate recommendations
    const recommendations = generateRecommendations(riskAnalysis, behavioralProfile);

    // Compile comprehensive report
    const report = {
      studentId,
      generatedAt: new Date(),
      riskSummary: {
        overallRiskLevel: riskAnalysis.riskLevel,
        probabilityScore: riskAnalysis.probabilityScore,
        probabilityBreakdown: riskAnalysis.probabilityBreakdown
      },
      behavioralProfile,
      gameWiseAnalysis: gameAnalysis,
      progressTracking,
      recommendations,
      disclaimer: "This behavioral analysis system supports early screening and assessment based on game-based behavioral data. It does not replace professional medical diagnosis. All conclusions are based on structured game performance metrics and should be interpreted by qualified professionals in conjunction with clinical evaluation."
    };

    res.json(report);
  } catch (error) {
    console.error('Error generating analysis:', error);
    res.status(500).json({ message: 'Server error while generating analysis' });
  }
});

// Helper function to normalize game metrics to 0-100 scale
function normalizeGameMetrics(gameData) {
  const normalized = {
    accuracy: 0,
    responseTime: 0,
    eyeContactDuration: 0,
    fixationRatio: 0,
    imitationSuccess: 0,
    sensoryReactionLevel: 0,
    repetitiveSelectionFrequency: 0,
    socialUnderstandingScore: 0,
    turnTakingBehavior: 0
  };

  // Emotion Match: accuracy and response time
  if (gameData['emotion-match']) {
    const metrics = gameData['emotion-match'].metrics || {};
    normalized.accuracy = metrics.accuracy || 0;
    normalized.responseTime = metrics.responseTime ? Math.max(0, 100 - (metrics.responseTime * 10)) : 0;
  }

  // Eye-Gaze Tracker: eye contact and fixation
  if (gameData['eye-gaze-tracker']) {
    const metrics = gameData['eye-gaze-tracker'].metrics || {};
    const totalTime = (metrics.eyeContactTime || 0) + (metrics.objectFixationTime || 0);
    if (totalTime > 0) {
      normalized.eyeContactDuration = ((metrics.eyeContactTime || 0) / totalTime) * 100;
      normalized.fixationRatio = ((metrics.objectFixationTime || 0) / totalTime) * 100;
    }
  }

  // Social Attention: social understanding
  if (gameData['social-attention']) {
    const metrics = gameData['social-attention'].metrics || {};
    normalized.socialUnderstandingScore = metrics.socialPreferenceScore || 0;
    // Social attention specifically also informs eye contact duration if eye-gaze tracker is missing
    if (normalized.eyeContactDuration === 0) {
      normalized.eyeContactDuration = metrics.socialPreferenceScore || 0;
    }
  }

  // Imitation: imitation success
  if (gameData['imitation']) {
    const metrics = gameData['imitation'].metrics || {};
    normalized.imitationSuccess = metrics.imitationScore || gameData['imitation'].score || 0;
  }

  // Sound Sensitivity: sensory reaction
  if (gameData['sound-sensitivity']) {
    const metrics = gameData['sound-sensitivity'].metrics || {};
    // Convert reaction score (0-2) to 0-100 scale for normalization
    normalized.sensoryReactionLevel = metrics.avgReactionScore !== undefined ? 
      (metrics.avgReactionScore * 50) : 
      (metrics.sensoryResponseTime || 0);
  }

  // Pattern Fixation: repetitive behavior
  if (gameData['pattern-fixation']) {
    const metrics = gameData['pattern-fixation'].metrics || {};
    const repetitiveCount = metrics.repetitiveSelectionCount || 0;
    normalized.repetitiveSelectionFrequency = Math.min(100, repetitiveCount * 10);
  }

  // Story Understanding: social understanding (additional)
  if (gameData['story-understanding']) {
    const metrics = gameData['story-understanding'].metrics || {};
    const storyScore = gameData['story-understanding'].score || 0;
    if (normalized.socialUnderstandingScore === 0) {
      normalized.socialUnderstandingScore = storyScore;
    } else {
      normalized.socialUnderstandingScore = (normalized.socialUnderstandingScore + storyScore) / 2;
    }
  }

  // Turn-Taking: reciprocity
  if (gameData['turn-taking']) {
    const metrics = gameData['turn-taking'].metrics || {};
    normalized.turnTakingBehavior = metrics.waitingBehaviorScore || metrics.turnTakingAccuracy || gameData['turn-taking'].score || 0;
  }

  return normalized;
}

// Detect behavioral patterns associated with ASD traits
function detectBehavioralPatterns(normalizedMetrics, gameData) {
  const profile = {
    socialAttention: {
      score: normalizedMetrics.eyeContactDuration,
      level: normalizedMetrics.eyeContactDuration > 60 ? 'Strong' : normalizedMetrics.eyeContactDuration > 40 ? 'Medium' : 'Limited',
      traits: []
    },
    emotionalRecognition: {
      score: normalizedMetrics.accuracy,
      level: normalizedMetrics.accuracy > 80 ? 'Strong' : normalizedMetrics.accuracy > 50 ? 'Medium' : 'Challenging',
      traits: []
    },
    sensoryProcessing: {
      score: 100 - normalizedMetrics.sensoryReactionLevel, // Inverse: lower reaction = better processing
      level: normalizedMetrics.sensoryReactionLevel < 30 ? 'Typical' : normalizedMetrics.sensoryReactionLevel < 60 ? 'Medium Sensitivity' : 'High Sensitivity',
      traits: []
    },
    imitationAbility: {
      score: normalizedMetrics.imitationSuccess,
      level: normalizedMetrics.imitationSuccess > 70 ? 'Strong' : normalizedMetrics.imitationSuccess > 40 ? 'Medium' : 'Needs Support',
      traits: []
    },
    repetitiveBehavior: {
      score: normalizedMetrics.repetitiveSelectionFrequency,
      level: normalizedMetrics.repetitiveSelectionFrequency < 30 ? 'Minimal' : normalizedMetrics.repetitiveSelectionFrequency < 60 ? 'Medium' : 'Elevated',
      traits: []
    },
    socialReciprocity: {
      score: normalizedMetrics.turnTakingBehavior,
      level: normalizedMetrics.turnTakingBehavior > 70 ? 'Strong' : normalizedMetrics.turnTakingBehavior > 40 ? 'Medium' : 'Limited',
      traits: []
    }
  };

  // Add trait indicators
  if (normalizedMetrics.eyeContactDuration < 40) {
    profile.socialAttention.traits.push('Reduced eye contact observed');
  }
  if (normalizedMetrics.accuracy < 50) {
    profile.emotionalRecognition.traits.push('Difficulty recognizing emotions');
  }
  if (normalizedMetrics.sensoryReactionLevel > 60) {
    profile.sensoryProcessing.traits.push('Elevated sensory sensitivity');
  }
  if (normalizedMetrics.imitationSuccess < 40) {
    profile.imitationAbility.traits.push('Limited imitation skills');
  }
  if (normalizedMetrics.repetitiveSelectionFrequency > 60) {
    profile.repetitiveBehavior.traits.push('Repetitive patterns observed');
  }
  if (normalizedMetrics.turnTakingBehavior < 40) {
    profile.socialReciprocity.traits.push('Challenges with turn-taking');
  }

  return profile;
}

// Calculate overall risk level and probability
function calculateRiskLevel(normalizedMetrics, behavioralProfile) {
  let riskScore = 0;
  const factors = [];

  // Social attention factor (reduced eye contact increases risk)
  if (normalizedMetrics.eyeContactDuration < 40) {
    riskScore += 20;
    factors.push('Reduced social attention');
  }

  // Emotional recognition factor
  if (normalizedMetrics.accuracy < 50) {
    riskScore += 15;
    factors.push('Emotional recognition challenges');
  }

  // Sensory processing factor
  if (normalizedMetrics.sensoryReactionLevel > 60) {
    riskScore += 15;
    factors.push('Sensory hypersensitivity');
  }

  // Imitation factor
  if (normalizedMetrics.imitationSuccess < 40) {
    riskScore += 15;
    factors.push('Limited imitation ability');
  }

  // Repetitive behavior factor
  if (normalizedMetrics.repetitiveSelectionFrequency > 60) {
    riskScore += 20;
    factors.push('Repetitive behavior patterns');
  }

  // Social reciprocity factor
  if (normalizedMetrics.turnTakingBehavior < 40) {
    riskScore += 15;
    factors.push('Social reciprocity challenges');
  }

  // Normalize risk score to 0-100%
  const probabilityScore = Math.min(100, Math.max(0, riskScore));

  // Determine risk level
  let riskLevel = 'Low';
  if (probabilityScore >= 70) {
    riskLevel = 'High';
  } else if (probabilityScore >= 40) {
    riskLevel = 'Medium';
  }

  // Calculate probability breakdown
  const highProb = riskLevel === 'High' ? probabilityScore : (probabilityScore > 50 ? probabilityScore - 20 : probabilityScore / 3);
  const mediumProb = riskLevel === 'Medium' ? probabilityScore : (probabilityScore >= 40 ? probabilityScore - 10 : probabilityScore / 2);
  const lowProb = 100 - highProb - mediumProb;

  return {
    riskLevel,
    probabilityScore: Math.round(probabilityScore),
    probabilityBreakdown: {
      Low: Math.round(Math.max(0, lowProb)),
      Medium: Math.round(Math.max(0, mediumProb)),
      High: Math.round(Math.max(0, highProb))
    },
    contributingFactors: factors
  };
}

// Generate game-wise analysis
function generateGameWiseAnalysis(gameData, normalizedMetrics) {
  const analysis = [];

  const gameDescriptions = {
    'emotion-match': 'Assesses emotional recognition through facial expression matching',
    'eye-gaze-tracker': 'Monitors visual attention and eye contact patterns',
    'social-attention': 'Measures responsiveness to social versus non-social stimuli',
    'imitation': 'Evaluates motor and social imitation capabilities',
    'sound-sensitivity': 'Tests auditory processing and sensory responses',
    'pattern-fixation': 'Analyzes repetitive visual interests and fixation behaviors',
    'story-understanding': 'Assesses narrative comprehension and theory of mind',
    'turn-taking': 'Measures reciprocal interaction and social timing'
  };

  Object.keys(gameDescriptions).forEach(gameType => {
    const assessment = gameData[gameType];
    if (assessment) {
      const score = assessment.score || 0;
      let interpretation = '';
      
      if (gameType === 'emotion-match') {
        interpretation = score > 80 ? 'Strong emotional recognition abilities' : score > 50 ? 'Medium emotional recognition' : 'Challenges with emotional recognition';
      } else if (gameType === 'eye-gaze-tracker') {
        interpretation = normalizedMetrics.eyeContactDuration > 60 ? 'Good eye contact and attention patterns' : normalizedMetrics.eyeContactDuration > 40 ? 'Variable attention patterns' : 'Limited eye contact observed';
      } else if (gameType === 'social-attention') {
        interpretation = normalizedMetrics.socialUnderstandingScore > 70 ? 'Strong preference for social stimuli' : normalizedMetrics.socialUnderstandingScore > 40 ? 'Balanced attention between social and non-social' : 'Greater interest in non-social objects';
      } else if (gameType === 'imitation') {
        interpretation = normalizedMetrics.imitationSuccess > 70 ? 'Strong imitation skills demonstrated' : normalizedMetrics.imitationSuccess > 40 ? 'Developing imitation abilities' : 'Limited imitation observed';
      } else if (gameType === 'sound-sensitivity') {
        interpretation = normalizedMetrics.sensoryReactionLevel < 30 ? 'Typical sensory responses' : normalizedMetrics.sensoryReactionLevel < 60 ? 'Medium sensory sensitivity' : 'Elevated sensitivity to auditory stimuli';
      } else if (gameType === 'pattern-fixation') {
        interpretation = normalizedMetrics.repetitiveSelectionFrequency < 30 ? 'Flexible attention without excessive repetition' : normalizedMetrics.repetitiveSelectionFrequency < 60 ? 'Some repetitive patterns noted' : 'Elevated repetitive visual interests';
      } else if (gameType === 'story-understanding') {
        interpretation = score > 70 ? 'Good narrative comprehension' : score > 50 ? 'Developing understanding' : 'Challenges with story comprehension';
      } else if (gameType === 'turn-taking') {
        interpretation = normalizedMetrics.turnTakingBehavior > 70 ? 'Strong turn-taking and reciprocity' : normalizedMetrics.turnTakingBehavior > 40 ? 'Developing social reciprocity' : 'Challenges with turn-taking behaviors';
      }

      analysis.push({
        gameType,
        gameName: gameType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: gameDescriptions[gameType],
        score,
        interpretation
      });
    } else {
      analysis.push({
        gameType,
        gameName: gameType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        description: gameDescriptions[gameType],
        score: null,
        interpretation: 'Not yet completed'
      });
    }
  });

  return analysis;
}

// Generate progress tracking (compare current with previous sessions)
function generateProgressTracking(assessments, gameData) {
  const progress = {
    totalSessions: assessments.length,
    sessionsCompleted: Object.keys(gameData).length,
    gamesCompleted: Object.keys(gameData).length,
    hasHistoricalData: assessments.length > Object.keys(gameData).length,
    trends: []
  };

  // Group by assessment type and compare latest vs previous
  const gameTypes = ['emotion-match', 'eye-gaze-tracker', 'social-attention', 'imitation', 'sound-sensitivity', 'pattern-fixation', 'story-understanding', 'turn-taking'];
  
  gameTypes.forEach(type => {
    const typeAssessments = assessments.filter(a => a.assessmentType === type).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    if (typeAssessments.length > 1) {
      const latest = typeAssessments[0].score || 0;
      const previous = typeAssessments[1].score || 0;
      const change = latest - previous;
      const trend = change > 5 ? 'Improving' : change < -5 ? 'Declining' : 'Stable';
      
      progress.trends.push({
        gameType: type,
        gameName: type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        latestScore: latest,
        previousScore: previous,
        change: Math.round(change),
        trend
      });
    }
  });

  return progress;
}

// Generate recommendations based on risk level and profile
function generateRecommendations(riskAnalysis, behavioralProfile) {
  const recommendations = [];

  if (riskAnalysis.riskLevel === 'High') {
    recommendations.push({
      priority: 'High',
      category: 'Professional Referral',
      recommendation: 'Consider referral to a developmental pediatrician or autism specialist for comprehensive evaluation. Early intervention is recommended.',
      actionItems: [
        'Schedule consultation with developmental specialist',
        'Gather comprehensive developmental history',
        'Share behavioral assessment data with healthcare provider'
      ]
    });
  } else if (riskAnalysis.riskLevel === 'Medium') {
    recommendations.push({
      priority: 'Medium',
      category: 'Continued Monitoring',
      recommendation: 'Continue regular behavioral assessments and monitor progress. Consider consultation with specialists if concerns persist.',
      actionItems: [
        'Continue game-based assessments monthly',
        'Document behavioral observations',
        'Consider developmental screening tools'
      ]
    });
  }

  // Category-specific recommendations
  if (behavioralProfile.socialAttention.score < 40) {
    recommendations.push({
      priority: 'Medium',
      category: 'Social Attention Support',
      recommendation: 'Implement strategies to support social attention and eye contact development.',
      actionItems: [
        'Use visual supports and social stories',
        'Practice eye contact in natural contexts',
        'Reinforce positive social interactions'
      ]
    });
  }

  if (behavioralProfile.emotionalRecognition.score < 50) {
    recommendations.push({
      priority: 'Medium',
      category: 'Emotional Recognition',
      recommendation: 'Support emotional recognition through structured activities and visual aids.',
      actionItems: [
        'Use emotion cards and visual emotion charts',
        'Practice identifying emotions in stories and videos',
        'Model emotional expression and recognition'
      ]
    });
  }

  if (behavioralProfile.sensoryProcessing.score < 40) {
    recommendations.push({
      priority: 'Medium',
      category: 'Sensory Support',
      recommendation: 'Provide sensory accommodations and supports based on individual needs.',
      actionItems: [
        'Identify specific sensory triggers',
        'Create sensory-friendly environment',
        'Provide sensory breaks and tools as needed'
      ]
    });
  }

  if (behavioralProfile.imitationAbility.score < 40) {
    recommendations.push({
      priority: 'Medium',
      category: 'Imitation Development',
      recommendation: 'Support imitation skills through modeling and structured practice.',
      actionItems: [
        'Model actions and encourage imitation',
        'Break down actions into simple steps',
        'Use visual and physical prompts as needed'
      ]
    });
  }

  if (behavioralProfile.repetitiveBehavior.score > 60) {
    recommendations.push({
      priority: 'Medium',
      category: 'Flexible Thinking',
      recommendation: 'Support flexible thinking and reduce repetitive patterns through structured activities.',
      actionItems: [
        'Introduce variety in activities and routines',
        'Use visual schedules to support transitions',
        'Gradually expand interests and activities'
      ]
    });
  }

  if (behavioralProfile.socialReciprocity.score < 40) {
    recommendations.push({
      priority: 'Medium',
      category: 'Social Reciprocity',
      recommendation: 'Support turn-taking and reciprocal interaction skills.',
      actionItems: [
        'Practice turn-taking in structured games',
        'Use visual cues for turn-taking',
        'Reinforce appropriate waiting and sharing behaviors'
      ]
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'Low',
      category: 'Continued Support',
      recommendation: 'Continue current supports and regular monitoring. Behavioral profile indicates typical development patterns.',
      actionItems: [
        'Maintain regular assessment schedule',
        'Continue positive reinforcement strategies',
        'Monitor for any changes in behavioral patterns'
      ]
    });
  }

  return recommendations;
}

module.exports = router;
