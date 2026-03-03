const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { verifyToken, therapistCheck } = require('../middlewares/auth');
const GazeSession = require('../models/GazeSession');
const Patient = require('../models/patient');
const User = require('../models/user');

// Helper function to auto-link guest sessions to patient
async function autoLinkGuestSessions(patientId, parentEmail) {
    try {
        const patient = await Patient.findById(patientId);
        if (!patient) return { linked: 0 };

        const parent = await User.findById(patient.parent_id);
        if (!parent || !parent.email) return { linked: 0 };

        const emailToMatch = parentEmail || parent.email;

        // Find all guest sessions with matching email
        const guestSessions = await GazeSession.find({
            'guestInfo.email': emailToMatch,
            isGuest: true,
            patientId: null // Only link sessions not already linked
        });

        let linkedCount = 0;
        for (const session of guestSessions) {
            session.patientId = patientId;
            session.therapistId = patient.therapist_user_id;
            session.isGuest = false;
            session.sessionType = 'authenticated';
            await session.save();
            linkedCount++;
        }

        if (linkedCount > 0) {
            console.log(`✅ Auto-linked ${linkedCount} guest sessions to patient ${patient.name}`);
        }

        return { linked: linkedCount };
    } catch (error) {
        console.error('❌ Error in auto-link:', error);
        return { linked: 0, error: error.message };
    }
}

// Ensure gaze uploads directory exists
const gazeUploadsDir = path.join(__dirname, '../uploads/gaze');
if (!fs.existsSync(gazeUploadsDir)) {
    fs.mkdirSync(gazeUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, gazeUploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'gaze-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Shared logic for snapshot upload
async function handleSnapshotUpload(req, res, sessionId, analyze) {
    console.log(`📸 Handling snapshot upload for session: ${sessionId}`);
    if (!req.file) {
        console.error('❌ No file received in handleSnapshotUpload');
        return res.status(400).json({ error: 'No image uploaded' });
    }

    const session = await GazeSession.findById(sessionId);
    if (!session) {
        console.error(`❌ Session ${sessionId} not found`);
        return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
        return res.status(400).json({ error: 'Session is not active' });
    }

    const snapshotData = {
        imagePath: `/uploads/gaze/${req.file.filename}`,
        timestamp: new Date(),
        gazeDirection: req.body.gazeDirection || 'unknown',
        attentionScore: parseFloat(req.body.attentionScore) || 0,
        headPitch: parseFloat(req.body.headPitch) || 0,
        headYaw: parseFloat(req.body.headYaw) || 0,
        sessionId: sessionId.toString()
    };

    if (analyze === 'true') {
        const imagePath = path.resolve(req.file.path);
        const gazeWorkerPath = path.resolve(__dirname, '../gaze_worker.py');

        const result = await new Promise((resolve) => {
            const pythonProcess = spawn('py', ['-3.10', gazeWorkerPath, imagePath]);
            let output = '';
            let errorOutput = '';
            
            pythonProcess.stdout.on('data', (data) => output += data.toString());
            pythonProcess.stderr.on('data', (data) => errorOutput += data.toString());
            
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                console.error('Snapshot analysis timed out');
                resolve({ error: 'Analysis timed out' });
            }, 60000);

            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                try {
                    resolve(JSON.parse(output.trim()));
                } catch (e) {
                    console.error('Snapshot Python error:', errorOutput);
                    resolve({ error: 'Analysis failed' });
                }
            });
        });

        if (result && !result.error) {
            snapshotData.gazeDirection = result.gaze_direction;
            snapshotData.attentionScore = result.attention_score;
            snapshotData.headPitch = result.head_pitch;
            snapshotData.headYaw = result.head_yaw;
        }
    }

    session.snapshots.push(snapshotData);
    await session.save();

    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    if (io) {
        io.to(sessionId.toString()).emit('new-snapshot', snapshotData);
    }

    return snapshotData;
}

