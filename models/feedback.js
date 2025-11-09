const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: false },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: false },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
