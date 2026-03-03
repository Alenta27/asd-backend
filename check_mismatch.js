const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');
const Patient = require('./models/patient');

async function checkMismatch() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';
    await mongoose.connect(mongoUri);
    
    const userIdStr = '68c75cede1778a7e4fd63f05';
    const userIdObj = new mongoose.Types.ObjectId(userIdStr);

    // Query with ObjectId
    const studentsWithObj = await Patient.find({ assignedTeacherId: userIdObj });
    console.log('Query with ObjectId result count:', studentsWithObj.length);

    // Query with String
    const studentsWithStr = await Patient.find({ assignedTeacherId: userIdStr });
    console.log('Query with String result count:', studentsWithStr.length);

    // Check raw type in MongoDB using native driver
    const nativePatient = await mongoose.connection.db.collection('patients').findOne({ name: 'Rohan Sharma' });
    console.log('Native driver assignedTeacherId type:', typeof nativePatient.assignedTeacherId);
    console.log('Native driver assignedTeacherId value:', nativePatient.assignedTeacherId);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkMismatch();
