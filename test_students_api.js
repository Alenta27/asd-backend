require('dotenv').config();
const mongoose = require('mongoose');
const Patient = require('./models/patient');
const User = require('./models/user');

async function testAPI() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database');
    
    // Find teacher
    const teacher = await User.findOne({ role: 'teacher' });
    console.log('Teacher found:', teacher ? teacher.email : 'No teacher');
    
    // Find all students assigned to this teacher
    const students = await Patient.find({ assignedTeacherId: teacher._id });
    console.log(`Found ${students.length} students for this teacher:`);
    students.forEach((s, i) => {
      console.log(`${i+1}. ${s.name} - Age: ${s.age}, Grade: ${s.grade}, Risk: ${s.riskLevel}`);
    });
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testAPI();


