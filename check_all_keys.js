const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patient');

async function checkAllKeys() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const p = await Patient.findOne({ name: 'Rohan Sharma' });
    console.log('Keys for Rohan Sharma:', Object.keys(p.toObject()));
    console.log('Full object:', JSON.stringify(p.toObject(), null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkAllKeys();