// Analyze a single snapshot without saving to session
router.post('/analyze', async (req, res) => {
    let tempFilePath = null;
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) return res.status(400).json({ error: 'No image data' });

        // Ensure gaze uploads directory exists
        if (!fs.existsSync(gazeUploadsDir)) {
            fs.mkdirSync(gazeUploadsDir, { recursive: true });
        }

        // Save base64 to temp file
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        tempFilePath = path.join(gazeUploadsDir, `temp-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`);
        fs.writeFileSync(tempFilePath, base64Data, 'base64');

        const gazeWorkerPath = path.resolve(__dirname, '../gaze_worker.py');
        
        const result = await new Promise((resolve) => {
            const pythonProcess = spawn('py', ['-3.10', gazeWorkerPath, tempFilePath]);
            let output = '';
            let errorOutput = '';
            
            pythonProcess.stdout.on('data', (data) => output += data.toString());
            pythonProcess.stderr.on('data', (data) => errorOutput += data.toString());
            
            const timeout = setTimeout(() => {
                pythonProcess.kill();
                resolve({ error: 'Analysis timed out after 60s' });
            }, 60000);

            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                try {
                    const parsed = JSON.parse(output.trim());
                    resolve(parsed);
                } catch (e) {
                    console.error('Python error output:', errorOutput);
                    resolve({ error: 'Analysis failed to parse output', details: errorOutput });
                }
            });
        });

        res.status(200).json(result);
    } catch (err) {
        console.error('Gaze analyze route error:', err);
        res.status(500).json({ error: 'Gaze analysis failed: ' + err.message });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) {}
        }
    }
});

// Middleware to allow either authenticated user or guest (via sessionId)
const verifyGuestOrUser = async (req, res, next) => {
    // 1. Try Token
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        return verifyToken(req, res, next);
    }

    // 2. Try Guest Session ID from body or params or query
    const sessionId = req.params.sessionId || req.body.sessionId || req.query.sessionId;
    console.log(`🔍 Verifying access for sessionId: ${sessionId}`);

    if (sessionId) {
        try {
            const session = await GazeSession.findById(sessionId);
            if (session && session.isGuest && session.status === 'active') {
                req.isGuest = true;
                req.sessionId = sessionId;
                return next();
            } else if (session) {
                console.log(`⚠️ Session found but not eligible. Guest: ${session.isGuest}, Status: ${session.status}`);
            }
        } catch (err) {
            console.error("Guest verification error:", err);
        }
    }

    console.log('❌ Guest verification failed');
    return res.status(401).json({ error: 'Unauthorized: Authentication or Guest Session required' });
};

// Start a guest gaze analysis session - WITH PROPER METADATA
router.post('/session/guest/start', async (req, res) => {
    try {
        const { childName, parentName, email } = req.body;
        console.log('🚀 Starting guest session request:', { childName, parentName, email });
        
        const session = new GazeSession({
            isGuest: true,
            sessionType: 'guest_screening', // CRITICAL: Set for recovery
            module: 'live_gaze', // CRITICAL: Set for recovery
            source: 'live_gaze_analysis',
            guestInfo: {
                childName: childName || 'Guest Child',
                parentName: parentName || 'Guest Parent',
                email: email || ''
            },
            status: 'active',
            snapshots: []
        });

        await session.save();
        console.log('✅ Guest session created:', session._id);
        res.status(201).json(session);
    } catch (err) {
        console.error('❌ Error starting guest gaze session:', err);
        res.status(500).json({ error: 'Failed to start guest gaze session: ' + err.message });
    }
});

// Start a new gaze analysis session (Authenticated)
router.post('/session/start', verifyToken, async (req, res) => {
    try {
        const { patientId } = req.body;
        
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // If the user is a parent, assign the session to the patient's assigned therapist
        let therapistId = req.user.id;
        if (req.user.role === 'parent') {
            if (!patient.therapist_user_id) {
                return res.status(400).json({ error: 'No therapist assigned to this patient. Please contact support.' });
            }
            therapistId = patient.therapist_user_id;
        }

        const session = new GazeSession({
            patientId,
            therapistId,
            status: 'active',
            snapshots: []
        });

        await session.save();

        // Auto-link any existing guest sessions with the same parent email
        const parent = await User.findById(patient.parent_id);
        if (parent && parent.email) {
            const linkResult = await autoLinkGuestSessions(patientId, parent.email);
            if (linkResult.linked > 0) {
                console.log(`🔗 Auto-linked ${linkResult.linked} guest sessions for ${parent.email}`);
            }
        }

        res.status(201).json(session);
    } catch (err) {
        console.error('Error starting gaze session:', err);
        res.status(500).json({ error: 'Failed to start gaze session' });
    }
});

