const mongoose = require('mongoose');
const Patient = require('./models/patient');
const User = require('./models/user');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/asd_database';
    if (!mongoUri) {
      console.warn('MONGO_URI is not set. Set it in .env to enable DB features.');
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri, {
      // modern mongoose no need for useNewUrlParser/useUnifiedTopology
    });
    console.log('MongoDB Connected...');
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
};

const seedStudents = async () => {
  try {
    await connectDB();

    // Find a teacher user to assign students to
    const teacher = await User.findOne({ role: 'teacher' });
    
    if (!teacher) {
      console.log('No teacher found. Please create a teacher account first.');
      process.exit(1);
    }

    // Generate patient ID generator
    const generatePatientId = () => {
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `PAT-${timestamp}-${randomPart}`;
    };

    // Create a mock parent ID
    const mockParentId = new mongoose.Types.ObjectId();

    // Students to seed - matching the provided list
    const students = [
      { name: 'Rohan Sharma', age: 7, grade: '2nd', riskLevel: 'Low', lastScreening: '2025-09-15', gender: 'Male' },
      { name: 'Priya Patel', age: 9, grade: '4th', riskLevel: 'Medium', lastScreening: '2025-10-02', gender: 'Female' },
      { name: 'Aditya Singh', age: 8, grade: '3rd', riskLevel: 'High', lastScreening: '2025-10-11', gender: 'Male' },
      { name: 'Ananya Reddy', age: 6, grade: '1st', riskLevel: 'Low', lastScreening: '2025-09-28', gender: 'Female' },
      { name: 'Vikram Kumar', age: 10, grade: '5th', riskLevel: 'Medium', lastScreening: '2025-10-05', gender: 'Male' },
      { name: 'Diya Gupta', age: 7, grade: '2nd', riskLevel: 'Low', lastScreening: '2025-09-22', gender: 'Female' },
      { name: 'Arjun Menon', age: 8, grade: '3rd', riskLevel: 'Medium', lastScreening: '2025-10-14', gender: 'Male' },
      { name: 'Aisha Khan', age: 9, grade: '4th', riskLevel: 'Low', lastScreening: '2025-09-30', gender: 'Female' },
      { name: 'Karan Verma', age: 6, grade: '1st', riskLevel: 'High', lastScreening: '2025-10-20', gender: 'Male' },
      { name: 'Sneha Desai', age: 10, grade: '5th', riskLevel: 'Medium', lastScreening: '2025-10-18', gender: 'Female' },
    ];

    console.log('Starting to seed students...');

    // Check if students already exist
    const existingStudents = await Patient.countDocuments({ assignedTeacherId: teacher._id });
    
    if (existingStudents > 0) {
      console.log(`Found ${existingStudents} existing students. Skipping seed.`);
      process.exit(0);
    }

    // Add students to database
    for (const studentData of students) {
      const patientId = generatePatientId();
      
      const student = new Patient({
        patient_id: patientId,
        patientId: patientId, // Keep both for compatibility
        name: studentData.name,
        age: studentData.age,
        gender: studentData.gender,
        grade: studentData.grade,
        assignedTeacherId: teacher._id,
        riskLevel: studentData.riskLevel,
        screeningType: 'Questionnaire',
        screeningStatus: 'completed',
        submittedDate: new Date(studentData.lastScreening),
        parent_id: mockParentId
      });

      await student.save();
      console.log(`Added student: ${studentData.name}`);
    }

    console.log(`Successfully seeded ${students.length} students!`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding students:', error);
    process.exit(1);
  }
};

seedStudents();

