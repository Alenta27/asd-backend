/**
 * FILESYSTEM IMAGE DIAGNOSTIC
 * 
 * This script analyzes physical gaze images in storage WITHOUT requiring MongoDB.
 * Use this to understand what images exist before running the full recovery.
 */

const fs = require('fs');
const path = require('path');

const GAZE_UPLOADS_DIR = path.join(__dirname, 'uploads', 'gaze');

/**
 * Parse timestamp from gaze image filename
 */
function parseImageTimestamp(filename) {
    const match = filename.match(/^gaze-(\d+)-\d+\.png$/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Analyze image files
 */
function analyzeImages() {
    console.log('\n📁 GAZE IMAGE FILESYSTEM ANALYSIS');
    console.log('='.repeat(70));
    
    if (!fs.existsSync(GAZE_UPLOADS_DIR)) {
        console.error(`❌ Gaze uploads directory not found: ${GAZE_UPLOADS_DIR}`);
        console.log('\nExpected location: backend/uploads/gaze/');
        return;
    }

    const files = fs.readdirSync(GAZE_UPLOADS_DIR)
        .filter(f => f.match(/^gaze-\d+-\d+\.(png|jpg|jpeg)$/i));

    if (files.length === 0) {
        console.log('⚠️  No gaze images found in storage');
        console.log(`Directory: ${GAZE_UPLOADS_DIR}`);
        return;
    }

    // Parse and sort images
    const images = files.map(filename => {
        const filepath = path.join(GAZE_UPLOADS_DIR, filename);
        const stats = fs.statSync(filepath);
        const timestamp = parseImageTimestamp(filename);
        
        return {
            filename,
            timestamp,
            date: timestamp ? new Date(timestamp) : null,
            fileCreated: stats.birthtime,
            size: stats.size,
            sizeMB: (stats.size / 1024 / 1024).toFixed(2)
        };
    }).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    console.log(`✅ Found ${images.length} gaze images\n`);

    // Statistics
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    const withTimestamps = images.filter(img => img.timestamp !== null);
    const oldest = withTimestamps[0];
    const newest = withTimestamps[withTimestamps.length - 1];
    
    console.log('📊 Storage Statistics:');
    console.log(`   Total Images:      ${images.length}`);
    console.log(`   Total Size:        ${totalSizeMB} MB`);
    console.log(`   Average Size:      ${(totalSize / images.length / 1024).toFixed(2)} KB`);
    console.log(`   Parseable Names:   ${withTimestamps.length}`);
    
    if (oldest && newest) {
        console.log(`\n📅 Date Range:`);
        console.log(`   Oldest:  ${oldest.date.toLocaleString()} (${oldest.filename})`);
        console.log(`   Newest:  ${newest.date.toLocaleString()} (${newest.filename})`);
        
        const daySpan = Math.ceil((newest.timestamp - oldest.timestamp) / (1000 * 60 * 60 * 24));
        console.log(`   Span:    ${daySpan} days`);
    }

    // Group by date
    console.log(`\n📆 Images by Date:`);
    const byDate = {};
    withTimestamps.forEach(img => {
        const dateKey = img.date.toLocaleDateString();
        byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    });
    
    Object.entries(byDate)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 10)
        .forEach(([date, count]) => {
            console.log(`   ${date}: ${count} images`);
        });

    // Sample recent images
    console.log(`\n📸 Sample Recent Images (last 10):`);
    images.slice(-10).reverse().forEach((img, i) => {
        const dateStr = img.date ? img.date.toLocaleString() : 'Unknown';
        console.log(`   ${i + 1}. ${img.filename}`);
        console.log(`      Date: ${dateStr}, Size: ${img.sizeMB} MB`);
    });

    // Check for orphaned patterns
    console.log(`\n🔍 Pattern Analysis:`);
    
    // Group by hour to find potential sessions
    const byHour = {};
    withTimestamps.forEach(img => {
        const hourKey = new Date(Math.floor(img.timestamp / (1000 * 60 * 60)) * (1000 * 60 * 60)).toLocaleString();
        if (!byHour[hourKey]) byHour[hourKey] = [];
        byHour[hourKey].push(img);
    });
    
    const sessions = Object.entries(byHour).filter(([_, imgs]) => imgs.length > 1);
    console.log(`   Potential Sessions (multiple images within same hour): ${sessions.length}`);
    
    if (sessions.length > 0) {
        console.log(`\n   Sample Sessions:`);
        sessions.slice(0, 5).forEach(([hour, imgs]) => {
            console.log(`   📅 ${hour}: ${imgs.length} images`);
            imgs.forEach(img => {
                console.log(`      - ${img.filename} (${img.sizeMB} MB)`);
            });
        });
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Analysis Complete\n');
    console.log('💡 Next Steps:');
    console.log('   1. Start MongoDB: net start MongoDB (Windows) or systemctl start mongod (Linux)');
    console.log('   2. Run recovery: npm run recover-images');
    console.log('   3. Verify: npm run verify-recovery\n');
}

// Run analysis
if (require.main === module) {
    try {
        analyzeImages();
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

module.exports = { analyzeImages };
