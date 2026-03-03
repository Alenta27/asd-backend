const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patient');

async function checkCount() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const count = await Patient.countDocuments({});
    console.log('Total Patients in DB:', count);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCount();
