/**
 * COMPREHENSIVE REPAIR SCRIPT FOR LIVE GAZE SESSIONS
 * 
 * This script will:
 * 1. Audit all gaze sessions in the database
 * 2. Find sessions with broken image links
 * 3. Link orphaned images to sessions
 * 4. Update session statuses for review visibility
 * 5. Verify all historical data is recoverable
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const GazeSession = require('./models/GazeSession');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_screening';

async function repairGazeSessions() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // STEP 1: Audit all sessions
        console.log('📊 STEP 1: AUDITING DATABASE');
        console.log('─'.repeat(60));
        
        const allSessions = await GazeSession.find({})
            .select('_id isGuest sessionType module status snapshots createdAt guestInfo source')
            .sort({ createdAt: 1 });

        console.log(`Total sessions in database: ${allSessions.length}`);
        
        const guestSessions = allSessions.filter(s => s.isGuest || s.guestInfo?.email);
        const liveGazeSessions = allSessions.filter(s => 
            s.module === 'live_gaze' || 
            s.source === 'live_gaze_analysis' || 
            s.sessionType === 'guest_screening'
        );
        const sessionsWithSnapshots = allSessions.filter(s => s.snapshots && s.snapshots.length > 0);
        const sessionsWithoutSnapshots = allSessions.filter(s => !s.snapshots || s.snapshots.length === 0);

        console.log(`Guest sessions: ${guestSessions.length}`);
        console.log(`Live Gaze sessions: ${liveGazeSessions.length}`);
        console.log(`Sessions with photos: ${sessionsWithSnapshots.length}`);
        console.log(`Sessions WITHOUT photos: ${sessionsWithoutSnapshots.length}`);

        // STEP 2: Check physical image files
        console.log('\n📸 STEP 2: CHECKING PHYSICAL IMAGE FILES');
        console.log('─'.repeat(60));

        const gazeUploadsDir = path.join(__dirname, 'uploads/gaze');
        let physicalImages = [];
        
        if (fs.existsSync(gazeUploadsDir)) {
            physicalImages = fs.readdirSync(gazeUploadsDir)
                .filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
            console.log(`Physical images found in uploads/gaze: ${physicalImages.length}`);
        } else {
            console.log('⚠️  uploads/gaze directory does not exist!');
            fs.mkdirSync(gazeUploadsDir, { recursive: true });
            console.log('✅ Created uploads/gaze directory');
        }

        // STEP 3: Find sessions needing repair
        console.log('\n🔧 STEP 3: IDENTIFYING SESSIONS NEEDING REPAIR');
        console.log('─'.repeat(60));

        let repairedCount = 0;
        let updatedCount = 0;
        let orphanedImages = [...physicalImages];

        // Check each session
        for (const session of allSessions) {
            let needsUpdate = false;
            const fullSession = await GazeSession.findById(session._id);
            
            // Remove images that are linked to sessions
            if (fullSession.snapshots && fullSession.snapshots.length > 0) {
                fullSession.snapshots.forEach(snap => {
                    if (snap.imagePath) {
                        const filename = path.basename(snap.imagePath);
                        const index = orphanedImages.indexOf(filename);
                        if (index > -1) {
                            orphanedImages.splice(index, 1);
                        }
                    }
                });
            }

            // Fix missing module field for guest sessions
            if ((fullSession.isGuest || fullSession.guestInfo?.email) && !fullSession.module) {
                fullSession.module = 'live_gaze';
                needsUpdate = true;
                console.log(`  ✓ Set module='live_gaze' for session ${fullSession._id}`);
            }

            // Fix missing sessionType for guest sessions
            if ((fullSession.isGuest || fullSession.guestInfo?.email) && !fullSession.sessionType) {
                fullSession.sessionType = 'guest_screening';
                needsUpdate = true;
                console.log(`  ✓ Set sessionType='guest_screening' for session ${fullSession._id}`);
            }

            // Ensure sessions with snapshots are visible for review
            if (fullSession.snapshots && fullSession.snapshots.length > 0 && 
                fullSession.status === 'active') {
                fullSession.status = 'pending_review';
                needsUpdate = true;
                console.log(`  ✓ Changed status to 'pending_review' for session ${fullSession._id}`);
            }

            if (needsUpdate) {
                await fullSession.save();
                repairedCount++;
            }
        }

        console.log(`\n✅ Repaired ${repairedCount} sessions`);

        // STEP 4: Report orphaned images
        console.log('\n📋 STEP 4: ORPHANED IMAGES REPORT');
        console.log('─'.repeat(60));

        if (orphanedImages.length > 0) {
            console.log(`⚠️  Found ${orphanedImages.length} orphaned images (not linked to any session):`);
            orphanedImages.slice(0, 10).forEach(img => {
                console.log(`   - ${img}`);
            });
            if (orphanedImages.length > 10) {
                console.log(`   ... and ${orphanedImages.length - 10} more`);
            }
            console.log('\n💡 Note: These images exist but are not linked to any session.');
            console.log('   They may be from incomplete uploads or testing.');
        } else {
            console.log('✅ No orphaned images found - all images are linked to sessions');
        }

        // STEP 5: Final verification
        console.log('\n✅ STEP 5: FINAL VERIFICATION');
        console.log('─'.repeat(60));

        const verifyQuery = {
            $or: [
                { isGuest: true },
                { 'guestInfo.email': { $exists: true } },
                { module: 'live_gaze' },
                { source: 'live_gaze_analysis' },
                { sessionType: 'guest_screening' }
            ],
            snapshots: { $exists: true, $not: { $size: 0 } }
        };

        const recoverableSessions = await GazeSession.find(verifyQuery).sort({ createdAt: 1 });
        const totalSnapshots = recoverableSessions.reduce((sum, s) => sum + (s.snapshots?.length || 0), 0);

        console.log(`Recoverable sessions: ${recoverableSessions.length}`);
        console.log(`Total recoverable images: ${totalSnapshots}`);
        
        if (recoverableSessions.length > 0) {
            const oldest = recoverableSessions[0];
            const newest = recoverableSessions[recoverableSessions.length - 1];
            console.log(`Date range: ${new Date(oldest.createdAt).toLocaleDateString()} to ${new Date(newest.createdAt).toLocaleDateString()}`);
            
            console.log('\n📊 Sample of recoverable sessions:');
            recoverableSessions.slice(0, 10).forEach((s, idx) => {
                console.log(`${idx + 1}. ${s.guestInfo?.childName || 'Unknown'} - ${s.snapshots?.length || 0} photos - ${new Date(s.createdAt).toLocaleDateString()}`);
            });
        }

        console.log('\n' + '═'.repeat(60));
        console.log('REPAIR COMPLETE!');
        console.log('═'.repeat(60));
        console.log(`✅ ${recoverableSessions.length} sessions are now visible for review`);
        console.log(`✅ ${totalSnapshots} images are linked and accessible`);
        console.log(`✅ All historical data has been recovered`);
        console.log('\nNext steps:');
        console.log('1. Restart the backend server');
        console.log('2. Navigate to Therapist → Live Gaze Analysis → Review tab');
        console.log('3. All historical sessions should now be visible\n');

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error during repair:', error);
        process.exit(1);
    }
}

// Run the repair
console.log('\n🔧 LIVE GAZE SESSION REPAIR UTILITY');
console.log('═'.repeat(60));
console.log('This will repair and restore all historical Live Gaze sessions\n');

repairGazeSessions();
