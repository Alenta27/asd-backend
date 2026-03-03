const mongoose = require('mongoose');

const speechParentSchema = new mongoose.Schema({
  parentName: { type: String, required: true },
  parentEmail: { type: String, required: true, unique: true },
  phone: { type: String, required: false },
  isSpeechOnly: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('SpeechParent', speechParentSchema);
