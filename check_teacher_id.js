const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patient');

async function checkTeacherId() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    
    const teacherIdStr = "TEA-1761885415424-M7HSDZ";
    const studentsWithTeaId = await Patient.find({ assignedTeacherId: teacherIdStr });
    console.log('Students with assignedTeacherId as TEA- string:', studentsWithTeaId.length);

    const otherFieldCheck = await Patient.find({ teacherId: teacherIdStr });
    console.log('Students with teacherId (no assigned prefix) as TEA- string:', otherFieldCheck.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTeacherId();
