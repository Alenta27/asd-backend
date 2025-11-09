const mongoose = require('mongoose');

const educationalContentSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['learn-signs', 'screening', 'conditions', 'interventions'],
      required: true,
    },
    topic: {
      type: String,
      required: true,
      unique: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EducationalContent', educationalContentSchema);