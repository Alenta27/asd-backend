const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/user');
const Appointment = require('./models/appointment');
const Patient = require('./models/patient');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    const therapists = await User.find({ role: 'therapist' });
    console.log('Therapists found:', therapists.length);

    if (therapists.length > 0) {
      for (const therapist of therapists) {
        console.log(`\nTherapist: ${therapist.username} (${therapist._id})`);
        const appointments = await Appointment.find({ therapistId: therapist._id }).lean();
        console.log(`  Appointments: ${appointments.length}`);
        
        if (appointments.length > 0) {
          for (const apt of appointments) {
            console.log(`    - ID: ${apt._id}`);
            console.log(`      childId: ${apt.childId}`);
            console.log(`      parentId: ${apt.parentId}`);
            console.log(`      date: ${apt.appointmentDate}`);
            console.log(`      time: ${apt.appointmentTime}`);
            
            if (apt.childId) {
              const patient = await Patient.findById(apt.childId).lean();
              console.log(`      patient name: ${patient ? patient.name : 'NOT FOUND'}`);
            }
          }
        }
      }
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
