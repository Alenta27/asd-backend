const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/user');

const sampleTherapists = [
  {
    username: 'Dr. Sarah Johnson',
    email: 'sarah.johnson@therapy.com',
    password: 'hashed_password_1',
    role: 'therapist',
    status: 'approved',
    isActive: true,
    licenseNumber: 'TH001234',
    firstName: 'Sarah',
    lastName: 'Johnson'
  },
  {
    username: 'Dr. Michael Chen',
    email: 'michael.chen@therapy.com',
    password: 'hashed_password_2',
    role: 'therapist',
    status: 'approved',
    isActive: true,
    licenseNumber: 'TH001235',
    firstName: 'Michael',
    lastName: 'Chen'
  },
  {
    username: 'Dr. Emily Rodriguez',
    email: 'emily.rodriguez@therapy.com',
    password: 'hashed_password_3',
    role: 'therapist',
    status: 'approved',
    isActive: true,
    licenseNumber: 'TH001236',
    firstName: 'Emily',
    lastName: 'Rodriguez'
  },
  {
    username: 'Dr. James Watson',
    email: 'james.watson@therapy.com',
    password: 'hashed_password_4',
    role: 'therapist',
    status: 'approved',
    isActive: true,
    licenseNumber: 'TH001237',
    firstName: 'James',
    lastName: 'Watson'
  }
];

async function seedTherapists() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');

    for (const therapist of sampleTherapists) {
      const existingTherapist = await User.findOne({ email: therapist.email });
      
      if (existingTherapist) {
        console.log(`⚠️  Therapist ${therapist.email} already exists`);
      } else {
        const newTherapist = new User(therapist);
        await newTherapist.save();
        console.log(`✅ Created therapist: ${therapist.firstName} ${therapist.lastName}`);
      }
    }

    const allTherapists = await User.find({ role: 'therapist', isActive: true });
    console.log(`\n📊 Total active therapists in database: ${allTherapists.length}`);
    console.log('\nTherapist List:');
    allTherapists.forEach((t, idx) => {
      console.log(`  ${idx + 1}. ${t.username || 'Unknown'} (${t.email})`);
    });

    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding therapists:', error);
    process.exit(1);
  }
}

seedTherapists();
