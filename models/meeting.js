const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  title: { type: String, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: false },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
