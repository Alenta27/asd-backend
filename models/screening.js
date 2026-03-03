const mongoose = require('mongoose');

const screeningSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childName: { type: String, required: false },
  screeningType: { type: String, enum: ['facial', 'voice', 'mri', 'gaze', 'questionnaire'], required: false },
  result: { type: String, enum: ['low_risk', 'medium_risk', 'high_risk'], required: false },
  gazeMetrics: {
    gazDirection: { type: String, required: false },
    attentionScore: { type: Number, required: false },
    headPitch: { type: Number, required: false },
    headYaw: { type: Number, required: false },
  },
  notes: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Screening', screeningSchema);
