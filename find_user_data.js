require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');

const dbNames = ['test', 'asd', 'asd_database', 'admin', 'asd_screening'];

async function findData() {
  console.log('Searching for user data across databases...\n');
  
  for (const dbName of dbNames) {
    try {
      const uri = `mongodb+srv://alentatom2026:XiaFgsNr0EiiO4ib@asd.q5rgd0s.mongodb.net/${dbName}?retryWrites=true&w=majority&appName=asd`;
      await mongoose.connect(uri);
      
      const count = await User.countDocuments();
      console.log(`Database "${dbName}": ${count} users found`);
      
      if (count > 0) {
        const sample = await User.find().limit(5).select('email username role');
        sample.forEach(u => console.log(`  - ${u.email} | Role: ${u.role} | Username: ${u.username}`));
      }
      
      await mongoose.disconnect();
    } catch(e) {
      console.log(`Database "${dbName}": Error - ${e.message}`);
    }
  }
  
  process.exit(0);
}

findData();
