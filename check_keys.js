const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patient');

async function checkKeys() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';
    await mongoose.connect(mongoUri);
    const patients = await Patient.find({});
    console.log('Total Patients:', patients.length);
    for (const p of patients) {
      const obj = p.toObject();
      console.log(`Student: ${p.name}, assignedTeacherId: ${obj.assignedTeacherId}, type: ${typeof obj.assignedTeacherId}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkKeys();
