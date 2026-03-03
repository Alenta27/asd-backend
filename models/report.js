const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  title: { type: String, required: true },
  author: { type: String },
  date: { type: Date, default: Date.now },
  period: { type: String },
  summary: { type: String },
  strengths: { type: String },
  recommendations: { type: String },
  status: { type: String, enum: ['draft', 'final'], default: 'final' },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
