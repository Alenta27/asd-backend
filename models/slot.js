const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  therapistId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  date: { 
    type: Date, 
    required: true 
  },
  startTime: { 
    type: String, 
    required: true 
  },
  endTime: { 
    type: String, 
    required: true 
  },
  intervalMinutes: { 
    type: Number, 
    required: true,
    default: 30 
  },
  breakTimeMinutes: { 
    type: Number, 
    required: true,
    default: 5 
  },
  mode: { 
    type: String, 
    enum: ['In-person', 'Online', 'Phone'],
    required: true,
    default: 'In-person'
  },
  hospitalClinicName: { 
    type: String, 
    required: function() {
      return this.mode === 'In-person';
    }
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Index for efficient queries
slotSchema.index({ therapistId: 1, date: 1 });
slotSchema.index({ date: 1, isActive: 1 });

module.exports = mongoose.model('Slot', slotSchema);
