require('dotenv').config();
const mongoose = require('mongoose');
const Patient = require('./models/patient');

async function cleanup() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/asd_database';
    console.log('Connecting to:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      // modern mongoose no need for useNewUrlParser/useUnifiedTopology
    });
    console.log('✓ Connected to database');
    
    // Find and delete patients with null patient_id
    const result = await Patient.deleteMany({ patient_id: null });
    console.log(`✓ Deleted ${result.deletedCount} patients with null patient_id`);
    
    // Also drop the old unique index if it exists and recreate it as sparse
    try {
      await Patient.collection.dropIndex('patient_id_1');
      console.log('✓ Dropped old patient_id index');
    } catch (e) {
      console.log('No index to drop or already dropped');
    }
    
    await mongoose.connection.close();
    console.log('✓ Cleanup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanup();


