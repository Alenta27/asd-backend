const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  therapistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },
  reason: { type: String, required: false },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
  notes: { type: String, required: false },
  // Payment tracking fields
  paymentStatus: { type: String, enum: ['pending', 'initiated', 'completed', 'failed'], default: 'pending' },
  razorpayOrderId: { type: String, required: false },
  razorpayPaymentId: { type: String, required: false },
  razorpaySignature: { type: String, required: false },
  appointmentFee: { type: Number, default: 0 }, // Fee in rupees
  paymentDate: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
