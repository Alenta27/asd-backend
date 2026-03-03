const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');

async function checkUserFull() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const user = await User.findOne({ email: 'alentahhhtom10@gmail.com' });
    console.log('Full user object:');
    console.log(JSON.stringify(user.toObject(), null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUserFull();
