const mongoose = require('mongoose');

const teacherSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  notificationEmail: { type: String, required: false },
  notifyOnNewPatient: { type: Boolean, default: true },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  language: { type: String, default: 'en' },
}, { timestamps: true });

module.exports = mongoose.model('TeacherSettings', teacherSettingsSchema);
