const mongoose = require('mongoose');
const User = require('./models/user.js');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/asd-test', {
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 5000
}).then(async () => {
  console.log('=== Database Check ===\n');
  
  const users = await User.find().select('email role parentId therapistId teacherId researcherId adminId').limit(10);
  console.log('Sample Users (first 10):');
  users.forEach(u => {
    console.log(`Email: ${u.email}, Role: ${u.role}, Has IDs: ${!!u.parentId || !!u.therapistId || !!u.teacherId || !!u.researcherId || !!u.adminId}`);
  });
  
  const guestCount = await User.countDocuments({ role: 'guest' });
  const nullRoleCount = await User.countDocuments({ role: { $in: [null, undefined, ''] } });
  const allUsers = await User.countDocuments({});
  
  console.log(`\nTotal users: ${allUsers}`);
  console.log(`Users with role='guest': ${guestCount}`);
  console.log(`Users with NO role (null/undefined): ${nullRoleCount}`);
  
  process.exit(0);
}).catch(e => {
  console.error('DB Error:', e.message);
  process.exit(1);
});