const mongoose = require('mongoose');

const SocialAttentionFrameSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  gazeDirection: {
    type: String,
    enum: ['left', 'right', 'center'],
    required: true
  },
  timestamp: {
    type: Number,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('SocialAttentionFrame', SocialAttentionFrameSchema);
