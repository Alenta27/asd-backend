const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patient');

async function checkFinal() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    const patients = await Patient.find({});
    console.log('Final check of all patients:');
    for (const p of patients) {
      console.log(`- ${p.name}: teacherId=${p.assignedTeacherId}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkFinal();
