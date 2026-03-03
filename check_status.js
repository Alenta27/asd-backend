const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patient');

async function checkStatus() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const patients = await Patient.find({ assignedTeacherId: '68c75cede1778a7e4fd63f05' });
    for (const p of patients) {
      console.log(`Student: ${p.name}, Status: ${p.screeningStatus}, Report: ${p.reportStatus}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkStatus();
