const mongoose = require('mongoose');
const User = require('./models/user');
require('dotenv').config();

async function checkDatabase() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        const users = await User.find({}, { email: 1, role: 1, parentId: 1, therapistId: 1, teacherId: 1, researcherId: 1, adminId: 1 });
        
        console.log('\n📋 ALL USERS IN DATABASE:');
        console.log('================================');
        users.forEach((user, index) => {
            console.log(`\n${index + 1}. User: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   IDs: parentId=${user.parentId}, therapistId=${user.therapistId}, teacherId=${user.teacherId}, researcherId=${user.researcherId}, adminId=${user.adminId}`);
        });
        
        console.log('\n================================');
        console.log(`Total users: ${users.length}`);
        
        // Check for users with 'guest' role
        const guestUsers = await User.find({ role: 'guest' });
        console.log(`\n⚠️  Users still with 'guest' role: ${guestUsers.length}`);
        guestUsers.forEach(u => console.log(`   - ${u.email}`));
        
        await mongoose.connection.close();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

checkDatabase();