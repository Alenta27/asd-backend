const mongoose = require('mongoose');

const speechChildSchema = new mongoose.Schema({
  childId: { type: String, required: true, unique: true },
  childName: { type: String, required: true },
  age: { type: Number, required: true },
  preferredLanguage: { type: String, default: 'English' },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SpeechParent', required: true },
  subscriptionExpiry: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('SpeechChild', speechChildSchema);
