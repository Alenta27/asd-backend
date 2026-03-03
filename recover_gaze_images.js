/**
 * COMPREHENSIVE LIVE GAZE IMAGE RECOVERY SYSTEM
 * 
 * This script performs a complete database repair process:
 * 1. Scans all gaze_sessions where module="live_gaze" and sessionType="guest_screening"
 * 2. Inventories all physical image files in uploads/gaze directory
 * 3. Matches orphaned images to sessions based on timestamp correlation
 * 4. Re-links images to correct sessionId
 * 5. Repairs broken foreign-key relationships
 * 6. Backfills missing image URLs into review records
 * 7. Validates no session with valid sessionId remains without images
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GazeSession = require('./models/GazeSession');

// Configuration
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/asd_db';
const GAZE_UPLOADS_DIR = path.join(__dirname, 'uploads', 'gaze');
const TIMESTAMP_TOLERANCE_MS = 120000; // 2 minutes tolerance for matching

// Stats tracking
const stats = {
    totalLiveGazeSessions: 0,
    sessionsWithImages: 0,
    sessionsWithoutImages: 0,
    totalPhysicalImages: 0,
    orphanedImages: 0,
    matchedImages: 0,
    relinkedSessions: 0,
    backfilledUrls: 0,
    errors: []
};

/**
 * Parse timestamp from gaze image filename
 * Format: gaze-{timestamp}-{random}.png
 */
