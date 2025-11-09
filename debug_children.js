require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Patient = require('./models/patient');

async function debug() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB\n');

    // Find the parent
    const parent = await User.findOne({ email: 'hayestheosinclair25@gmail.com' });
    if (!parent) {
      console.log('❌ Parent not found');
      return;
    }

    console.log('📋 Parent Info:');
    console.log(`   Email: ${parent.email}`);
    console.log(`   User ID: ${parent._id}`);
    console.log(`   Username: ${parent.username}`);
    console.log(`   Role: ${parent.role}\n`);

    // Check all patients in database
    const allPatients = await Patient.find({});
    console.log(`📚 ALL Patients in Database: ${allPatients.length}`);
    allPatients.forEach((p, i) => {
      console.log(`   ${i + 1}. Name: ${p.name}, parent_id: ${p.parent_id}, Parent ID Type: ${typeof p.parent_id}`);
    });

    // Find patients for this parent
    console.log(`\n🔍 Searching for children with parent_id = "${parent._id}"`);
    const children = await Patient.find({ parent_id: parent._id });
    console.log(`   Found: ${children.length} children\n`);
    
    children.forEach((child, i) => {
      console.log(`   ${i + 1}. ${child.name} (Age: ${child.age}, Gender: ${child.gender})`);
    });

    // Try string matching
    if (children.length === 0) {
      console.log('\n⚠️  No children found with ObjectId matching. Trying string matching...');
      const childrenString = await Patient.find({ parent_id: parent._id.toString() });
      console.log(`   Found with string match: ${childrenString.length}`);
      
      childrenString.forEach((child, i) => {
        console.log(`   ${i + 1}. ${child.name}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

debug();