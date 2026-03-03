const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');
const Patient = require('./models/patient');

async function simulateBackend() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';
    await mongoose.connect(mongoUri);
    
    const user = await User.findOne({ email: 'alentahhhtom10@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }

    console.log('Simulating request for user:', user.email, 'ID:', user._id);
    
    // Simulate router.get('/students') logic
    const students = await Patient.find({ assignedTeacherId: user._id });
    console.log('Students found in DB:', students.length);
    
    // Check if any students have assignedTeacherId as a string instead of ObjectId
    const allStudents = await Patient.find({});
    const studentsWithCorrectId = allStudents.filter(s => 
      s.assignedTeacherId && s.assignedTeacherId.toString() === user._id.toString()
    );
    console.log('Students with matching ID string:', studentsWithCorrectId.length);

    if (students.length === 0 && studentsWithCorrectId.length > 0) {
      console.log('CRITICAL: Mongoose find failed to match ObjectId but string match worked!');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

simulateBackend();
