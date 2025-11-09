const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const User = require('./models/user');
const Patient = require('./models/patient');
const Appointment = require('./models/appointment');

async function findIds() {
  const logs = [];
  try {
    logs.push('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    logs.push('Connected!\n');
    
    logs.push('VERIFICATION AFTER CLEANUP:');
    logs.push('=====================================\n');
    
    logs.push('1. Therapist: alentatom2026@mca.ajce.in');
    const therapist = await User.findOne({ email: 'alentatom2026@mca.ajce.in' });
    logs.push('   ID: ' + therapist._id);
    
    logs.push('\n2. Patient: Yannik Sinclair');
    const yannik = await Patient.findOne({ name: 'Yannik Sinclair' });
    logs.push('   ID: ' + yannik._id);
    logs.push('   Parent ID: ' + yannik.parent_id);
    logs.push('   Therapist assigned: ' + yannik.therapist_user_id);
    
    logs.push('\n3. Therapist appointments:');
    const appointments = await Appointment.find({ therapistId: therapist._id }).lean();
    logs.push('   Total: ' + appointments.length);
    
    for (const apt of appointments) {
      const patient = await Patient.findById(apt.childId).lean();
      logs.push('   - ' + (patient?.name || 'UNKNOWN') + ' | Status: ' + apt.status + ' | Date: ' + apt.appointmentDate.toDateString());
    }
    
    logs.push('\n4. ISSUE: Therapist is NOT assigned to Yannik in the patient record');
    logs.push('   FIX: Assigning therapist to patient...');
    
    const assignResult = await Patient.findByIdAndUpdate(
      yannik._id,
      { therapist_user_id: therapist._id },
      { new: true }
    );
    
    logs.push('   ✓ Therapist assigned!');
    logs.push('   Patient therapist_user_id: ' + assignResult.therapist_user_id);
    
    logs.push('\n✓ ALL FIXED!');
    
    await mongoose.disconnect();
  } catch (err) {
    logs.push('\nError: ' + err.message);
    logs.push(err.stack);
  }
  
  const output = logs.join('\n');
  fs.writeFileSync('find_ids_output.txt', output);
  console.log(output);
}

findIds();
