# Clean Database Duplicate Keys

## The Problem

Your database has a duplicate key error. This happens when there are existing patients with `null` values in `patient_id`.

## Quick Fix

Run this in your MongoDB shell or create a script to clean up:

```javascript
// Connect to your database
use your_database_name

// Find patients with null patient_id
db.patients.find({ patient_id: null })

// Delete them (careful - this will delete those records!)
db.patients.deleteMany({ patient_id: null })
```

## Or Use This Script

Create a file `cleanup.js` in the backend folder and run it:

```javascript
require('dotenv').config();
const mongoose = require('mongoose');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('Connected to database');
    
    const Patient = require('./models/patient');
    const result = await Patient.deleteMany({ patient_id: null });
    console.log(`Deleted ${result.deletedCount} patients with null patient_id`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanup();
```

Then run: `node cleanup.js`


