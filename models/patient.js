const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patient_id: { type: String, required: false, sparse: true }, // Make sparse to handle nulls
    patientId: { type: String, required: false }, // Keep for backward compatibility
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    grade: { type: String, required: false },
    medical_history: { type: String, required: false },
    parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    therapist_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High'], required: false },
    screeningType: { type: String, required: false },
    screeningStatus: { type: String, enum: ['pending', 'completed', 'in-progress'], default: 'pending' },
    reportStatus: { type: String, enum: ['pending', 'completed', 'in-review'], default: 'pending' },
    submittedDate: { type: Date, required: false },
}, { timestamps: true });

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;