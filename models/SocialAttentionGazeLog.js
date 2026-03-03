const mongoose = require('mongoose');

const SocialAttentionGazeLogSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialAttentionTest',
    required: true
  },
  timestamp: {
    type: Number,
    required: true
  },
  side: {
    type: String,
    enum: ['left', 'right', 'none'],
    required: true
  },
  gazeX: {
    type: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('SocialAttentionGazeLog', SocialAttentionGazeLogSchema);
