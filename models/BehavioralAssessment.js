const mongoose = require('mongoose');

const BehavioralAssessmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assessmentType: {
    type: String,
    required: true,
    enum: [
      'emotion-match',
      'eye-gaze-tracker',
      'social-attention',
      'imitation',
      'sound-sensitivity',
      'pattern-fixation',
      'story-understanding',
      'turn-taking'
    ]
  },
  score: {
    type: Number,
    required: true
  },
  sessionId: {
    type: String
  },
  game: {
    type: String
  },
  eyeContactTime: Number,
  objectFocusTime: Number,
  eyeContactRatio: Number,
  objectFocusRatio: Number,
  gazeShiftCount: Number,
  sessionDuration: Number,
  // Imitation game fields
  totalActions: Number,
  correctImitations: Number,
  imitationAccuracy: Number,
  averageReactionTime: Number,
  meanSimilarityScore: Number,
  metrics: {
    accuracy: Number,
    responseTime: Number,
    eyeContactTime: Number,
    objectFixationTime: Number,
    objectFocusTime: Number,
    humanVideoViewTime: Number,
    objectAnimationViewTime: Number,
    imitationScore: Number,
    sensoryResponseTime: Number,
    gazeShiftCount: Number,
    repetitiveSelectionCount: Number,
    fixationDuration: Number,
    socialResponseCorrectness: Number,
    waitingBehaviorScore: Number,
    interruptionCount: Number,
    eyeContactTimeMs: Number,
    objectFocusTimeMs: Number,
    totalFrames: Number,
    // Sound Sensitivity metrics
    avgReactionScore: Number,
    highSensitivityCount: Number,
    moderateSensitivityCount: Number,
    reactionCount: Number,
    overallLevel: String,
    // Imitation game metrics
    totalActions: Number,
    correctImitations: Number,
    imitationAccuracy: Number,
    averageReactionTime: Number,
    meanSimilarityScore: Number
  },
  indicators: [
    {
      label: String,
      status: String,
      color: String
    }
  ],
  rawGameData: {
    type: mongoose.Schema.Types.Mixed
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('BehavioralAssessment', BehavioralAssessmentSchema);
