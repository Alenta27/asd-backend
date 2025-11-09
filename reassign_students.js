require('dotenv').config();
const mongoose = require('mongoose');
const Patient = require('./models/patient');
const User = require('./models/user');

async function reassign() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to database');
    
    // Find the currently logged in teacher
    const teacher = await User.findOne({ email: 'alentahhhtom10@gmail.com' });
    if (!teacher) {
      console.log('Teacher not found');
      process.exit(1);
    }
    console.log('Current teacher ID:', teacher._id);
    
    // Find all students
    const students = await Patient.find({});
    console.log(`Found ${students.length} students in database`);
    
    // Reassign all students to this teacher
    for (const student of students) {
      student.assignedTeacherId = teacher._id;
      await student.save();
      console.log(`Reassigned: ${student.name} to teacher ${teacher.email}`);
    }
    
    console.log(`Successfully reassigned ${students.length} students!`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

reassign();


