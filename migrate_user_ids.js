const mongoose = require('mongoose');
const User = require('./models/user');
const { generateUniqueId } = require('./utils/idGenerator');
require('dotenv').config();

async function migrateUserIds() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Find all users with valid roles
        const users = await User.find({ 
            role: { $in: ['parent', 'therapist', 'teacher', 'researcher', 'admin'] } 
        });
        
        console.log(`\n📝 Found ${users.length} users with valid roles. Generating missing IDs...\n`);
        
        let updated = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            // Generate missing IDs based on role
            if (user.role === 'parent' && !user.parentId) {
                user.parentId = generateUniqueId('parent');
                needsUpdate = true;
            } else if (user.role === 'therapist' && !user.therapistId) {
                user.therapistId = generateUniqueId('therapist');
                needsUpdate = true;
            } else if (user.role === 'teacher' && !user.teacherId) {
                user.teacherId = generateUniqueId('teacher');
                needsUpdate = true;
            } else if (user.role === 'researcher' && !user.researcherId) {
                user.researcherId = generateUniqueId('researcher');
                needsUpdate = true;
            } else if (user.role === 'admin' && !user.adminId) {
                user.adminId = generateUniqueId('admin');
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await user.save();
                updated++;
                console.log(`✅ ${user.email} (${user.role}) - ID generated and saved`);
            }
        }
        
        console.log(`\n✅ Migration complete! Updated ${updated} users with missing IDs`);
        
        // Verify
        const usersWithUndefinedRole = await User.find({ role: { $exists: false } });
        if (usersWithUndefinedRole.length > 0) {
            console.log(`\n⚠️  WARNING: Found ${usersWithUndefinedRole.length} users with undefined role:`);
            usersWithUndefinedRole.forEach(u => console.log(`   - ${u.email}`));
            console.log('\nThese users need to set a role manually or go through the select-role flow again.');
        }
        
        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Migration error:', err.message);
    }
}

migrateUserIds();