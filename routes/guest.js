const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const GazeSession = require('../models/GazeSession');

// Ensure gaze uploads directory exists
const gazeUploadsDir = path.join(__dirname, '../uploads/gaze');
if (!fs.existsSync(gazeUploadsDir)) {
    fs.mkdirSync(gazeUploadsDir, { recursive: true });
}

/**
 * POST /api/guest/live-gaze/submit
 * Unauthenticated endpoint for guest live gaze screening submissions
 * No login required, no parent role assignment, no redirect
 */
router.post('/live-gaze/submit', async (req, res) => {
    const savedFiles = []; // Track saved files for rollback
    
    try {
        const { guestInfo, snapshots } = req.body;
        
        console.log('📩 Guest Live Gaze Submission');
        console.log(`👤 Guest: ${guestInfo?.childName} (Parent: ${guestInfo?.parentName})`);
        console.log(`📸 Snapshots: ${snapshots?.length || 0}`);

        // Validate required fields
        if (!guestInfo || !guestInfo.childName || !guestInfo.parentName || !guestInfo.email) {
            return res.status(400).json({ 
                error: 'Missing required guest information (childName, parentName, email)' 
            });
        }

        if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) {
            return res.status(400).json({ 
                error: 'At least one snapshot is required' 
            });
        }

        // STEP 1: Process and save all snapshot images first
        const processedSnapshots = [];
        
        for (let i = 0; i < snapshots.length; i++) {
            const snap = snapshots[i];
            
            try {
                // Extract base64 data
                const base64Data = snap.image.replace(/^data:image\/\w+;base64,/, "");
                const filename = `guest-gaze-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
                const filePath = path.join(gazeUploadsDir, filename);
                
                // Save image to disk
                fs.writeFileSync(filePath, base64Data, 'base64');
                savedFiles.push(filePath); // Track for rollback
                
                // Add to processed snapshots
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

        if (processedSnapshots.length === 0) {
            throw new Error('Failed to process any snapshots');
        }

        // STEP 2: Create database session (atomic with images)
        const gazeSession = new GazeSession({
            isGuest: true,
            sessionType: 'guest_screening',
            sessionSource: 'guest',
            module: 'live_gaze',
            assignedRole: 'therapist',
            source: 'live_gaze_analysis',
            status: 'pending_review',
            guestInfo: {
                childName: guestInfo.childName,
                parentName: guestInfo.parentName,
                email: guestInfo.email
            },
            snapshots: processedSnapshots,
            startTime: new Date(),
            endTime: new Date()
        });

        await gazeSession.save();
        
        console.log(`✅ Guest gaze session created: ${gazeSession._id}`);
        console.log(`📋 Status: ${gazeSession.status}, Type: ${gazeSession.sessionType}, Module: ${gazeSession.module}, Source: ${gazeSession.sessionSource}`);

        res.status(200).json({ 
            success: true,
            message: 'Session sent to therapist for review.',
            sessionId: gazeSession._id,
            snapshotsProcessed: processedSnapshots.length
        });
        
    } catch (err) {
        console.error('❌ Error in guest live-gaze submission:', err);
        
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
            error: 'Failed to submit session for review',
            details: err.message 
        });
    }
});

module.exports = router;
