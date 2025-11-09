const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const generateOTP = require('../utils/otp');
const sendEmail = require('../utils/email');
const { verifyToken } = require('../middlewares/auth');
const { generateUniqueId } = require('../utils/idGenerator');

const User = require("../models/user");
const Patient = require("../models/patient");
const Feedback = require("../models/feedback");
const TeacherSettings = require("../models/teacherSettings");
const Meeting = require("../models/meeting");
const Report = require("../models/report");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "3074679378-fbmg47osjqajq7u4cv0qja7svo00pv3m.apps.googleusercontent.com");

const credentialsDir = path.join(__dirname, '../credentials');
if (!fs.existsSync(credentialsDir)) {
  fs.mkdirSync(credentialsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, credentialsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  const isValid = file.originalname.toLowerCase().endsWith('.pdf') ||
                  file.originalname.toLowerCase().endsWith('.jpg') ||
                  file.originalname.toLowerCase().endsWith('.jpeg') ||
                  file.originalname.toLowerCase().endsWith('.png');
  if (!isValid) return cb(new Error('Only PDF, JPG, JPEG, or PNG files are allowed'));
  cb(null, true);
};

const uploadCredentials = multer({ storage, fileFilter });

router.post('/api/register', uploadCredentials.single('doctoraldegree'), async (req, res) => {
    const { username, email, password, role, licenseNumber } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if(existingUser){
            if (req.file) {
              fs.unlink(req.file.path, (err) => { if (err) console.error('Failed to delete file:', err); });
            }
            return res.status(400).json({ message: 'User already exists' });
        }

        if (role === 'therapist') {
            if (!licenseNumber || !licenseNumber.trim()) {
                if (req.file) {
                  fs.unlink(req.file.path, (err) => { if (err) console.error('Failed to delete file:', err); });
                }
                return res.status(400).json({ message: 'Professional License Number is required for therapist registration' });
            }
            if (!req.file) {
                return res.status(400).json({ message: 'Doctoral Degree certificate is required for therapist registration' });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const userData = { username, email, password: hashedPassword, role };
        
        if (role === 'parent') {
            userData.parentId = generateUniqueId('parent');
        } else if (role === 'therapist') {
            userData.therapistId = generateUniqueId('therapist');
            userData.licenseNumber = licenseNumber;
            userData.doctoraldegreeUrl = req.file.filename;
            userData.status = 'pending';
        } else if (role === 'teacher') {
            userData.teacherId = generateUniqueId('teacher');
        } else if (role === 'researcher') {
            userData.researcherId = generateUniqueId('researcher');
        } else if (role === 'admin') {
            userData.adminId = generateUniqueId('admin');
        }
        
        const user = new User(userData);
        await user.save();
        
        const roleIdField = {
            parent: 'parentId',
            therapist: 'therapistId',
            teacher: 'teacherId',
            researcher: 'researcherId',
            admin: 'adminId'
        };
        
        const idField = roleIdField[role];
        const uniqueId = user[idField];
        
        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
            { expiresIn: '7d' }
        );
        
        res.status(201).json({ 
            message: 'User registered successfully',
            token: token,
            user: { id: user._id, email: user.email, role: user.role, [idField]: uniqueId }
        });
    }
    catch(err){
        if (req.file) {
          fs.unlink(req.file.path, (err) => { if (err) console.error('Failed to delete file:', err); });
        }
        console.error('Registration error:', err);
        return res.status(500).json({ message: 'Server error', error: err.message })
    }
})

// --- NEW ENDPOINT: To set a user's role after they sign up ---
router.put('/api/user/role', async (req, res) => {
    // We get the userId from the token to make this secure
    const { token, role } = req.body;
    if (!token || !role) {
        return res.status(400).json({ message: 'Token and role are required.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production");
        const userId = decoded.id;

        // Build update object with role and corresponding unique ID
        const updateData = { role };
        
        if (role === 'parent' && !await User.findById(userId).select('parentId').then(u => u?.parentId)) {
            updateData.parentId = generateUniqueId('parent');
        } else if (role === 'therapist' && !await User.findById(userId).select('therapistId').then(u => u?.therapistId)) {
            updateData.therapistId = generateUniqueId('therapist');
        } else if (role === 'teacher' && !await User.findById(userId).select('teacherId').then(u => u?.teacherId)) {
            updateData.teacherId = generateUniqueId('teacher');
        } else if (role === 'researcher' && !await User.findById(userId).select('researcherId').then(u => u?.researcherId)) {
            updateData.researcherId = generateUniqueId('researcher');
        } else if (role === 'admin' && !await User.findById(userId).select('adminId').then(u => u?.adminId)) {
            updateData.adminId = generateUniqueId('admin');
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Generate a new token with the updated role
        const newToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
            { expiresIn: "1h" }
        );
        res.json({ 
            message: "Role updated successfully", 
            token: newToken,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                parentId: user.parentId,
                therapistId: user.therapistId,
                teacherId: user.teacherId,
                researcherId: user.researcherId,
                adminId: user.adminId
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// ---------------- Google Authentication Route (Updated) ----------------
router.post('/api/auth/google', async (req, res) => {
    const { token } = req.body;
    console.log('=== Google Auth Request ===');
    console.log('Received Google token:', token ? 'Token received' : 'No token');
    console.log('Token length:', token ? token.length : 0);
    console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'No token');
    console.log('Google Client ID being used:', process.env.GOOGLE_CLIENT_ID || 'NOT SET');
    
    if (!token) {
        return res.status(400).json({ message: "No token provided" });
    }
    
    try {
        // Verify Google token
        console.log('Attempting to verify Google token...');
        const ticket = await googleClient.verifyIdToken({
            idToken: token
        });
        const payload = ticket.getPayload();
        
        // Manual audience verification
        const expectedAudience = process.env.GOOGLE_CLIENT_ID || "3074679378-fbmg47osjqajq7u4cv0qja7svo00pv3m.apps.googleusercontent.com";
        if (payload.aud !== expectedAudience) {
            console.error('❌ AUDIENCE MISMATCH:');
            console.error('Expected:', expectedAudience);
            console.error('Got:', payload.aud);
            throw new Error(`Invalid audience: expected ${expectedAudience}, got ${payload.aud}`);
        }
        
        console.log('✅ Google token verified successfully for:', payload.email);
        const { email, name } = payload;
        const normalizedEmail = email.toLowerCase();

        let user = null;
        let isNewUser = false;
        
        try {
            user = await User.findOne({ email: { $regex: `^${email}$`, $options: 'i' } }).maxTimeMS(5000);
            if (user) {
                console.log(`✅ Found existing user: ${user.email}, Role: ${user.role}`);
                // Check if user has a valid role, if not, treat as new user needing role selection
                const validRoles = ['parent', 'therapist', 'teacher', 'researcher', 'admin'];
                if (!user.role || !validRoles.includes(user.role)) {
                    console.log(`⚠️ User ${user.email} has invalid/undefined role (${user.role}), treating as new user`);
                    isNewUser = true;
                } else {
                    console.log(`✅ User has valid role: ${user.role}, isNewUser: false`);
                    isNewUser = false;
                }
            }
            if (user && user.email !== normalizedEmail) {
                user.email = normalizedEmail;
                await user.save();
            }
            if (!user) {
                isNewUser = true;
                console.log(`⚠️ User not found in DB, creating new guest user: ${normalizedEmail}`);
                user = new User({
                    username: name || normalizedEmail,
                    email: normalizedEmail,
                    password: '',
                    role: 'guest'
                });
                await user.save();
                console.log(`✅ New guest user created: ${normalizedEmail}`);
            }
        } catch (dbErr) {
            console.warn('⚠️ MongoDB unavailable, creating temporary user object:', dbErr.message);
            // If DB is down, create a temporary user object for JWT generation
            user = {
                _id: `temp-${Date.now()}`,
                email: normalizedEmail,
                role: 'guest'
            };
            isNewUser = true;
        }

        const jwtToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
            { expiresIn: "1h" }
        );
        
        console.log('✅ JWT token generated successfully');
        res.json({ 
            message: "Google login successful", 
            token: jwtToken, 
            isNewUser,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                parentId: user.parentId,
                therapistId: user.therapistId,
                teacherId: user.teacherId,
                researcherId: user.researcherId,
                adminId: user.adminId
            }
        });

    } catch (err) {
        console.error('❌ Google token verification failed:');
        console.error('Error message:', err.message);
        console.error('Error code:', err.code);
        console.error('Full error:', err);
        
        // Additional diagnostics
        if (err.message.includes('audience')) {
            console.error('⚠️ AUDIENCE MISMATCH - Token from different Client ID');
            console.error('Expected audience:', process.env.GOOGLE_CLIENT_ID || '3074679378-fbmg47osjqajq7u4cv0qja7svo00pv3m.apps.googleusercontent.com');
        }
        
        res.status(401).json({ 
            message: "Invalid Google token", 
            error: err.message,
            clientId: process.env.GOOGLE_CLIENT_ID || 'NOT SET',
            hint: 'Ensure frontend and backend use the same Google Client ID'
        });
    }
});

router.post('/api/auth/forget-password', async (req, res) => {
    const { email } = req.body;
    try{
        const user = await User.findOne({ email });
        if(!user){
            return res.status(404).json({ message: 'User not found' });
        }

        const Otp = generateOTP();
        user.otp = Otp;
        await user.save();

        const message = `Your OTP for password reset is: ${Otp}`;
        await sendEmail({
            email: user.email,
            subject: 'Password Reset OTP',
            message
        });

        res.status(200).json({
            message: 'OTP sent to your email',
            otp: Otp
        });

    }
    catch(err){
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/api/auth/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try{
        const user = await User.findOne({ email });
        if(!user){
            return res.status(404).json({ message: 'User not found' });
        }
        if(user.otp== otp){
            return res.status(200).json({ message: 'OTP Verified Successfully' });
        }
        else{
            return res.status(401).json({ message: 'Invalid OTP' });
        }
    }
    catch(err){
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;
    try{
        const user = await User.findOne({ email });
        if(!user){
            return res.status(404).json({ message: 'User not found' }); 
        }
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = null;
        await user.save();
        res.status(200).json({ message: 'Password reset successfully' });
    }
    catch(err){
        res.status(500).json({ message: 'Server error', error: err.message });
    }
})

// --- Protected therapist profile endpoints (required by frontend) ---
router.get('/api/therapist/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -otp');
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'therapist' && user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });
        res.json({ id: user._id, username: user.username, email: user.email, role: user.role, status: user.status });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/api/therapist/patients', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'therapist' && user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

        let patients;
        if (user.role === 'therapist') {
            patients = await Patient.find({ therapist_user_id: user._id }).sort({ createdAt: -1 }).lean();
        } else {
            patients = await Patient.find({ assignedTeacherId: user._id }).sort({ createdAt: -1 }).lean();
        }
        res.json(patients);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/api/therapist/patients', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'therapist' && user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

        const { patient_id, name, age, gender, parent_id } = req.body;
        if (!patient_id || !name || !age || !gender || !parent_id) {
            return res.status(400).json({ message: 'patient_id, name, age, gender, parent_id are required' });
        }
        const exists = await Patient.findOne({ patient_id });
        if (exists) return res.status(400).json({ message: 'Patient ID already exists' });

        const patient = new Patient({ patient_id, name, age, gender, parent_id });
        await patient.save();
        res.status(201).json(patient);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/api/therapist/patients/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'therapist' && user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

        const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!patient) return res.status(404).json({ message: 'Patient not found' });
        res.json(patient);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Teacher-scoped patients list with server-side search
router.get('/api/teacher/patients', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const { query } = req.query;
    const filter = { assignedTeacherId: me._id };
    if (query && String(query).trim().length > 0) {
      filter.name = { $regex: String(query).trim(), $options: 'i' };
    }

    const results = await Patient.find(filter)
      .select('name age gender riskLevel createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(results);
  } catch (err) {
    console.error('Teacher patients search error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Parent patient endpoints ---
router.get('/api/parent/patients', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'parent') return res.status(403).json({ message: 'Forbidden' });

        const patients = await Patient.find({ parent_id: req.user.id });
        res.json(patients);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/api/parent/patients', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'parent') return res.status(403).json({ message: 'Forbidden' });

        const { patient_id, name, age, gender } = req.body;
        if (!patient_id || !name || !age || !gender) {
            return res.status(400).json({ message: 'patient_id, name, age, and gender are required' });
        }

        const existingPatient = await Patient.findOne({ patient_id });
        if (existingPatient) {
            return res.status(400).json({ message: 'Patient ID already exists' });
        }

        const patient = new Patient({ patient_id, name, age, gender, parent_id: req.user.id });
        await patient.save();
        res.status(201).json(patient);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/api/parent/patients/:id', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'parent') return res.status(403).json({ message: 'Forbidden' });

        const patient = await Patient.findOneAndUpdate(
            { _id: req.params.id, parent_id: req.user.id },
            req.body,
            { new: true }
        );
        if (!patient) return res.status(404).json({ message: 'Patient not found' });
        res.json(patient);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Teacher dashboard endpoints ---
router.get('/api/teacher/dashboard', verifyToken, async (req, res) => {
    try {
        const me = await User.findById(req.user.id);
        if (!me) return res.status(404).json({ message: 'User not found' });
        if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

        const totalStudents = await Patient.countDocuments({ assignedTeacherId: me._id });
        const recentPatients = await Patient.find({ assignedTeacherId: me._id })
            .populate('parent_id', 'username email')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        const byRiskAgg = await Patient.aggregate([
          { $match: { assignedTeacherId: me._id } },
          { $group: { _id: "$riskLevel", count: { $sum: 1 } } }
        ]);
        const riskDistribution = ['Low','Moderate','High'].map(level => ({
          name: level,
          value: byRiskAgg.find(x => x._id === level)?.count || 0
        }));

        // Constrain trends to August-October of current year
        const now = new Date();
        const year = now.getFullYear();
        const start = new Date(year, 7, 1); // Aug 1
        const end = new Date(year, 10, 1);  // Nov 1 (exclusive)
        const monthsAgg = await Patient.aggregate([
          { $match: { assignedTeacherId: me._id, createdAt: { $gte: start, $lt: end } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]);
        const monthLabels = [
          `${year}-08`, `${year}-09`, `${year}-10`
        ];
        const map = new Map(monthsAgg.map(m => [m._id, m.count]));
        const screeningTrends = monthLabels.map(m => ({ month: m, screenings: map.get(m) || 0 }));

        const recent = recentPatients.map(p => ({
            id: p._id,
            name: p.name,
            age: p.age,
            gender: p.gender,
            parentName: p.parent_id ? p.parent_id.username : 'Unknown',
            date: p.createdAt ? p.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));

        res.json({ totalStudents, riskDistribution, screeningTrends, recent });
    } catch (err) {
        console.error('Teacher dashboard error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Teacher insights ---
router.get('/api/teacher/insights', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const totalAssignedStudents = await Patient.countDocuments({ assignedTeacherId: me._id });
    const byRiskAgg = await Patient.aggregate([
      { $match: { assignedTeacherId: me._id } },
      { $group: { _id: "$riskLevel", count: { $sum: 1 } } }
    ]);
    const riskDistribution = ['Low','Moderate','High'].map(level => ({
      name: level,
      value: byRiskAgg.find(x => x._id === level)?.count || 0
    }));

    // Constrain trends to August-October of current year
    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 7, 1); // Aug 1
    const end = new Date(year, 10, 1);  // Nov 1 (exclusive)

    const monthsAgg = await Patient.aggregate([
      { $match: { assignedTeacherId: me._id, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Ensure labels Aug, Sep, Oct present, fill zeros if missing
    const monthLabels = [
      `${year}-08`, `${year}-09`, `${year}-10`
    ];
    const map = new Map(monthsAgg.map(m => [m._id, m.count]));
    const screeningTrends = monthLabels.map(m => ({ month: m, screenings: map.get(m) || 0 }));

    res.json({ totalAssignedStudents, riskDistribution, screeningTrends });
  } catch (err) {
    console.error('Teacher insights error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Teacher feedback ---
router.get('/api/teacher/feedback', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const items = await Feedback.find({ teacherId: me._id })
      .populate('authorId', 'username email')
      .populate('patientId', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formatted = items.map(f => ({
      id: f._id,
      message: f.message,
      rating: f.rating || null,
      author: f.authorId ? { id: f.authorId._id, name: f.authorId.username, email: f.authorId.email } : null,
      patient: f.patientId ? { id: f.patientId._id, name: f.patientId.name } : null,
      createdAt: f.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Teacher feedback list error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/api/teacher/feedback', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    // Allow teachers to create feedback for themselves; admins could also post on behalf if needed
    const { message, rating, patientId } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    const doc = await Feedback.create({ teacherId: me._id, authorId: me._id, message, rating, patientId });
    res.status(201).json({ id: doc._id });
  } catch (err) {
    console.error('Teacher feedback create error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Teacher settings ---
router.get('/api/teacher/settings', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    let settings = await TeacherSettings.findOne({ userId: me._id }).lean();
    if (!settings) {
      settings = {
        userId: me._id,
        notificationEmail: me.email,
        notifyOnNewPatient: true,
        theme: 'light',
        language: 'en'
      };
    }
    res.json(settings);
  } catch (err) {
    console.error('Teacher settings get error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Students at risk ---
router.get('/api/teacher/students-at-risk', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const results = await Patient.find({ assignedTeacherId: me._id, riskLevel: { $in: ['High', 'Moderate'] } })
      .select('name age gender riskLevel createdAt')
      .sort({ riskLevel: -1, createdAt: -1 })
      .limit(20)
      .lean();

    res.json(results);
  } catch (err) {
    console.error('Teacher students-at-risk error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Upcoming meetings (default window Aug-Oct) ---
router.get('/api/teacher/meetings', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const now = new Date();
    const year = now.getFullYear();
    const defaultStart = new Date(year, 7, 1); // Aug 1
    const defaultEnd = new Date(year, 10, 1);  // Nov 1

    const from = req.query.from ? new Date(req.query.from) : defaultStart;
    const to = req.query.to ? new Date(req.query.to) : defaultEnd;

    const meetings = await Meeting.find({ teacherId: me._id, startsAt: { $gte: from, $lt: to } })
      .populate('patientId', 'name')
      .sort({ startsAt: 1 })
      .limit(100)
      .lean();

    res.json(meetings.map(m => ({
      id: m._id,
      title: m.title,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      status: m.status,
      patient: m.patientId ? { id: m.patientId._id, name: m.patientId.name } : null
    })));
  } catch (err) {
    console.error('Teacher meetings get error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/api/teacher/meetings', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const { patientId, title, startsAt, endsAt, status } = req.body;
    if (!patientId || !title || !startsAt) return res.status(400).json({ message: 'patientId, title, startsAt required' });

    const doc = await Meeting.create({ teacherId: me._id, patientId, title, startsAt, endsAt, status });
    res.status(201).json({ id: doc._id });
  } catch (err) {
    console.error('Teacher meetings post error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Reports (default window Aug-Oct) ---
router.get('/api/teacher/reports', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 7, 1);
    const end = new Date(year, 10, 1);

    const reports = await Report.find({ teacherId: me._id, createdAt: { $gte: start, $lt: end } })
      .populate('patientId', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(reports.map(r => ({
      id: r._id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
      patient: r.patientId ? { id: r.patientId._id, name: r.patientId.name } : null
    })));
  } catch (err) {
    console.error('Teacher reports get error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Screenings (derived from Patients, Aug-Oct) ---
router.get('/api/teacher/screenings', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const now = new Date();
    const year = now.getFullYear();
    const start = new Date(year, 7, 1);
    const end = new Date(year, 10, 1);

    const patients = await Patient.find({ assignedTeacherId: me._id, createdAt: { $gte: start, $lt: end } })
      .populate('parent_id', 'username email')
      .sort({ createdAt: -1 })
      .lean();

    const screenings = patients.map(p => ({
      id: p._id,
      childName: p.name,
      parentName: p.parent_id ? p.parent_id.username : 'Unknown',
      date: p.createdAt,
      riskLevel: p.riskLevel || 'Low',
      status: 'Completed'
    }));

    res.json(screenings);
  } catch (err) {
    console.error('Teacher screenings get error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/api/teacher/settings', verifyToken, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });
    if (me.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });

    const payload = {
      notificationEmail: req.body.notificationEmail,
      notifyOnNewPatient: req.body.notifyOnNewPatient,
      theme: req.body.theme,
      language: req.body.language
    };

    const updated = await TeacherSettings.findOneAndUpdate(
      { userId: me._id },
      { $set: { userId: me._id, ...payload } },
      { new: true, upsert: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    console.error('Teacher settings put error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// --- Admin endpoints ---
router.get('/api/admin/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -otp');
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
        res.json({ id: user._id, username: user.username, email: user.email, role: user.role });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/api/admin/stats', async (req, res) => {
    try {

        // Count pending users
        const pendingCount = await User.countDocuments({ status: 'pending' });
        
        // Count active users
        const userCount = await User.countDocuments({ isActive: true });
        
        // Count screenings for current month
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
        
        const screeningCount = await Patient.countDocuments({
            createdAt: {
                $gte: firstDayOfMonth,
                $lt: firstDayOfNextMonth
            }
        });
        

        res.json({
            pendingCount,
            userCount,
            screeningCount
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/api/admin/users', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

        const users = await User.find()
            .select('username email role createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const usersFormatted = users.map(user => ({
            id: user._id,
            name: user.username,
            email: user.email,
            role: user.role || 'User',
            status: 'Active',
            joinDate: user.createdAt ? user.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));

        res.json(usersFormatted);
    } catch (err) {
        console.error('Admin users error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/api/admin/screenings', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

        const patients = await Patient.find()
            .populate('parent_id', 'username email')
            .sort({ createdAt: -1 })
            .lean();

        const screeningsFormatted = patients.map(patient => ({
            id: patient._id,
            childName: patient.name,
            parentName: patient.parent_id ? patient.parent_id.username : 'Unknown',
            type: 'Patient Registration', // You can enhance this based on actual screening types
            date: patient.createdAt ? patient.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            riskLevel: 'Low', // You can enhance this based on actual screening results
            status: 'Completed'
        }));

        res.json(screeningsFormatted);
    } catch (err) {
        console.error('Admin screenings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


router.post('/api/auth/login', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password || '');
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.role !== 'admin') {
            if (user.role !== role) {
                return res.status(403).json({ message: 'You do not have the required role to log in' });
            }
        }

        const token = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
            { expiresIn: '1h' }
        );

        const roleIdField = {
            parent: 'parentId',
            therapist: 'therapistId',
            teacher: 'teacherId',
            researcher: 'researcherId',
            admin: 'adminId'
        };

        const idField = roleIdField[user.role];
        const uniqueId = user[idField];

        const responseUser = { 
            id: user._id, 
            email: user.email, 
            role: user.role,
            parentId: user.parentId,
            therapistId: user.therapistId,
            teacherId: user.teacherId,
            researcherId: user.researcherId,
            adminId: user.adminId
        };

        res.status(200).json({ 
            message: 'Login successful', 
            token,
            user: responseUser
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user role endpoint - called when user selects role after Google sign-in
router.put('/api/user/role', async (req, res) => {
    try {
        const { token, role } = req.body;
        
        if (!token || !role) {
            return res.status(400).json({ message: 'Token and role are required' });
        }
        
        // Verify the JWT token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production"
        );
        
        // Find the user
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update the role
        user.role = role;
        
        // Generate role-specific ID if it doesn't exist
        if (role === 'parent' && !user.parentId) {
            user.parentId = generateUniqueId('parent');
        } else if (role === 'therapist' && !user.therapistId) {
            user.therapistId = generateUniqueId('therapist');
        } else if (role === 'teacher' && !user.teacherId) {
            user.teacherId = generateUniqueId('teacher');
        } else if (role === 'researcher' && !user.researcherId) {
            user.researcherId = generateUniqueId('researcher');
        } else if (role === 'admin' && !user.adminId) {
            user.adminId = generateUniqueId('admin');
        }
        
        // Save the user
        await user.save();
        
        // Generate new token with updated role
        const newToken = jwt.sign(
            { id: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
            { expiresIn: '1h' }
        );
        
        // Return response with updated user data and new token
        res.json({
            message: 'Role updated successfully',
            token: newToken,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                parentId: user.parentId,
                therapistId: user.therapistId,
                teacherId: user.teacherId,
                researcherId: user.researcherId,
                adminId: user.adminId
            }
        });
    } catch (err) {
        console.error('Role update error:', err);
        
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        
        res.status(500).json({ message: 'Server error' });
    }
});


module.exports = router;

