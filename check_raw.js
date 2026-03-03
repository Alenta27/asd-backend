const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');
const Patient = require('./models/patient');

async function checkRaw() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';
    await mongoose.connect(mongoUri);
    
    const p = await Patient.findOne({ name: 'Rohan Sharma' });
    console.log('Raw patient data for Rohan Sharma:');
    console.log(JSON.stringify(p, null, 2));
    
    const user = await User.findOne({ email: 'alentahhhtom10@gmail.com' });
    console.log('User ID for alentahhhtom10@gmail.com:', user._id);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkRaw();
