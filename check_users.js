const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');

async function checkUsers() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';
    await mongoose.connect(mongoUri);
    const users = await User.find({ email: 'alentahhhtom10@gmail.com' });
    console.log('Users found with email alentahhhtom10@gmail.com:', users.length);
    for (const u of users) {
      console.log(`ID: ${u._id}, Role: ${u.role}, Status: ${u.status}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUsers();
