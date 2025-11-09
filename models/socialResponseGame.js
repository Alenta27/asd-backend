const mongoose = require('mongoose');

const socialResponseGameSchema = new mongoose.Schema({
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
  gameResults: [
    {
      scenarioId: Number,
      scenarioType: String,
      question: String,
      userAnswer: String,
      correctAnswer: String,
      isCorrect: Boolean,
      reactionTime: Number,
      timestamp: String
    }
  ],
  totalTime: Number,
  accuracy: Number,
  avgReactionTime: Number,
  missedResponses: Number,
  modelPrediction: {
    prediction: String,
    confidence: Number,
    severity: String
  },
  knnResults: [
    {
      caseId: mongoose.Schema.Types.ObjectId,
      similarity: Number,
      distance: Number
    }
  ],
  completedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SocialResponseGame', socialResponseGameSchema);
