const mongoose = require('mongoose');

const SocialAttentionTestSchema = new mongoose.Schema({
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
  socialScore: {
    type: Number,
    default: 0
  },
  leftTime: {
    type: Number,
    default: 0
  },
  rightTime: {
    type: Number,
    default: 0
  },
  clinicalInterpretation: {
    type: String
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed'],
    default: 'in-progress'
  }
}, { timestamps: true });

module.exports = mongoose.model('SocialAttentionTest', SocialAttentionTestSchema);
