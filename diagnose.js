const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/user');
const Patient = require('./models/patient');
const Appointment = require('./models/appointment');

async function diagnose() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGO_URI:', process.env.MONGO_URI ? 'Set' : 'Not set');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected!\n');
    
    // Find the therapist account
    console.log('Looking for therapist: alentatom2026@mca.ajce.in');
    const therapist = await User.findOne({ email: 'alentatom2026@mca.ajce.in' });
    
    if (therapist) {
      console.log('✅ THERAPIST FOUND:');
      console.log('  ID:', therapist._id.toString());
      console.log('  Email:', therapist.email);
      console.log('  Role:', therapist.role);
      console.log('  Status:', therapist.status);
      console.log('  Username:', therapist.username);
      
      // Look for appointments for this therapist
      const appointments = await Appointment.find({ therapistId: therapist._id })
        .populate('childId', 'name')
        .populate('parentId', 'email');
      
      console.log('\n✅ APPOINTMENTS FOR THIS THERAPIST:', appointments.length);
      appointments.forEach((apt, idx) => {
        console.log(`  Appointment ${idx + 1}:`);
        console.log(`    Date: ${apt.appointmentDate}`);
        console.log(`    Time: ${apt.appointmentTime}`);
        console.log(`    Child: ${apt.childId?.name}`);
        console.log(`    Parent: ${apt.parentId?.email}`);
        console.log(`    Status: ${apt.status}`);
      });
      
      // Also check appointments by exact therapistId string
      console.log('\n🔍 Checking all appointments in DB:');
      const allApts = await Appointment.find({}).select('therapistId');
      console.log('  Total appointments:', allApts.length);
      
      if (allApts.length > 0) {
        console.log('\n  First 3 appointments therapistIds:');
        allApts.slice(0, 3).forEach((apt, idx) => {
          console.log(`    Apt ${idx + 1}: ${apt.therapistId} (type: ${typeof apt.therapistId})`);
          console.log(`    Matches current therapist? ${String(apt.therapistId) === String(therapist._id)}`);
        });
      }
      
    } else {
      console.log('❌ THERAPIST NOT FOUND');
      console.log('\nSearching for all therapists...');
      const allTherapists = await User.find({ role: 'therapist' }).select('email username _id status');
      console.log('Total therapists:', allTherapists.length);
      allTherapists.forEach(t => {
        console.log(`  - ${t.email} (${t.username}) [${t.status}]`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

diagnose();