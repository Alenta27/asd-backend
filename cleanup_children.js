require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const Patient = require('./models/patient');

async function cleanupChildren() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Find the parent
    const parent = await User.findOne({ email: 'hayestheosinclair25@gmail.com' });
    if (!parent) {
      console.log('❌ Parent not found');
      return;
    }

    console.log(`\n📋 Parent found: ${parent.username} (${parent.email})`);
    console.log(`Parent ID: ${parent._id}`);

    // Get all children for this parent
    const allChildren = await Patient.find({ parent_id: parent._id });
    console.log(`\n📚 Total children found: ${allChildren.length}`);
    
    allChildren.forEach((child, index) => {
      console.log(`${index + 1}. ${child.name} (Age: ${child.age}, Gender: ${child.gender}) - ID: ${child._id}`);
    });

    // Keep only "Yannik Sinclair" and delete others
    const childrenToKeep = allChildren.filter(c => c.name.toLowerCase() === 'yannik sinclair');
    const childrenToDelete = allChildren.filter(c => c.name.toLowerCase() !== 'yannik sinclair');

    if (childrenToDelete.length === 0) {
      console.log('\n✓ No duplicate children to delete');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n🗑️  Deleting ${childrenToDelete.length} incorrect children:`);
    
    for (const child of childrenToDelete) {
      console.log(`   - Deleting: ${child.name} (ID: ${child._id})`);
      await Patient.deleteOne({ _id: child._id });
    }

    console.log(`\n✓ Cleanup complete! Remaining children:`);
    const remainingChildren = await Patient.find({ parent_id: parent._id });
    remainingChildren.forEach((child, index) => {
      console.log(`${index + 1}. ${child.name} (Age: ${child.age}, Gender: ${child.gender})`);
    });

    await mongoose.disconnect();
    console.log('\n✓ Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupChildren();