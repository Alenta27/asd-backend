const mongoose = require('mongoose');

const dreamFeaturesSchema = new mongoose.Schema({
  participantId: {
    type: String,
    required: true,
    index: true
  },
  sessionDate: String,
  averageJointVelocity: Number,
  totalDisplacementRatio: Number,
  headGazeVariance: Number,
  eyeGazeConsistency: Number,
  adosCommunicationScore: Number,
  adosTotalScore: {
    type: Number,
    required: true,
    index: true
  },
  ageMonths: Number,
  therapyCondition: String,
  filePath: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  batchId: String,
  processedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('DREAMFeatures', dreamFeaturesSchema);
