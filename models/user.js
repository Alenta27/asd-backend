const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true,},
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: false },
    otp:      { type: String, required: false },
    role:     { type: String, required: false },
    parentId:    { type: String, required: false, unique: true, sparse: true },
    therapistId: { type: String, required: false, unique: true, sparse: true },
    teacherId:   { type: String, required: false, unique: true, sparse: true },
    researcherId: { type: String, required: false, unique: true, sparse: true },
    adminId:     { type: String, required: false, unique: true, sparse: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    isActive: { type: Boolean, default: true },
    licenseNumber: { type: String, required: false },
    doctoraldegreeUrl: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },

}, { timestamps: true });

const User = mongoose.model("User", userSchema);

module.exports = User;