// Upload a snapshot to an active session
router.post('/snapshot/:sessionId', verifyGuestOrUser, upload.single('image'), async (req, res) => {
    try {
        const result = await handleSnapshotUpload(req, res, req.params.sessionId, req.body.analyze);
        if (result) res.status(200).json(result);
    } catch (err) {
        console.error('Error uploading gaze snapshot:', err);
        res.status(500).json({ error: 'Failed to upload snapshot' });
    }
});

// Alias for snapshot upload to match user request
router.post('/session/snapshot', verifyGuestOrUser, upload.single('image'), async (req, res) => {
    try {
        const { sessionId, analyze } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
        
        const result = await handleSnapshotUpload(req, res, sessionId, analyze);
        if (result) res.status(200).json(result);
    } catch (err) {
        console.error('Error uploading gaze snapshot:', err);
        res.status(500).json({ error: 'Failed to upload snapshot' });
    }
});

// Alias for snapshot upload to match user request (legacy/extra)
router.post('/upload', verifyGuestOrUser, upload.single('image'), async (req, res) => {
    try {
        const { sessionId, analyze } = req.body;
        if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
        
        const result = await handleSnapshotUpload(req, res, sessionId, analyze);
        if (result) res.status(200).json(result);
    } catch (err) {
        console.error('Error uploading gaze snapshot:', err);
        res.status(500).json({ error: 'Failed to upload snapshot' });
    }
});

// Therapist direct save - Save session directly to patient record
router.post('/therapist/save-to-patient', verifyToken, therapistCheck, async (req, res) => {
    const savedFiles = []; // Track saved files for rollback
    
    try {
        const { patientId, snapshots } = req.body;
        
        console.log('👨‍⚕️ Therapist Direct Save - Live Gaze');
        console.log(`📋 Patient ID: ${patientId}`);
        console.log(`📸 Snapshots: ${snapshots?.length || 0}`);

        // Validate required fields
        if (!patientId) {
            return res.status(400).json({ error: 'Patient ID is required' });
        }

        if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) {
            return res.status(400).json({ error: 'At least one snapshot is required' });
        }

        // Verify patient exists
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // STEP 1: Process and save all snapshot images first (atomic)
        const processedSnapshots = [];
        
        for (let i = 0; i < snapshots.length; i++) {
            const snap = snapshots[i];
            
            try {
                const base64Data = snap.image.replace(/^data:image\/\w+;base64,/, "");
                const filename = `therapist-gaze-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
                const filePath = path.join(gazeUploadsDir, filename);
                
                fs.writeFileSync(filePath, base64Data, 'base64');
                savedFiles.push(filePath);
                
                processedSnapshots.push({
                    imagePath: `/uploads/gaze/${filename}`,
                    timestamp: snap.timestamp || new Date(),
                    attentionScore: snap.attentionScore || 0,
                    gazeDirection: snap.gazeDirection || 'unknown',
                    status: snap.status || 'captured'
                });
                
                console.log(`✅ Saved snapshot ${i + 1}: ${filename}`);
            } catch (err) {
                console.error(`❌ Error processing snapshot ${i + 1}:`, err.message);
                throw new Error(`Failed to save snapshot ${i + 1}: ${err.message}`);
            }
        }

        // STEP 2: Create database session (atomic with images)
        const gazeSession = new GazeSession({
            patientId,
            therapistId: req.user.id,
            isGuest: false,
            sessionType: 'authenticated',
            sessionSource: 'therapist',
            module: 'live_gaze',
            assignedRole: 'therapist',
            source: 'therapist_dashboard',
            status: 'completed', // Direct save = completed
            snapshots: processedSnapshots,
            startTime: new Date(),
            endTime: new Date()
        });

        await gazeSession.save();
        
        console.log(`✅ Therapist session saved to patient record: ${gazeSession._id}`);
        console.log(`📋 Patient: ${patient.name}, Therapist: ${req.user.name}`);

        res.status(200).json({ 
            success: true,
            message: 'Session saved to patient record successfully.',
            sessionId: gazeSession._id,
            patientName: patient.name,
            snapshotsProcessed: processedSnapshots.length
        });
        
    } catch (err) {
        console.error('❌ Error in therapist direct save:', err);
        
        // ROLLBACK: Delete all saved images if DB save fails
        console.log(`🔄 Rolling back ${savedFiles.length} saved images...`);
        for (const filePath of savedFiles) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Deleted: ${filePath}`);
                }
            } catch (deleteErr) {
                console.error(`⚠️ Failed to delete ${filePath}:`, deleteErr.message);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to save session to patient record',
            details: err.message 
        });
    }
});

