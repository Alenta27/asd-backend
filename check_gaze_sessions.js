const mongoose = require('mongoose');
const GazeSession = require('./models/GazeSession');

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_screening';

async function checkGazeSessions() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Get all sessions
        const allSessions = await GazeSession.find({})
            .select('_id isGuest sessionType module status snapshots createdAt guestInfo.childName source')
            .sort({ createdAt: -1 })
            .limit(50);

        console.log('\n📊 Database Summary:');
        console.log(`Total sessions found: ${allSessions.length}`);
        
        const withPhotos = allSessions.filter(s => s.snapshots && s.snapshots.length > 0);
        console.log(`Sessions with photos: ${withPhotos.length}`);
        console.log(`Total photos: ${allSessions.reduce((sum, s) => sum + (s.snapshots?.length || 0), 0)}`);

        console.log('\n📋 Breakdown by status:');
        const statuses = {};
        allSessions.forEach(s => {
            statuses[s.status] = (statuses[s.status] || 0) + 1;
        });
        Object.entries(statuses).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
        });

        console.log('\n📸 Recent sessions with photos:');
        withPhotos.slice(0, 10).forEach((session, idx) => {
            console.log(`\n${idx + 1}. Session ID: ${session._id}`);
            console.log(`   Type: ${session.isGuest ? 'Guest' : 'Patient'}`);
            console.log(`   Name: ${session.guestInfo?.childName || 'N/A'}`);
            console.log(`   Module: ${session.module || 'Not set'}`);
            console.log(`   Session Type: ${session.sessionType || 'Not set'}`);
            console.log(`   Source: ${session.source || 'Not set'}`);
            console.log(`   Status: ${session.status}`);
            console.log(`   Photos: ${session.snapshots.length}`);
            console.log(`   Date: ${new Date(session.createdAt).toLocaleString()}`);
            
            // Show first photo path
            if (session.snapshots.length > 0) {
                console.log(`   First photo: ${session.snapshots[0].imagePath}`);
            }
        });

        console.log('\n🔍 Sessions by module:');
        const modules = {};
        allSessions.forEach(s => {
            const module = s.module || 'undefined';
            modules[module] = (modules[module] || 0) + 1;
        });
        Object.entries(modules).forEach(([module, count]) => {
            console.log(`  ${module}: ${count}`);
        });

        console.log('\n🔍 Guest sessions by sessionType:');
        const guestSessions = allSessions.filter(s => s.isGuest);
        const sessionTypes = {};
        guestSessions.forEach(s => {
            const type = s.sessionType || 'undefined';
            sessionTypes[type] = (sessionTypes[type] || 0) + 1;
        });
        Object.entries(sessionTypes).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkGazeSessions();
