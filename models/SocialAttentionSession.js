const mongoose = require('mongoose');

const SocialAttentionSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  testType: {
    type: String,
    default: 'SOCIAL_ATTENTION'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED'],
    default: 'ACTIVE'
  },
  leftLookTime: {
    type: Number,
    default: 0
  },
  rightLookTime: {
    type: Number,
    default: 0
  },
  frames: [
    {
      timestamp: Number,
      gaze: {
        type: String,
        enum: ['left', 'right', 'center']
      }
    }
  ],
  totalTime: {
    type: Number,
    default: 0
  },
  leftPercentage: {
    type: Number,
    default: 0
  },
  rightPercentage: {
    type: Number,
    default: 0
  },
  socialAttentionScore: {
    type: Number,
    default: 0
  },
  socialPreferenceScore: {
    type: Number,
    default: 0
  },
  clinicalSummary: {
    type: String
  },
  riskFlag: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('SocialAttentionSession', SocialAttentionSessionSchema);