function parseImageTimestamp(filename) {
    const match = filename.match(/^gaze-(\d+)-\d+\.png$/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Inventory all physical gaze image files
 */
function inventoryPhysicalImages() {
    console.log('\n📁 STEP 1: Inventorying Physical Images');
    console.log('='.repeat(70));
    
    if (!fs.existsSync(GAZE_UPLOADS_DIR)) {
        console.error(`❌ Gaze uploads directory not found: ${GAZE_UPLOADS_DIR}`);
        return [];
    }

    const files = fs.readdirSync(GAZE_UPLOADS_DIR)
        .filter(f => f.match(/^gaze-\d+-\d+\.png$/))
        .map(filename => {
            const filepath = path.join(GAZE_UPLOADS_DIR, filename);
            const fileStats = fs.statSync(filepath);
            const timestamp = parseImageTimestamp(filename);
            
            return {
                filename,
                filepath,
                urlPath: `/uploads/gaze/${filename}`,
                timestamp,
                createdAt: fileStats.birthtime,
                size: fileStats.size,
                claimed: false
            };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

    stats.totalPhysicalImages = files.length;
    console.log(`✅ Found ${files.length} gaze images in storage`);
    
    if (files.length > 0) {
        console.log(`📅 Date range: ${new Date(files[0].timestamp).toLocaleString()} → ${new Date(files[files.length - 1].timestamp).toLocaleString()}`);
    }
    
    return files;
}

/**
 * Fetch all Live Gaze guest screening sessions
 */
async function fetchLiveGazeSessions() {
    console.log('\n🔍 STEP 2: Scanning Database for Live Gaze Sessions');
    console.log('='.repeat(70));
    
    const sessions = await GazeSession.find({
        $or: [
            { module: 'live_gaze' },
            { sessionType: 'guest_screening' },
            { source: 'live_gaze_analysis' },
            { isGuest: true }
        ]
    }).sort({ startTime: 1 });

    stats.totalLiveGazeSessions = sessions.length;
    
    console.log(`✅ Found ${sessions.length} Live Gaze sessions`);
    
    const withImages = sessions.filter(s => s.snapshots && s.snapshots.length > 0);
    const withoutImages = sessions.filter(s => !s.snapshots || s.snapshots.length === 0);
    
    stats.sessionsWithImages = withImages.length;
    stats.sessionsWithoutImages = withoutImages.length;
    
    console.log(`   ✓ ${withImages.length} sessions have images`);
    console.log(`   ⚠️  ${withoutImages.length} sessions are missing images`);
    
    return { sessions, withImages, withoutImages };
}

/**
 * Mark images that are already claimed by sessions
 */
function markClaimedImages(sessions, imageInventory) {
    console.log('\n🔗 STEP 3: Identifying Already-Linked Images');
    console.log('='.repeat(70));
    
    let claimedCount = 0;
    
    for (const session of sessions) {
        if (!session.snapshots || session.snapshots.length === 0) continue;
        
        for (const snapshot of session.snapshots) {
            const image = imageInventory.find(img => img.urlPath === snapshot.imagePath);
            if (image && !image.claimed) {
                image.claimed = true;
                image.claimedBy = session._id.toString();
                claimedCount++;
            }
        }
    }
    
    const orphanedCount = imageInventory.filter(img => !img.claimed).length;
    stats.orphanedImages = orphanedCount;
    
    console.log(`✅ ${claimedCount} images already correctly linked`);
    console.log(`⚠️  ${orphanedCount} orphaned images need recovery`);
    
    return imageInventory.filter(img => !img.claimed);
}

/**
 * Match orphaned images to sessions using timestamp correlation
 */
function matchImagesToSessions(orphanedImages, sessionsWithoutImages) {
    console.log('\n🔬 STEP 4: Matching Orphaned Images to Sessions');
    console.log('='.repeat(70));
    
    const matches = [];
    
    for (const session of sessionsWithoutImages) {
        const sessionStart = new Date(session.startTime).getTime();
        const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : Date.now();
        
        // Find images within the session timeframe (with tolerance)
        const candidateImages = orphanedImages.filter(img => {
            if (!img.timestamp) return false;
            return img.timestamp >= (sessionStart - TIMESTAMP_TOLERANCE_MS) &&
                   img.timestamp <= (sessionEnd + TIMESTAMP_TOLERANCE_MS);
        });
        
        if (candidateImages.length > 0) {
            matches.push({
                session,
                images: candidateImages,
                confidence: candidateImages.length > 0 ? 'high' : 'low'
            });
            
            console.log(`✓ Session ${session._id.toString().substring(0, 8)}... matched ${candidateImages.length} images`);
            console.log(`  📅 Session: ${new Date(sessionStart).toLocaleString()}`);
            console.log(`  🎯 Guest: ${session.guestInfo?.email || 'N/A'}`);
        }
    }
    
    stats.matchedImages = matches.reduce((sum, m) => sum + m.images.length, 0);
    console.log(`\n✅ Matched ${stats.matchedImages} images to ${matches.length} sessions`);
    
    return matches;
}

/**
 * Re-link orphaned images to their correct sessions
 */
async function relinkImages(matches) {
    console.log('\n💾 STEP 5: Re-linking Images to Sessions');
    console.log('='.repeat(70));
    
    for (const match of matches) {
        try {
            const { session, images } = match;
            
            // Build snapshot objects
            const newSnapshots = images.map(img => ({
                imagePath: img.urlPath,
                timestamp: new Date(img.timestamp),
                attentionScore: 0,
                gazeDirection: 'recovered',
                status: 'recovered',
                notes: 'Recovered by image recovery script'
            }));
            
            // Update session with recovered images
            session.snapshots = session.snapshots || [];
            session.snapshots.push(...newSnapshots);
            
            // Ensure proper metadata
            session.module = session.module || 'live_gaze';
            session.sessionType = session.sessionType || 'guest_screening';
            session.source = session.source || 'live_gaze_analysis';
            
            // Update status if needed
            if (session.status === 'active' || session.status === 'completed') {
                session.status = 'pending_review';
            }
            
            await session.save();
            
            stats.relinkedSessions++;
            console.log(`✅ Relinked ${newSnapshots.length} images to session ${session._id.toString().substring(0, 8)}...`);
            
        } catch (err) {
            const error = `Failed to relink images to session ${session._id}: ${err.message}`;
            stats.errors.push(error);
            console.error(`❌ ${error}`);
        }
    }
    
    console.log(`\n✅ Successfully relinked ${stats.relinkedSessions} sessions`);
}

/**
 * Backfill missing image URLs for sessions with broken paths
 */
async function backfillImageUrls(sessions, imageInventory) {
    console.log('\n🔧 STEP 6: Backfilling Missing Image URLs');
    console.log('='.repeat(70));
    
    let backfilledCount = 0;
    
    for (const session of sessions) {
        if (!session.snapshots || session.snapshots.length === 0) continue;
        
        let modified = false;
        
        for (let i = 0; i < session.snapshots.length; i++) {
            const snapshot = session.snapshots[i];
            
            // Check if imagePath is broken or missing
            if (!snapshot.imagePath || !snapshot.imagePath.startsWith('/uploads/gaze/')) {
                // Try to find by timestamp
                if (snapshot.timestamp) {
                    const timestamp = new Date(snapshot.timestamp).getTime();
                    const matchingImage = imageInventory.find(img => 
                        Math.abs(img.timestamp - timestamp) < 5000 // 5 second tolerance
                    );
                    
                    if (matchingImage) {
                        session.snapshots[i].imagePath = matchingImage.urlPath;
                        modified = true;
                        backfilledCount++;
                        console.log(`  ✓ Backfilled URL for snapshot in session ${session._id.toString().substring(0, 8)}...`);
                    }
                }
            }
        }
        
        if (modified) {
            try {
                await session.save();
            } catch (err) {
                console.error(`❌ Error saving backfilled session ${session._id}: ${err.message}`);
            }
        }
    }
    
    stats.backfilledUrls = backfilledCount;
    console.log(`✅ Backfilled ${backfilledCount} image URLs`);
}

/**
 * Validate recovery - ensure no session is missing images if images exist
 */
async function validateRecovery() {
    console.log('\n✅ STEP 7: Validating Recovery');
    console.log('='.repeat(70));
    
    const sessions = await GazeSession.find({
        $or: [
            { module: 'live_gaze' },
            { sessionType: 'guest_screening' },
            { source: 'live_gaze_analysis' }
        ]
    });
    
    const stillMissing = sessions.filter(s => !s.snapshots || s.snapshots.length === 0);
    
    if (stillMissing.length === 0) {
        console.log('🎉 SUCCESS! All Live Gaze sessions have images!');
        return true;
    } else {
        console.log(`⚠️  Warning: ${stillMissing.length} sessions still missing images:`);
        stillMissing.forEach(s => {
            console.log(`   - Session ${s._id.toString().substring(0, 8)}...`);
            console.log(`     Date: ${new Date(s.startTime).toLocaleString()}`);
            console.log(`     Guest: ${s.guestInfo?.email || 'N/A'}`);
        });
        return false;
    }
}

/**
 * Print final recovery report
 */
function printReport() {
    console.log('\n📊 RECOVERY REPORT');
    console.log('='.repeat(70));
    console.log(`Total Live Gaze Sessions:        ${stats.totalLiveGazeSessions}`);
    console.log(`  ├─ With Images:                 ${stats.sessionsWithImages}`);
    console.log(`  └─ Without Images (before):     ${stats.sessionsWithoutImages}`);
    console.log(`\nPhysical Images in Storage:      ${stats.totalPhysicalImages}`);
    console.log(`  ├─ Already Linked:              ${stats.totalPhysicalImages - stats.orphanedImages}`);
    console.log(`  └─ Orphaned (before):           ${stats.orphanedImages}`);
    console.log(`\nRecovery Actions:`);
    console.log(`  ├─ Images Matched:              ${stats.matchedImages}`);
    console.log(`  ├─ Sessions Relinked:           ${stats.relinkedSessions}`);
    console.log(`  └─ URLs Backfilled:             ${stats.backfilledUrls}`);
    
    if (stats.errors.length > 0) {
        console.log(`\n⚠️  Errors Encountered: ${stats.errors.length}`);
        stats.errors.forEach((err, i) => {
            console.log(`   ${i + 1}. ${err}`);
        });
    }
    
    console.log('\n' + '='.repeat(70));
}

/**
 * Main recovery process
 */
async function runRecovery() {
    console.log('\n🚀 LIVE GAZE IMAGE RECOVERY SYSTEM');
    console.log('='.repeat(70));
    console.log('Starting comprehensive database repair...\n');
    
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to database\n');
        
        // Step 1: Inventory physical images
        const imageInventory = inventoryPhysicalImages();
        
        // Step 2: Fetch all Live Gaze sessions
        const { sessions, withImages, withoutImages } = await fetchLiveGazeSessions();
        
        // Step 3: Mark already-claimed images
        const orphanedImages = markClaimedImages(sessions, imageInventory);
        
        // Step 4: Match orphaned images to sessions
        const matches = matchImagesToSessions(orphanedImages, withoutImages);
        
        // Step 5: Re-link images to sessions
        if (matches.length > 0) {
            await relinkImages(matches);
        } else {
            console.log('\n⚠️  No orphaned images to relink');
        }
        
        // Step 6: Backfill missing URLs
        await backfillImageUrls(sessions, imageInventory);
        
        // Step 7: Validate recovery
        const success = await validateRecovery();
        
        // Print final report
        printReport();
        
        if (success) {
            console.log('\n✅ RECOVERY COMPLETED SUCCESSFULLY!\n');
        } else {
            console.log('\n⚠️  Recovery completed with warnings. Review output above.\n');
        }
        
    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error(error.stack);
        stats.errors.push(`Fatal: ${error.message}`);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from database\n');
    }
}

// Run the recovery
if (require.main === module) {
    runRecovery().catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
}

module.exports = { runRecovery };
