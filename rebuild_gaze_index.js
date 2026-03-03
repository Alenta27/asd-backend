/**
 * LIVE GAZE REVIEW INDEX REBUILD
 * 
 * This script performs a complete index rebuild for the Therapist Live Gaze Review system.
 * It directly queries the raw database, ignores all filters, and resets broken flags.
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const GazeSession = require('./models/GazeSession');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/asd_db';

const stats = {
    totalSessions: 0,
    liveGazeSessions: 0,
    fixed: {
        nullStatus: 0,
        archivedStatus: 0,
        liveStatus: 0,
        activeStatus: 0,
        completedStatus: 0,
        missingModule: 0,
        missingSessionType: 0
    },
    beforeStatusBreakdown: {},
    afterStatusBreakdown: {},
    excluded: [],
    included: []
};

/**
 * Query ALL sessions - no filters
 */
async function queryAllSessions() {
    console.log('\n🔍 STEP 1: Querying Raw Database (NO FILTERS)');
    console.log('='.repeat(70));
    console.log('SELECT * FROM gaze_sessions WHERE module = "live_gaze";\n');
    
    const allSessions = await GazeSession.find({}).sort({ createdAt: -1 });
    stats.totalSessions = allSessions.length;
    
    console.log(`✅ Found ${allSessions.length} total sessions in database`);
    
    // Identify Live Gaze sessions (any session that should be in review)
    const liveGazeSessions = allSessions.filter(s => 
        s.module === 'live_gaze' ||
        s.sessionType === 'guest_screening' ||
        s.source === 'live_gaze_analysis' ||
        s.isGuest === true ||
        s.guestInfo?.email
    );
    
    stats.liveGazeSessions = liveGazeSessions.length;
    console.log(`🎯 Identified ${liveGazeSessions.length} Live Gaze sessions`);
    
    // Analyze status breakdown BEFORE fixing
    console.log('\n📊 Status Breakdown (BEFORE):');
    const statusCounts = {};
    liveGazeSessions.forEach(s => {
        const status = s.status || 'NULL';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    stats.beforeStatusBreakdown = statusCounts;
    
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} sessions`);
    });
    
    return liveGazeSessions;
}

/**
 * Reset incorrect status flags
 */
async function resetStatusFlags(sessions) {
    console.log('\n🔧 STEP 2: Resetting Incorrect Status Flags');
    console.log('='.repeat(70));
    
    const problematicStatuses = ['archived', 'live', 'active', 'completed', null, undefined];
    
    for (const session of sessions) {
        let modified = false;
        const originalStatus = session.status;
        
        // Fix NULL status
        if (!session.status) {
            session.status = 'pending_review';
            stats.fixed.nullStatus++;
            modified = true;
            console.log(`✓ Fixed NULL status for session ${session._id.toString().substring(0, 8)}...`);
        }
        // Fix archived status
        else if (session.status === 'archived') {
            session.status = 'pending_review';
            stats.fixed.archivedStatus++;
            modified = true;
            console.log(`✓ Fixed 'archived' status for session ${session._id.toString().substring(0, 8)}...`);
        }
        // Fix live status
        else if (session.status === 'live') {
            session.status = 'pending_review';
            stats.fixed.liveStatus++;
            modified = true;
            console.log(`✓ Fixed 'live' status for session ${session._id.toString().substring(0, 8)}...`);
        }
        // Fix active status (should be pending_review if has snapshots)
        else if (session.status === 'active' && session.snapshots && session.snapshots.length > 0) {
            session.status = 'pending_review';
            stats.fixed.activeStatus++;
            modified = true;
            console.log(`✓ Fixed 'active' → 'pending_review' for session ${session._id.toString().substring(0, 8)}... (has ${session.snapshots.length} photos)`);
        }
        // Fix completed status (should be pending_review)
        else if (session.status === 'completed') {
            session.status = 'pending_review';
            stats.fixed.completedStatus++;
            modified = true;
            console.log(`✓ Fixed 'completed' → 'pending_review' for session ${session._id.toString().substring(0, 8)}...`);
        }
        
        // Fix missing module
        if (!session.module || session.module !== 'live_gaze') {
            session.module = 'live_gaze';
            stats.fixed.missingModule++;
            modified = true;
        }
        
        // Fix missing sessionType for guest sessions
        if (session.isGuest && (!session.sessionType || session.sessionType !== 'guest_screening')) {
            session.sessionType = 'guest_screening';
            stats.fixed.missingSessionType++;
            modified = true;
        }
        
        // Ensure source is set
        if (!session.source) {
            session.source = 'live_gaze_analysis';
            modified = true;
        }
        
        if (modified) {
            await session.save();
            console.log(`   📝 Session ${session._id.toString().substring(0, 8)}... saved`);
            console.log(`      Before: status=${originalStatus}, module=${session.module}, type=${session.sessionType}`);
            console.log(`      After:  status=${session.status}, module=${session.module}, type=${session.sessionType}`);
        }
    }
    
    const totalFixed = stats.fixed.nullStatus + stats.fixed.archivedStatus + 
                      stats.fixed.liveStatus + stats.fixed.activeStatus + 
                      stats.fixed.completedStatus;
    
    console.log(`\n✅ Fixed ${totalFixed} status flags`);
    console.log(`   - NULL → pending_review: ${stats.fixed.nullStatus}`);
    console.log(`   - archived → pending_review: ${stats.fixed.archivedStatus}`);
    console.log(`   - live → pending_review: ${stats.fixed.liveStatus}`);
    console.log(`   - active → pending_review: ${stats.fixed.activeStatus}`);
    console.log(`   - completed → pending_review: ${stats.fixed.completedStatus}`);
    console.log(`   - Missing module: ${stats.fixed.missingModule}`);
    console.log(`   - Missing sessionType: ${stats.fixed.missingSessionType}`);
}

/**
 * Verify image attachments
 */
async function verifyImageAttachments(sessions) {
    console.log('\n🖼️  STEP 3: Verifying Image Attachments');
    console.log('='.repeat(70));
    
    const withImages = sessions.filter(s => s.snapshots && s.snapshots.length > 0);
    const withoutImages = sessions.filter(s => !s.snapshots || s.snapshots.length === 0);
    
    console.log(`✅ Sessions with images: ${withImages.length}`);
    console.log(`⚠️  Sessions without images: ${withoutImages.length}`);
    
    if (withoutImages.length > 0) {
        console.log('\n⚠️  Sessions missing images:');
        withoutImages.forEach(s => {
            console.log(`   - ${s._id.toString().substring(0, 8)}... (${new Date(s.createdAt).toLocaleString()})`);
            console.log(`     Guest: ${s.guestInfo?.email || 'N/A'}, Status: ${s.status}`);
        });
    }
    
    // Verify image paths
    let brokenPaths = 0;
    for (const session of withImages) {
        for (const snapshot of session.snapshots) {
            if (!snapshot.imagePath || !snapshot.imagePath.startsWith('/uploads/')) {
                brokenPaths++;
                console.log(`⚠️  Broken image path in session ${session._id.toString().substring(0, 8)}...: ${snapshot.imagePath}`);
            }
        }
    }
    
    if (brokenPaths === 0) {
        console.log('✅ All image paths are valid');
    } else {
        console.log(`⚠️  Found ${brokenPaths} broken image paths`);
    }
}

/**
 * Test the rebuilt query
 */
async function testRebuiltQuery() {
    console.log('\n✅ STEP 4: Testing Rebuilt Review Query');
    console.log('='.repeat(70));
    console.log('Query: module="live_gaze" + has snapshots\n');
    
    // The EXACT query that will be used in the API
    const reviewSessions = await GazeSession.find({
        module: 'live_gaze',
        snapshots: { $exists: true, $not: { $size: 0 } }
    }).sort({ createdAt: -1 });
    
    stats.included = reviewSessions;
    console.log(`✅ Query returned ${reviewSessions.length} sessions`);
    
    if (reviewSessions.length > 0) {
        console.log('\n📋 Sample Sessions:');
        reviewSessions.slice(0, 5).forEach((s, i) => {
            console.log(`   ${i + 1}. Session ${s._id.toString().substring(0, 8)}...`);
            console.log(`      Date: ${new Date(s.createdAt).toLocaleString()}`);
            console.log(`      Guest: ${s.guestInfo?.email || 'N/A'}`);
            console.log(`      Photos: ${s.snapshots?.length || 0}`);
            console.log(`      Status: ${s.status}`);
        });
    }
    
    // Find sessions that should be included but aren't
    const allLiveGaze = await GazeSession.find({
        $or: [
            { module: 'live_gaze' },
            { sessionType: 'guest_screening' },
            { isGuest: true }
        ]
    });
    
    const excluded = allLiveGaze.filter(s => 
        !reviewSessions.find(r => r._id.toString() === s._id.toString())
    );
    
    stats.excluded = excluded;
    
    if (excluded.length > 0) {
        console.log(`\n⚠️  ${excluded.length} sessions excluded from review:`);
        excluded.forEach(s => {
            const reasons = [];
            if (s.module !== 'live_gaze') reasons.push(`module=${s.module || 'NULL'}`);
            if (s.sessionType !== 'guest_screening') reasons.push(`type=${s.sessionType || 'NULL'}`);
            if (s.status !== 'pending_review') reasons.push(`status=${s.status || 'NULL'}`);
            if (!s.snapshots || s.snapshots.length === 0) reasons.push('no photos');
            
            console.log(`   - ${s._id.toString().substring(0, 8)}... EXCLUDED: ${reasons.join(', ')}`);
            console.log(`     Guest: ${s.guestInfo?.email || 'N/A'}, Date: ${new Date(s.createdAt).toLocaleDateString()}`);
        });
    } else {
        console.log('\n✅ All Live Gaze sessions are included in review!');
    }
}

/**
 * Print final report
 */
function printReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 INDEX REBUILD REPORT');
    console.log('='.repeat(70));
    
    console.log(`\nDatabase Status:`);
    console.log(`  Total Sessions:              ${stats.totalSessions}`);
    console.log(`  Live Gaze Sessions:          ${stats.liveGazeSessions}`);
    
    console.log(`\nStatus Changes:`);
    console.log(`  NULL → pending_review:       ${stats.fixed.nullStatus}`);
    console.log(`  archived → pending_review:   ${stats.fixed.archivedStatus}`);
    console.log(`  live → pending_review:       ${stats.fixed.liveStatus}`);
    console.log(`  active → pending_review:     ${stats.fixed.activeStatus}`);
    console.log(`  completed → pending_review:  ${stats.fixed.completedStatus}`);
    
    console.log(`\nMetadata Fixed:`);
    console.log(`  Missing module field:        ${stats.fixed.missingModule}`);
    console.log(`  Missing sessionType field:   ${stats.fixed.missingSessionType}`);
    
    console.log(`\nReview Query Results:`);
    console.log(`  Sessions INCLUDED:           ${stats.included.length}`);
    console.log(`  Sessions EXCLUDED:           ${stats.excluded.length}`);
    
    if (stats.excluded.length > 0) {
        console.log(`\n⚠️  Exclusion Reasons:`);
        const reasons = {};
        stats.excluded.forEach(s => {
            const reason = [];
            if (s.module !== 'live_gaze') reason.push('wrong_module');
            if (s.sessionType !== 'guest_screening') reason.push('wrong_type');
            if (s.status !== 'pending_review') reason.push('wrong_status');
            if (!s.snapshots || s.snapshots.length === 0) reason.push('no_photos');
            const key = reason.join('+') || 'unknown';
            reasons[key] = (reasons[key] || 0) + 1;
        });
        Object.entries(reasons).forEach(([reason, count]) => {
            console.log(`    ${reason}: ${count}`);
        });
    }
    
    console.log('\n' + '='.repeat(70));
}

/**
 * Main rebuild process
 */
async function rebuildIndex() {
    console.log('\n🚀 LIVE GAZE REVIEW INDEX REBUILD');
    console.log('='.repeat(70));
    console.log('Rebuilding Therapist Live Gaze Review system...\n');
    
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to database\n');
        
        // Step 1: Query all sessions (no filters)
        const sessions = await queryAllSessions();
        
        // Step 2: Reset incorrect status flags
        await resetStatusFlags(sessions);
        
        // Step 3: Verify image attachments
        await verifyImageAttachments(sessions);
        
        // Step 4: Test rebuilt query
        await testRebuiltQuery();
        
        // Print final report
        printReport();
        
        console.log('\n✅ INDEX REBUILD COMPLETED!\n');
        console.log('💡 Next Steps:');
        console.log('   1. Restart backend server');
        console.log('   2. Test Therapist Live Gaze Review tab');
        console.log('   3. All historical sessions should now be visible\n');
        
    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from database\n');
    }
}

// Run the rebuild
if (require.main === module) {
    rebuildIndex().catch(err => {
        console.error('Unhandled error:', err);
        process.exit(1);
    });
}

module.exports = { rebuildIndex };