// Send session for review (bulk upload) - ATOMIC OPERATION
router.post('/session/send-for-review', verifyGuestOrUser, async (req, res) => {
    const savedFiles = []; // Track saved files for rollback
    
    try {
        const { sessionId, snapshots, endTime, sessionType, assignedRole, source } = req.body;
        console.log('\n' + '='.repeat(70));
        console.log('📩 SEND-FOR-REVIEW REQUEST');
        console.log('='.repeat(70));
        console.log(`Session ID: ${sessionId}`);
        console.log(`Snapshots in request: ${snapshots ? snapshots.length : 0}`);
        console.log(`Metadata:`);
        console.log(`   - Type: ${sessionType}`);
        console.log(`   - Assigned: ${assignedRole}`);
        console.log(`   - Source: ${source}`);
        
        if (snapshots && snapshots.length > 0) {
            console.log(`\n📸 Snapshot Details:`);
            snapshots.forEach((snap, i) => {
                const hasImage = snap.image && snap.image.length > 0;
                const imageSize = hasImage ? (snap.image.length / 1024).toFixed(2) + ' KB' : 'N/A';
                console.log(`   ${i + 1}. Timestamp: ${snap.timestamp}, Score: ${snap.attentionScore}, Size: ${imageSize}`);
            });
        }

        if (!sessionId) {
            return res.status(400).json({ error: 'Missing session ID' });
        }

        const session = await GazeSession.findById(sessionId);
        if (!session) {
            console.error(`❌ Session ${sessionId} not found in send-for-review`);
            return res.status(404).json({ error: 'Session not found' });
        }
        
        console.log(`\n📋 Existing session:`);
        console.log(`   - Current snapshots: ${session.snapshots?.length || 0}`);
        console.log(`   - Current status: ${session.status}`);
        console.log('='.repeat(70));

        // STEP 1: Process and save all snapshot images FIRST
        const processedSnapshots = [];
        if (snapshots && Array.isArray(snapshots) && snapshots.length > 0) {
            console.log(`💾 Processing ${snapshots.length} snapshots for session ${sessionId}`);
            
            for (let i = 0; i < snapshots.length; i++) {
                const snap = snapshots[i];
                try {
                    // Avoid duplicating snapshots that might have been uploaded live
                    const isDuplicate = session.snapshots.some(existing => 
                        existing.timestamp && snap.timestamp && 
                        new Date(existing.timestamp).getTime() === new Date(snap.timestamp).getTime()
                    );
                    
                    if (isDuplicate) {
                        console.log(`⏭️ Skipping duplicate snapshot from ${snap.timestamp}`);
                        continue;
                    }

                    const base64Data = snap.image.replace(/^data:image\/\w+;base64,/, "");
                    const filename = `gaze-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
                    const filePath = path.join(gazeUploadsDir, filename);
                    
                    // Save image to disk
                    fs.writeFileSync(filePath, base64Data, 'base64');
                    savedFiles.push(filePath); // Track for potential rollback
                    
                    processedSnapshots.push({
                        imagePath: `/uploads/gaze/${filename}`,
                        timestamp: snap.timestamp || new Date(),
                        attentionScore: snap.attentionScore || 0,
                        gazeDirection: snap.gazeDirection || 'unknown'
                    });
                    
                    console.log(`✅ Saved snapshot ${i + 1}/${snapshots.length}: ${filename}`);
                } catch (err) {
                    console.error(`❌ Error processing snapshot ${i + 1}:`, err.message);
                    throw new Error(`Failed to save snapshot ${i + 1}: ${err.message}`);
                }
            }

            console.log(`✅ Processed ${processedSnapshots.length} snapshots for session ${sessionId}`);
        }
        
        // STEP 2: Update session in database (only after all images are saved)
        if (processedSnapshots.length > 0) {
            session.snapshots.push(...processedSnapshots);
        }
        session.status = 'pending_review';
        session.endTime = endTime || new Date();
        if (sessionType) session.sessionType = sessionType;
        if (assignedRole) session.assignedRole = assignedRole;
        if (source) session.source = source;
        
        // Mark as live_gaze module if not set
        if (!session.module) {
            session.module = 'live_gaze';
        }
        
        await session.save();
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ SESSION SAVED SUCCESSFULLY');
        console.log('='.repeat(70));
        console.log(`Session ID: ${sessionId}`);
        console.log(`Total snapshots in session: ${session.snapshots.length}`);
        console.log(`Status: ${session.status}`);
        console.log(`Module: ${session.module}`);
        console.log(`Type: ${session.sessionType}`);
        if (session.snapshots.length > 0) {
            console.log(`\nSnapshot paths saved:`);
            session.snapshots.forEach((snap, i) => {
                console.log(`   ${i + 1}. ${snap.imagePath} (${new Date(snap.timestamp).toLocaleTimeString()})`);
            });
        }
        console.log('='.repeat(70) + '\n');
        
        res.status(200).json({ 
            success: true, 
            message: `Session sent for review successfully with ${session.snapshots.length} snapshots`,
            snapshotCount: session.snapshots.length,
            sessionId: sessionId
        });
        
    } catch (err) {
        console.error(`❌ Error in send-for-review:`, err);
        
        // ROLLBACK: Delete all saved images if operation fails
        if (savedFiles.length > 0) {
            console.log(`🔄 Rolling back ${savedFiles.length} saved images...`);
            for (const filePath of savedFiles) {
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Deleted: ${filePath}`);
                    }
                } catch (deleteErr) {
                    console.error(`⚠️ Failed to delete ${filePath}:`, deleteErr.message);
                }
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to send session for review',
            details: err.message
        });
    }
});

