const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');
const Patient = require('./models/patient');

async function checkDb() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const targetTeacherId = '68c75cede1778a7e4fd63f05';
    const students = await Patient.find({ assignedTeacherId: targetTeacherId });
    console.log(`Students for teacher ${targetTeacherId}:`);
    console.log(students.map(s => s.name));

    const otherStudents = await Patient.find({ assignedTeacherId: { $ne: targetTeacherId } });
    console.log('Students for other teachers:', otherStudents.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDb();
