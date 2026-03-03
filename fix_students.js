const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/user');
const Patient = require('./models/patient');

async function fixStudents() {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    
    const user = await User.findOne({ email: 'alentahhhtom10@gmail.com' });
    if (!user) {
      console.log('Target teacher not found');
      process.exit(1);
    }
    console.log(`Found teacher: ${user.email} (ID: ${user._id})`);

    const studentsToFix = [
      { name: 'Manuel Saji', age: 7, grade: '2nd', riskLevel: 'Low', lastScreening: '2025-09-10', gender: 'Male' },
      { name: 'Rohan Sharma', age: 7, grade: '2nd', riskLevel: 'Low', lastScreening: '2025-09-08', gender: 'Male' },
      { name: 'Priya Patel', age: 9, grade: '4th', riskLevel: 'Medium', lastScreening: '2025-09-18', gender: 'Female' },
      { name: 'Aditya Singh', age: 8, grade: '3rd', riskLevel: 'High', lastScreening: '2025-10-04', gender: 'Male' },
      { name: 'Ananya Reddy', age: 6, grade: '1st', riskLevel: 'Low', lastScreening: '2025-09-20', gender: 'Female' },
      { name: 'Vikram Kumar', age: 10, grade: '5th', riskLevel: 'Medium', lastScreening: '2025-09-27', gender: 'Male' },
      { name: 'Diya Gupta', age: 7, grade: '2nd', riskLevel: 'Low', lastScreening: '2025-09-14', gender: 'Female' },
      { name: 'Arjun Menon', age: 8, grade: '3rd', riskLevel: 'Medium', lastScreening: '2025-10-07', gender: 'Male' },
      { name: 'Aisha Khan', age: 9, grade: '4th', riskLevel: 'Low', lastScreening: '2025-09-23', gender: 'Female' },
      { name: 'Karan Verma', age: 6, grade: '1st', riskLevel: 'High', lastScreening: '2025-10-13', gender: 'Male' },
      { name: 'Sneha Desai', age: 10, grade: '5th', riskLevel: 'Medium', lastScreening: '2025-10-06', gender: 'Female' },
      { name: 'Adwaith Verma', age: 8, grade: '3rd', riskLevel: 'Low', lastScreening: '2025-08-06', gender: 'Male' }
    ];

    let fixedCount = 0;
    let addedCount = 0;

    for (const sData of studentsToFix) {
      let student = await Patient.findOne({ name: sData.name });
      
      if (student) {
        // Update existing student
        student.assignedTeacherId = user._id;
        student.age = sData.age;
        student.grade = sData.grade;
        student.riskLevel = sData.riskLevel;
        student.gender = sData.gender;
        student.submittedDate = new Date(sData.lastScreening);
        await student.save();
        fixedCount++;
        console.log(`Updated and reassigned: ${sData.name}`);
      } else {
        // Create new student
        const timestamp = Date.now();
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        const patientId = `PAT-${timestamp}-${randomPart}`;
        
        student = new Patient({
          patient_id: patientId,
          patientId: patientId,
          name: sData.name,
          age: sData.age,
          gender: sData.gender,
          grade: sData.grade,
          assignedTeacherId: user._id,
          riskLevel: sData.riskLevel,
          screeningType: 'Questionnaire',
          screeningStatus: 'completed',
          submittedDate: new Date(sData.lastScreening),
          parent_id: new mongoose.Types.ObjectId() // Mock parent ID
        });
        await student.save();
        addedCount++;
        console.log(`Added new student: ${sData.name}`);
      }
    }

    console.log(`Summary: ${fixedCount} students updated, ${addedCount} students added.`);
    process.exit(0);
  } catch (err) {
    console.error('Error fixing students:', err);
    process.exit(1);
  }
}

fixStudents();