// End a gaze session
router.post('/session/end/:sessionId', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await GazeSession.findByIdAndUpdate(
            sessionId, 
            { status: 'completed', endTime: new Date() },
            { new: true }
        );
        res.status(200).json(session);
    } catch (err) {
        res.status(500).json({ error: 'Failed to end session' });
    }
});

// Get active sessions for a therapist
// LIVE TAB: Only show therapist's own active sessions, NOT guest sessions
router.get('/sessions/active', verifyToken, therapistCheck, async (req, res) => {
    try {
        const sessions = await GazeSession.find({ 
            therapistId: req.user.id,
            isGuest: false, // Explicitly exclude guest sessions
            status: 'active'
        }).populate('patientId', 'name');
        
        console.log(`🔴 LIVE: Found ${sessions.length} active therapist sessions`);
        res.status(200).json(sessions);
    } catch (err) {
        console.error('❌ Error fetching active sessions:', err);
        res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
});

// Get sessions pending review for a therapist - REBUILT WITHOUT FILTERS
router.get('/sessions/pending-review', verifyToken, therapistCheck, async (req, res) => {
    try {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 THERAPIST REVIEW QUERY - DIRECT DATABASE ACCESS');
        console.log('='.repeat(70));
        console.log(`Therapist ID: ${req.user.id}`);
        console.log(`Timestamp: ${new Date().toISOString()}`);
        
        const { sessionId } = req.query;
        
        // STEP 1: Query raw database - NO TIME FILTERS, NO STATUS FILTERS
        let rawQuery;
        
        if (sessionId) {
            console.log(`\n🎯 Specific session requested: ${sessionId}`);
            rawQuery = { _id: sessionId };
        } else {
            // RAW DATABASE QUERY: module = 'live_gaze' ONLY
            // Remove ALL other filters (status, time, etc.)
            rawQuery = { 
                module: 'live_gaze',
                // Must have photos
                snapshots: { $exists: true, $not: { $size: 0 } }
            };
            console.log('\n📋 Query Criteria:');
            console.log('   - module = "live_gaze"');
            console.log('   - snapshots exist and not empty');
            console.log('   - NO status filter');
            console.log('   - NO time filter');
            console.log('   - NO therapist filter');
        }
        
        const sessions = await GazeSession.find(rawQuery)
            .populate('patientId', 'name age gender')
            .populate('therapistId', 'name email')
            .sort({ createdAt: -1 })
            .limit(5000); // Very high limit
        
        console.log(`\n✅ Raw query returned ${sessions.length} sessions`);
        
        // STEP 2: Analyze what we found
        const analysis = {
            total: sessions.length,
            byStatus: {},
            byType: {},
            withGuest: 0,
            withPatient: 0,
            excluded: []
        };
        
        sessions.forEach(s => {
            const status = s.status || 'NULL';
            const type = s.sessionType || 'NULL';
            analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;
            analysis.byType[type] = (analysis.byType[type] || 0) + 1;
            if (s.isGuest || s.guestInfo?.email) analysis.withGuest++;
            if (s.patientId) analysis.withPatient++;
        });
        
        console.log('\n📊 Analysis:');
        console.log('   Status Breakdown:');
        Object.entries(analysis.byStatus).forEach(([status, count]) => {
            console.log(`      ${status}: ${count}`);
        });
        console.log('   Type Breakdown:');
        Object.entries(analysis.byType).forEach(([type, count]) => {
            console.log(`      ${type}: ${count}`);
        });
        console.log(`   Guest Sessions: ${analysis.withGuest}`);
        console.log(`   Patient Sessions: ${analysis.withPatient}`);
        
        // STEP 3: Validate and fix image URLs
        const validatedSessions = sessions.map(session => {
            const sessionObj = session.toObject();
            
            // Fix image paths
            if (sessionObj.snapshots && sessionObj.snapshots.length > 0) {
                sessionObj.snapshots = sessionObj.snapshots.map(snap => {
                    if (snap.imagePath && !snap.imagePath.startsWith('/uploads/')) {
                        if (snap.imagePath.startsWith('gaze/')) {
                            snap.imagePath = `/uploads/${snap.imagePath}`;
                        } else if (!snap.imagePath.startsWith('/')) {
                            snap.imagePath = `/uploads/gaze/${snap.imagePath}`;
                        }
                    }
                    return snap;
                });
            }
            
            return sessionObj;
        });
        
        // STEP 4: Log sample sessions
        if (validatedSessions.length > 0) {
            const oldest = validatedSessions[validatedSessions.length - 1];
            const newest = validatedSessions[0];
            console.log(`\n📅 Date Range: ${new Date(oldest.createdAt).toLocaleString()} → ${new Date(newest.createdAt).toLocaleString()}`);
            
            console.log('\n📸 Sample Sessions (first 10):');
            validatedSessions.slice(0, 10).forEach((s, i) => {
                const guestName = s.guestInfo?.childName || s.guestInfo?.email?.split('@')[0] || 'Unknown';
                const patientName = s.patientId?.name || 'N/A';
                const name = s.isGuest ? guestName : patientName;
                const snapshotCount = s.snapshots?.length || 0;
                console.log(`   ${i + 1}. ${s._id.toString().substring(0, 8)}... - ${name}`);
                console.log(`      Type: ${s.isGuest ? 'Guest' : 'Patient'}, Status: ${s.status || 'NULL'}`);
                console.log(`      📸 SNAPSHOTS: ${snapshotCount} images`);
                console.log(`      Date: ${new Date(s.createdAt).toLocaleString()}`);
                
                // Show first 3 image paths to verify they exist
                if (snapshotCount > 0) {
                    console.log(`      Image paths:`);
                    s.snapshots.slice(0, 3).forEach((snap, idx) => {
                        console.log(`         ${idx + 1}. ${snap.imagePath}`);
                    });
                    if (snapshotCount > 3) {
                        console.log(`         ... and ${snapshotCount - 3} more`);
                    }
                } else {
                    console.log(`      ⚠️ NO SNAPSHOTS!`);
                }
                console.log('');
            });
        } else {
            console.log('\n⚠️  WARNING: No sessions found matching criteria!');
            console.log('   This indicates the database is empty or module field is incorrect.');
        }
        
        console.log('\n' + '='.repeat(70));
        console.log(`✅ Returning ${validatedSessions.length} sessions to frontend`);
        console.log('='.repeat(70) + '\n');
        
        res.status(200).json(validatedSessions);
    } catch (err) {
        console.error('\n❌ ERROR in pending-review endpoint:', err);
        console.error(err.stack);
        res.status(500).json({ error: 'Failed to fetch pending review sessions', details: err.message });
    }
});

// DIAGNOSTIC: Get all sessions in database (for debugging)
router.get('/sessions/diagnostic', verifyToken, therapistCheck, async (req, res) => {
    try {
        const allSessions = await GazeSession.find({})
            .select('_id isGuest sessionType module status snapshots createdAt guestInfo.childName patientId')
            .populate('patientId', 'name')
            .sort({ createdAt: -1 })
            .limit(100);
        
        const summary = {
            total: allSessions.length,
            withSnapshots: allSessions.filter(s => s.snapshots && s.snapshots.length > 0).length,
            guestSessions: allSessions.filter(s => s.isGuest).length,
            pendingReview: allSessions.filter(s => s.status === 'pending_review').length,
            completed: allSessions.filter(s => s.status === 'completed').length,
            sessions: allSessions.map(s => ({
                id: s._id,
                type: s.isGuest ? 'Guest' : 'Patient',
                name: s.isGuest ? s.guestInfo?.childName : s.patientId?.name,
                module: s.module,
                sessionType: s.sessionType,
                status: s.status,
                snapshotCount: s.snapshots?.length || 0,
                date: s.createdAt
            }))
        };
        
        console.log(`🔍 DIAGNOSTIC: Found ${summary.total} total sessions`);
        console.log(`   - With photos: ${summary.withSnapshots}`);
        console.log(`   - Guest sessions: ${summary.guestSessions}`);
        console.log(`   - Pending review: ${summary.pendingReview}`);
        
        res.json(summary);
    } catch (err) {
        console.error('❌ Diagnostic error:', err);
        res.status(500).json({ error: err.message });
    }
});

// DIAGNOSTIC: Check gaze images directory
router.get('/images/check', verifyToken, therapistCheck, async (req, res) => {
    try {
        const gazeDir = path.join(__dirname, '../uploads/gaze');
        
        if (!fs.existsSync(gazeDir)) {
            return res.json({ 
                exists: false, 
                message: 'Gaze uploads directory does not exist',
                path: gazeDir 
            });
        }
        
        const files = fs.readdirSync(gazeDir);
        const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        
        // Get file stats
        const fileDetails = imageFiles.slice(0, 20).map(file => {
            const filePath = path.join(gazeDir, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                path: `/uploads/gaze/${file}`
            };
        });
        
        res.json({
            exists: true,
            path: gazeDir,
            totalFiles: files.length,
            imageFiles: imageFiles.length,
            sample: fileDetails
        });
    } catch (err) {
        console.error('❌ Image check error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get specific session by ID with full details
router.get('/session/:sessionId', verifyToken, therapistCheck, async (req, res) => {
    try {
        const { sessionId } = req.params;
        console.log(`🔍 Fetching session by ID: ${sessionId}`);
        
        const session = await GazeSession.findById(sessionId)
            .populate('patientId', 'name age gender')
            .populate('therapistId', 'name email')
            .populate('reviewedBy', 'name email');
        
        if (!session) {
            console.log(`❌ Session ${sessionId} not found`);
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Validate image paths exist
        const gazeDir = path.join(__dirname, '../uploads/gaze');
        const validatedSnapshots = session.snapshots.map(snap => {
            const snapObj = snap.toObject();
            
            // Check if file exists
            if (snapObj.imagePath) {
                const filename = snapObj.imagePath.split('/').pop();
                const filePath = path.join(gazeDir, filename);
                snapObj.fileExists = fs.existsSync(filePath);
                
                if (!snapObj.fileExists) {
                    console.log(`⚠️  Missing image file: ${filename}`);
                }
            }
            
            return snapObj;
        });
        
        const sessionObj = session.toObject();
        sessionObj.snapshots = validatedSnapshots;
        sessionObj.snapshotCount = validatedSnapshots.length;
        sessionObj.validImages = validatedSnapshots.filter(s => s.fileExists).length;
        sessionObj.missingImages = validatedSnapshots.filter(s => !s.fileExists).length;
        
        console.log(`✅ Session found: ${sessionObj.snapshotCount} snapshots (${sessionObj.validImages} valid, ${sessionObj.missingImages} missing)`);
        
        res.json(sessionObj);
    } catch (err) {
        console.error('❌ Error fetching session:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update notes for a specific snapshot
router.put('/snapshot/:sessionId/:snapshotId/notes', verifyToken, therapistCheck, async (req, res) => {
    try {
        const { sessionId, snapshotId } = req.params;
        const { notes } = req.body;

        const session = await GazeSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const snapshot = session.snapshots.id(snapshotId);
        if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

        snapshot.notes = notes;
        await session.save();

        res.status(200).json(snapshot);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update notes' });
    }
});

// Get received gaze snapshots for a specific session (Therapist View)
router.get('/therapist/sessions/:sessionId', verifyToken, therapistCheck, async (req, res) => {
    try {
        const session = await GazeSession.findById(req.params.sessionId).populate('patientId', 'name age gender');
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.status(200).json(session);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch session details' });
    }
});

module.exports = router;
