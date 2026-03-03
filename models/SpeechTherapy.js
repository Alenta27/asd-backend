const mongoose = require('mongoose');

/**
 * Speech Therapy Session Schema
 * 
 * Purpose: Store speech practice recordings for children with ASD
 * Focus: Therapeutic support and communication skill improvement
 * NOT for diagnosis - only for practice, feedback, and progress tracking
 */
const speechTherapySchema = new mongoose.Schema({
  // Child Information
  childId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Patient', 
    required: false,
    index: true
  },
  speechChildId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SpeechChild',
    required: false,
    index: true
  },
  
  // Session Details
  sessionDate: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  
  // Audio Recording
  audioFilePath: { 
    type: String, 
    required: true 
  },
  originalFileName: {
    type: String,
    required: false
  },
  
  // Practice Content
  practicePrompt: { 
    type: String, 
    required: false,
    description: "The word or sentence the child was asked to say"
  },
  sampleAudioPath: {
    type: String,
    required: false,
    description: "Path to the sample audio played to the child"
  },
  
  // PRO Features
  language: {
    type: String,
    enum: ['English', 'Malayalam', 'Hindi'],
    default: 'English'
  },
  aiSimilarityScore: {
    type: Number,
    min: 0,
    max: 100,
    required: false,
    description: "AI-calculated similarity score between child's speech and sample"
  },
  aiFeedback: {
    type: String,
    required: false,
    description: "AI-generated automated feedback"
  },
  
  // Therapist Evaluation
  rating: { 
    type: String, 
    enum: ['Poor', 'Average', 'Good', 'Not Rated'],
    default: 'Not Rated'
  },
  feedback: { 
    type: String, 
    default: '',
    description: "Therapist's comments and suggestions"
  },
  evaluatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false,
    description: "Teacher/therapist who provided the evaluation"
  },
  evaluatedAt: {
    type: Date,
    required: false
  },
  
  // Status
  status: {
    type: String,
    enum: ['pending', 'evaluated', 'archived'],
    default: 'pending',
    index: true
  },
  
  // Progress Tracking
  sessionNumber: {
    type: Number,
    required: false,
    description: "Sequential session number for this child"
  },
  
  // Metadata
  duration: {
    type: Number,
    required: false,
    description: "Recording duration in seconds"
  },
  notes: {
    type: String,
    required: false,
    description: "Additional notes or observations"
  }
}, { 
  timestamps: true 
});

// Indexes for efficient queries
speechTherapySchema.index({ childId: 1, sessionDate: -1 });
speechTherapySchema.index({ status: 1 });
speechTherapySchema.index({ evaluatedBy: 1 });

// Virtual for progress calculation
speechTherapySchema.virtual('progressIndicator').get(function() {
  const ratingValues = { 'Poor': 1, 'Average': 2, 'Good': 3, 'Not Rated': 0 };
  return ratingValues[this.rating] || 0;
});

const SpeechTherapy = mongoose.model('SpeechTherapy', speechTherapySchema);

module.exports = SpeechTherapy;
