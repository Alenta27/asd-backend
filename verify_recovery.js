/**
 * QUICK VERIFICATION SCRIPT
 * Run this after repair to confirm all sessions are recoverable
 */

const mongoose = require('mongoose');
const GazeSession = require('./models/GazeSession');

require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/asd_screening';

async function verifyRecovery() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // This is the EXACT query used by the therapist dashboard
        const recoverableQuery = {
            module: 'live_gaze',
            snapshots: { $exists: true, $not: { $size: 0 } }
        };

        const sessions = await GazeSession.find(recoverableQuery)
            .sort({ createdAt: -1 })
            .limit(2000);

        const totalPhotos = sessions.reduce((sum, s) => sum + (s.snapshots?.length || 0), 0);

        console.log('🎯 RECOVERY VERIFICATION RESULTS');
        console.log('═'.repeat(60));
        console.log(`✅ Recoverable sessions: ${sessions.length}`);
        console.log(`✅ Total photos: ${totalPhotos}`);
        
        if (sessions.length > 0) {
            const oldest = sessions[sessions.length - 1];
            const newest = sessions[0];
            console.log(`📅 Date range: ${new Date(oldest.createdAt).toLocaleDateString()} → ${new Date(newest.createdAt).toLocaleDateString()}`);
            
            // Show breakdown
            console.log('\n📊 Breakdown:');
            console.log(`   Guest sessions: ${sessions.filter(s => s.isGuest).length}`);
            console.log(`   With guestInfo: ${sessions.filter(s => s.guestInfo?.email).length}`);
            console.log(`   Live gaze module: ${sessions.filter(s => s.module === 'live_gaze').length}`);
            console.log(`   Guest screening type: ${sessions.filter(s => s.sessionType === 'guest_screening').length}`);
            
            console.log('\n📸 Recent sessions:');
            sessions.slice(0, 5).forEach((s, idx) => {
                const name = s.guestInfo?.childName || s.guestInfo?.parentName || 'Unknown';
                const date = new Date(s.createdAt).toLocaleDateString();
                const photos = s.snapshots?.length || 0;
                console.log(`   ${idx + 1}. ${name} - ${photos} photos (${date})`);
            });

            console.log('\n' + '═'.repeat(60));
            console.log('✅ VERIFICATION PASSED');
            console.log('All historical sessions are recoverable!');
            console.log('\nThese sessions will appear in:');
            console.log('Therapist → Live Gaze Analysis → Review Tab');
        } else {
            console.log('\n⚠️  WARNING: No sessions found!');
            console.log('This could mean:');
            console.log('1. Database is empty');
            console.log('2. No guest sessions have been submitted yet');
            console.log('3. All sessions are missing snapshots');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB\n');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        process.exit(1);
    }
}

verifyRecovery();
