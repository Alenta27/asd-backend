const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { verifyToken, therapistCheck, requireResourceAccess } = require('../middlewares/auth');
const User = require('../models/user');
const Patient = require('../models/patient');
const Report = require('../models/report');
const Slot = require('../models/slot');
const Appointment = require('../models/appointment');
const GazeSession = require('../models/GazeSession');
const DREAMFeatures = require('../models/dreamFeatures');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const csv = require('csv-parser');

const upload = multer({ 
  dest: 'uploads/dream_datasets/',
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.json' || 
        file.mimetype === 'application/json' ||
        path.extname(file.originalname).toLowerCase() === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON or ZIP files are allowed'));
    }
  }
});

const formatAppointmentResponse = (appointment) => ({
  id: appointment._id,
  clientId: appointment.childId?._id,
  clientName: appointment.childId?.name || 'Client Name Not Available',
  date: appointment.appointmentDate ? appointment.appointmentDate.toISOString().split('T')[0] : 'N/A',
  time: appointment.appointmentTime,
  duration: 45,
  type: appointment.type || 'In-Person',
  status: appointment.status === 'confirmed' ? 'Scheduled' : appointment.status === 'completed' ? 'Completed' : appointment.status === 'cancelled' ? 'Cancelled' : 'Pending',
  notes: appointment.notes || appointment.reason || '',
  billingAmount: 120,
  parentName: appointment.parentId?.username || appointment.parentId?.email || 'Unknown Parent'
});

// All routes require authentication and therapist role
router.use(verifyToken);
router.use(therapistCheck);

// Get therapist's profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get therapist's clients (only their assigned clients)
router.get('/clients', requireResourceAccess('children'), async (req, res) => {
  try {
    const clients = await Patient.find({ therapist_user_id: req.user.id });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific patient details by ID
router.get('/patient/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find patient and verify it belongs to this therapist
    const patient = await Patient.findOne({ 
      _id: id, 
      therapist_user_id: req.user.id 
    });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or access denied' });
    }
    
    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get patient's screening history
router.get('/patient/:id/screenings', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify patient belongs to this therapist
    const patient = await Patient.findOne({ 
      _id: id, 
      therapist_user_id: req.user.id 
    });
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found or access denied' });
    }
    
    // Fetch gaze sessions for this patient
    const gazeSessions = await GazeSession.find({
      patientId: id,
      isGuest: false
    })
    .select('sessionType module status snapshots createdAt result')
    .sort({ createdAt: -1 })
    .limit(20);
    
    // Format screening data
    const screenings = gazeSessions.map(session => ({
      _id: session._id,
      screeningType: 'gaze',
      sessionType: session.sessionType || session.module,
      status: session.status,
      result: session.result,
      snapshots: session.snapshots || [],
      createdAt: session.createdAt
    }));
    
    res.json(screenings);
  } catch (error) {
    console.error('Error fetching patient screenings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get today's appointments
router.get('/appointments/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const appointments = await Appointment.find({
      therapistId: req.user.id,
      appointmentDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('childId', 'name')
    .populate('parentId', 'username email')
    .sort({ appointmentTime: 1 });
    
    const formattedAppointments = appointments.map(apt => ({
      id: apt._id,
      clientId: apt.childId._id,
      clientName: apt.childId.name,
      time: apt.appointmentTime,
      duration: 45, // Default duration
      type: 'In-Person', // Default type
      status: apt.status === 'confirmed' ? 'Confirmed' : 'Pending',
      notes: apt.notes || apt.reason || '',
      appointmentDate: apt.appointmentDate,
      parentName: apt.parentId?.username || apt.parentId?.email
    }));
    
    res.json(formattedAppointments);
  } catch (error) {
    console.error('Error fetching today\'s appointments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all appointments
router.get('/appointments', requireResourceAccess('appointments'), async (req, res) => {
  try {
    const userIdString = String(req.user.id);
    
    // Get raw appointments without populate first
    const rawAppointments = await Appointment.find({
      $or: [
        { therapistId: req.user.id },
        { therapistId: new mongoose.Types.ObjectId(userIdString) }
      ]
    })
    .lean()
    .sort({ appointmentDate: -1 });
    
    console.log('Found raw appointments:', rawAppointments.length);
    
    // Manually fetch all related data
    const appointmentsWithData = await Promise.all(rawAppointments.map(async (apt) => {
      // Fetch patient name
      let childName = 'Client Name Not Available';
      if (apt.childId) {
        try {
          const childIdToUse = apt.childId._id ? apt.childId._id : apt.childId;
          const patient = await Patient.findById(childIdToUse).select('name').lean();
          if (patient && patient.name) {
            childName = patient.name;
            console.log(`Appointment ${apt._id}: Found patient ${childName}`);
          } else {
            console.log(`Appointment ${apt._id}: Patient not found for ID ${childIdToUse}`);
          }
        } catch (err) {
          console.log(`Appointment ${apt._id}: Error fetching patient:`, err.message);
        }
      } else {
        console.log(`Appointment ${apt._id}: No childId reference`);
      }
      
      // Fetch parent name
      let parentName = 'Unknown Parent';
      if (apt.parentId) {
        try {
          const parent = await User.findById(apt.parentId).select('username email').lean();
          if (parent) {
            parentName = parent.username || parent.email || 'Unknown Parent';
          }
        } catch (err) {
          console.log(`Appointment ${apt._id}: Error fetching parent:`, err.message);
        }
      }
      
      return {
        ...apt,
        childName,
        parentName
      };
    }));
    
    // Format appointments
    const formattedAppointments = appointmentsWithData.map((apt) => ({
      id: apt._id,
      clientId: apt.childId,
      clientName: apt.childName,
      date: apt.appointmentDate ? apt.appointmentDate.toISOString().split('T')[0] : 'N/A',
      time: apt.appointmentTime,
      duration: 45,
      type: apt.type || 'In-Person',
      status: apt.status === 'confirmed' ? 'Scheduled' : apt.status === 'completed' ? 'Completed' : apt.status === 'cancelled' ? 'Cancelled' : 'Pending',
      notes: apt.notes || apt.reason || '',
      billingAmount: 120,
      parentName: apt.parentName
    }));
    
    res.json(formattedAppointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/appointments/:appointmentId/confirm', requireResourceAccess('appointments'), async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.appointmentId,
      therapistId: req.user.id
    })
    .populate('childId', 'name')
    .populate('parentId', 'username email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = 'confirmed';
    await appointment.save();

    res.json(formatAppointmentResponse(appointment));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/appointments/:appointmentId/reschedule', requireResourceAccess('appointments'), async (req, res) => {
  try {
    const { date, time } = req.body;
    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required' });
    }

    const trimmedDate = date.trim();
    const trimmedTime = time.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
      return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format' });
    }

    const time24Pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    const time12Pattern = /^((0?[1-9])|(1[0-2])):[0-5]\d\s?(AM|PM)$/i;

    if (!time24Pattern.test(trimmedTime) && !time12Pattern.test(trimmedTime)) {
      return res.status(400).json({ message: 'Time must be in HH:MM or HH:MM AM/PM format' });
    }

    const [year, month, day] = trimmedDate.split('-').map(Number);
    const normalizedDate = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (Number.isNaN(normalizedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date provided' });
    }

    const appointment = await Appointment.findOne({
      _id: req.params.appointmentId,
      therapistId: req.user.id
    })
    .populate('childId', 'name')
    .populate('parentId', 'username email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.appointmentDate = normalizedDate;
    appointment.appointmentTime = time;
    appointment.status = 'pending';

    await appointment.save();

    res.json(formatAppointmentResponse(appointment));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get to-do list (pending session notes)
router.get('/todo', async (req, res) => {
  try {
    const todoItems = [
      {
        id: 1,
        type: 'session_note',
        clientName: 'Alex Johnson',
        appointmentDate: '2024-01-15',
        priority: 'high',
        description: 'Complete session notes for Alex\'s behavioral therapy session'
      },
      {
        id: 2,
        type: 'assessment',
        clientName: 'Emma Smith',
        appointmentDate: '2024-01-16',
        priority: 'medium',
        description: 'Review Emma\'s speech assessment results'
      },
      {
        id: 3,
        type: 'report',
        clientName: 'Liam Brown',
        appointmentDate: '2024-01-14',
        priority: 'low',
        description: 'Update progress report for Liam'
      }
    ];
    
    res.json(todoItems);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get calendar/availability
router.get('/calendar', async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    // Get slots for the month
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);
    
    const slots = await Slot.find({
      therapistId: req.user.id,
      date: {
        $gte: startDate,
        $lte: endDate
      },
      isActive: true
    }).sort({ date: 1 });
    
    // Get appointments for the month
    const appointments = await Appointment.find({
      therapistId: req.user.id,
      appointmentDate: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('childId', 'name')
    .sort({ appointmentDate: 1 });
    
    // Format availability data
    const availability = slots.map(slot => ({
      date: slot.date.toISOString().split('T')[0],
      slots: generateTimeSlots(slot.startTime, slot.endTime, slot.intervalMinutes, slot.breakTimeMinutes)
    }));
    
    // Format appointments data
    const formattedAppointments = appointments.map(apt => ({
      date: apt.appointmentDate.toISOString().split('T')[0],
      time: apt.appointmentTime,
      client: apt.childId.name,
      duration: 45 // Default duration
    }));
    
    const calendar = {
      month: targetMonth + 1,
      year: targetYear,
      availability,
      appointments: formattedAppointments
    };
    
    res.json(calendar);
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to generate time slots
function generateTimeSlots(startTime, endTime, intervalMinutes, breakTimeMinutes) {
  const slots = [];
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  
  let current = new Date(start);
  
  while (current < end) {
    const slotEnd = new Date(current.getTime() + intervalMinutes * 60000);
    if (slotEnd <= end) {
      slots.push(current.toTimeString().slice(0, 5));
    }
    current = new Date(slotEnd.getTime() + breakTimeMinutes * 60000);
  }
  
  return slots;
}

// Update availability
router.put('/calendar/availability', async (req, res) => {
  try {
    const { date, slots } = req.body;
    
    // Mock availability update
    const updatedAvailability = {
      date,
      slots,
      therapistId: req.user.id,
      updatedAt: new Date()
    };
    
    res.json(updatedAvailability);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get gaze session details
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await GazeSession.findById(req.params.sessionId).populate('patientId', 'name age gender');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update billing information
router.get('/billing', async (req, res) => {
  try {
    const billing = {
      totalEarnings: 2400,
      thisMonth: 800,
      pendingPayments: 400,
      completedSessions: 20,
      upcomingSessions: 5,
      recentTransactions: [
        {
          id: 1,
          clientName: 'Alex Johnson',
          amount: 120,
          date: '2024-01-15',
          status: 'Paid',
          sessionType: 'Behavioral Therapy'
        },
        {
          id: 2,
          clientName: 'Emma Smith',
          amount: 80,
          date: '2024-01-14',
          status: 'Pending',
          sessionType: 'Speech Therapy'
        }
      ]
    };
    
    res.json(billing);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create clinical notes
router.post('/clinical-notes', async (req, res) => {
  try {
    const { clientId, notes, sessionType, date } = req.body;
    
    // Verify the client belongs to this therapist
    const client = await Patient.findOne({ 
      _id: clientId, 
      therapist_user_id: req.user.id 
    });
    
    if (!client) {
      return res.status(403).json({ message: 'Access denied. Client not found or not assigned to you.' });
    }

    const clinicalNote = {
      id: Date.now(),
      clientId,
      clientName: client.name,
      therapistId: req.user.id,
      notes,
      sessionType,
      date: date || new Date(),
      createdAt: new Date()
    };
    
    res.status(201).json(clinicalNote);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get clinical notes for a client
router.get('/clinical-notes/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify the client belongs to this therapist
    const client = await Patient.findOne({ 
      _id: clientId, 
      therapist_user_id: req.user.id 
    });
    
    if (!client) {
      return res.status(403).json({ message: 'Access denied. Client not found or not assigned to you.' });
    }

    // Mock clinical notes
    const notes = [
      {
        id: 1,
        date: '2024-01-15',
        sessionType: 'Behavioral Therapy',
        notes: 'Alex showed improvement in following instructions. Continued focus on social interaction skills.',
        therapistId: req.user.id
      },
      {
        id: 2,
        date: '2024-01-10',
        sessionType: 'Assessment',
        notes: 'Initial assessment completed. Identified areas for improvement in communication.',
        therapistId: req.user.id
      }
    ];
    
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Slot Management Routes

// Get all slots for the therapist
router.get('/slots', async (req, res) => {
  try {
    const slots = await Slot.find({ 
      therapistId: req.user.id,
      isActive: true 
    }).sort({ date: 1, startTime: 1 });
    
    res.json(slots);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new slot
router.post('/slots', async (req, res) => {
  try {
    const { date, startTime, endTime, intervalMinutes, breakTimeMinutes, mode, hospitalClinicName } = req.body;
    
    // Validate required fields
    if (!date || !startTime || !endTime || !intervalMinutes || !breakTimeMinutes || !mode) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Parse date string (YYYY-MM-DD) as local date, not UTC
    const [year, month, day] = date.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      return res.status(400).json({ message: 'You can only create slots for today or future dates' });
    }
    
    // Validate hospital name for in-person appointments
    if (mode === 'In-person' && !hospitalClinicName?.trim()) {
      return res.status(400).json({ message: 'Hospital/Clinic name is required for in-person appointments' });
    }
    
    // Check if slot already exists for this date
    const existingSlot = await Slot.findOne({
      therapistId: req.user.id,
      date: selectedDate,
      isActive: true
    });
    
    if (existingSlot) {
      return res.status(400).json({ message: 'A slot already exists for this date' });
    }
    
    const slot = new Slot({
      therapistId: req.user.id,
      date: selectedDate,
      startTime,
      endTime,
      intervalMinutes,
      breakTimeMinutes,
      mode,
      hospitalClinicName: mode === 'In-person' ? hospitalClinicName : undefined
    });
    
    await slot.save();
    res.status(201).json(slot);
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete slot
router.delete('/slots/:slotId', async (req, res) => {
  try {
    const slot = await Slot.findOne({
      _id: req.params.slotId,
      therapistId: req.user.id
    });
    
    if (!slot) {
      return res.status(404).json({ message: 'Slot not found' });
    }
    
    await Slot.findByIdAndDelete(req.params.slotId);
    res.json({ message: 'Slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting slot:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get available slots for patients (public endpoint)
router.get('/slots/available', async (req, res) => {
  try {
    const { therapistId, date } = req.query;
    
    if (!therapistId || !date) {
      return res.status(400).json({ message: 'Therapist ID and date are required' });
    }
    
    // Parse date string (YYYY-MM-DD) as local date, not UTC
    const [year, month, day] = date.split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    const slot = await Slot.findOne({
      therapistId,
      date: requestedDate,
      isActive: true
    });
    
    if (!slot) {
      return res.json({ availableSlots: [] });
    }
    
    // Generate time slots
    const generateTimeSlots = (startTime, endTime, intervalMinutes, breakTimeMinutes) => {
      const slots = [];
      const start = new Date(`2000-01-01T${startTime}`);
      const end = new Date(`2000-01-01T${endTime}`);
      
      let current = new Date(start);
      
      while (current < end) {
        const slotEnd = new Date(current.getTime() + intervalMinutes * 60000);
        if (slotEnd <= end) {
          slots.push({
            start: current.toTimeString().slice(0, 5),
            end: slotEnd.toTimeString().slice(0, 5)
          });
        }
        current = new Date(slotEnd.getTime() + breakTimeMinutes * 60000);
      }
      
      return slots;
    };
    
    const availableSlots = generateTimeSlots(
      slot.startTime,
      slot.endTime,
      slot.intervalMinutes,
      slot.breakTimeMinutes
    );
    
    res.json({
      slot: {
        id: slot._id,
        date: slot.date,
        mode: slot.mode,
        hospitalClinicName: slot.hospitalClinicName
      },
      availableSlots
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============== PROGRESS TRACKING ROUTES ==============

const { spawn } = require('child_process');

router.post('/predict-progress', async (req, res) => {
  try {
    const { childData } = req.body;

    if (!childData) {
      return res.status(400).json({ error: 'Child data is required' });
    }

    const pythonBin = process.env.PYTHON_BIN || 'python';
    const workerPath = path.join(__dirname, '..', 'predict_progress.py');

    let stdoutData = '';
    let stderrData = '';

    const child = spawn(pythonBin, [workerPath, JSON.stringify(childData)], { stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
      console.error('Python stderr:', chunk.toString());
    });

    child.on('error', (err) => {
      console.error('❌ Python Worker Error:', err);
      return res.status(500).json({ 
        error: 'Failed to predict progress',
        details: String(err)
      });
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Python worker failed with code:', code);
        console.error('Stderr:', stderrData);
        return res.status(500).json({ 
          error: 'Prediction failed',
          details: stderrData
        });
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        console.log('✅ Progress Prediction Success:', result);
        res.json(result);
      } catch (parseErr) {
        console.error('Failed to parse prediction output:', stdoutData);
        res.status(500).json({ error: 'Failed to parse prediction result' });
      }
    });
  } catch (error) {
    console.error('POST /predict-progress - Error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

router.post('/process-dream-dataset', upload.single('datasetFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile = req.file.path;
    const outputDir = path.join('uploads/dream_output', Date.now().toString());
    const outputFile = path.join(outputDir, 'dream_features.csv');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pythonScript = path.join(__dirname, '../ai_model/process_data.py');
    const inputDir = path.dirname(uploadedFile);
    
    const command = `python "${pythonScript}" "${inputDir}" "${outputFile}"`;
    
    console.log('[DREAM] Processing dataset:', req.file.originalname);
    console.log('[DREAM] Command:', command);

    exec(command, { maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
      if (error) {
        console.error('[DREAM] Processing error:', error);
        console.error('[DREAM] Stderr:', stderr);
        return res.status(500).json({ 
          error: 'Dataset processing failed',
          details: stderr 
        });
      }

      try {
        if (!fs.existsSync(outputFile)) {
          return res.status(500).json({ error: 'Output file not generated' });
        }

        const batchId = `DREAM_${Date.now()}`;
        const features = [];
        const processedCount = { total: 0, success: 0, failed: 0 };

        fs.createReadStream(outputFile)
          .pipe(csv())
          .on('data', (row) => {
            features.push({
              participantId: row.Participant_ID,
              sessionDate: row.Session_Date,
              averageJointVelocity: parseFloat(row.Average_Joint_Velocity) || 0,
              totalDisplacementRatio: parseFloat(row.Total_Displacement_Ratio) || 0,
              headGazeVariance: parseFloat(row.Head_Gaze_Variance) || 0,
              eyeGazeConsistency: parseFloat(row.Eye_Gaze_Consistency) || 0,
              adosCommunicationScore: parseInt(row.ADOS_Communication_Score) || 0,
              adosTotalScore: parseInt(row.ADOS_Total_Score),
              ageMonths: parseInt(row.Age_Months) || 0,
              therapyCondition: row.Therapy_Condition,
              filePath: row.File_Path,
              uploadedBy: req.user.id,
              batchId: batchId,
              processedAt: new Date()
            });
            processedCount.total++;
          })
          .on('end', async () => {
            try {
              if (features.length > 0) {
                const insertedDocs = await DREAMFeatures.insertMany(features);
                processedCount.success = insertedDocs.length;
              }

              const summaryStats = {
                avgVelocity: features.reduce((sum, f) => sum + f.averageJointVelocity, 0) / features.length || 0,
                avgADOSScore: features.reduce((sum, f) => sum + f.adosTotalScore, 0) / features.length || 0,
                adosRange: {
                  min: Math.min(...features.map(f => f.adosTotalScore)),
                  max: Math.max(...features.map(f => f.adosTotalScore))
                }
              };

              console.log('[DREAM] Processing complete:', {
                total: processedCount.total,
                inserted: processedCount.success,
                failed: processedCount.failed
              });

              res.json({
                success: true,
                message: 'Dataset processed successfully',
                batchId: batchId,
                processedCount: processedCount.success,
                totalCount: processedCount.total,
                summaryStats: summaryStats,
                csvFile: outputFile
              });

              setTimeout(() => {
                if (fs.existsSync(uploadedFile)) fs.unlinkSync(uploadedFile);
              }, 5000);

            } catch (dbErr) {
              console.error('[DREAM] Database error:', dbErr);
              res.status(500).json({ 
                error: 'Failed to save to database',
                details: dbErr.message 
              });
            }
          })
          .on('error', (err) => {
            console.error('[DREAM] CSV parsing error:', err);
            res.status(500).json({ 
              error: 'Failed to parse output file',
              details: err.message 
            });
          });

      } catch (processErr) {
        console.error('[DREAM] Error:', processErr);
        res.status(500).json({ error: 'Processing error', details: processErr.message });
      }
    });

  } catch (error) {
    console.error('[DREAM] POST /process-dream-dataset - Error:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

router.get('/dream-features', async (req, res) => {
  try {
    const { batchId, participantId, limit = 100, skip = 0 } = req.query;
    
    const query = {};
    if (batchId) query.batchId = batchId;
    if (participantId) query.participantId = participantId;

    const features = await DREAMFeatures.find(query)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ processedAt: -1 });

    const total = await DREAMFeatures.countDocuments(query);

    res.json({
      success: true,
      features: features,
      pagination: { total, skip: parseInt(skip), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('[DREAM] GET /dream-features - Error:', error);
    res.status(500).json({ error: 'Failed to fetch features', message: error.message });
  }
});

router.get('/dream-features/:id', async (req, res) => {
  try {
    const feature = await DREAMFeatures.findById(req.params.id);
    if (!feature) {
      return res.status(404).json({ error: 'Feature not found' });
    }
    res.json({ success: true, feature: feature });
  } catch (error) {
    console.error('[DREAM] GET /dream-features/:id - Error:', error);
    res.status(500).json({ error: 'Failed to fetch feature', message: error.message });
  }
});

router.post('/dream-features/export/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const features = await DREAMFeatures.find({ batchId: batchId });

    if (features.length === 0) {
      return res.status(404).json({ error: 'No features found for this batch' });
    }

    const csv = require('csv-stringify/sync');
    const stringifier = csv.stringify;

    const headers = [
      'Participant_ID', 'Session_Date', 'Average_Joint_Velocity', 
      'Total_Displacement_Ratio', 'Head_Gaze_Variance', 'Eye_Gaze_Consistency',
      'ADOS_Communication_Score', 'ADOS_Total_Score', 'Age_Months', 'Therapy_Condition'
    ];

    const records = features.map(f => [
      f.participantId,
      f.sessionDate,
      f.averageJointVelocity,
      f.totalDisplacementRatio,
      f.headGazeVariance,
      f.eyeGazeConsistency,
      f.adosCommunicationScore,
      f.adosTotalScore,
      f.ageMonths,
      f.therapyCondition
    ]);

    const csvContent = stringifier([headers, ...records]);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="dream_features_${batchId}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error('[DREAM] Export error:', error);
    res.status(500).json({ error: 'Export failed', message: error.message });
  }
});

// Patient Progress Tracking - Historical Data with Predictions
router.get('/patient-progress/:patientId', requireResourceAccess('children'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { metric = 'gaze' } = req.query;

    const patient = await Patient.findOne({
      _id: patientId,
      therapist_user_id: req.user.id
    });

    if (!patient) {
      return res.status(403).json({ message: 'Access denied. Patient not found.' });
    }

    const dreamFeatures = await DREAMFeatures.find({
      participantId: patient.patient_id || patientId
    }).sort({ processedAt: 1 }).limit(12);

    if (dreamFeatures.length === 0) {
      return res.json({
        historicalData: [],
        prediction: [],
        message: 'No DREAM dataset sessions available for this patient'
      });
    }

    const historicalData = dreamFeatures.map((feature, idx) => ({
      sessionNumber: idx + 1,
      sessionDate: feature.sessionDate || feature.processedAt,
      score: metric === 'gaze' 
        ? (100 - (feature.headGazeVariance || 0) * 100)
        : (feature.averageJointVelocity || 0) * 100,
      rawValue: metric === 'gaze' ? feature.headGazeVariance : feature.averageJointVelocity
    }));

    const recentData = historicalData.slice(-3);
    const avgScore = recentData.reduce((sum, d) => sum + d.score, 0) / recentData.length;
    const trend = historicalData.length > 1 
      ? ((historicalData[historicalData.length - 1].score - historicalData[0].score) / historicalData.length)
      : 0;

    const predictionData = [];
    const baseDate = new Date(historicalData[historicalData.length - 1].sessionDate);
    
    for (let i = 1; i <= 8; i++) {
      const forecastDate = new Date(baseDate);
      forecastDate.setDate(forecastDate.getDate() + (i * 7));
      
      const predictedScore = Math.min(100, avgScore + (trend * i * 1.5));
      
      predictionData.push({
        forecastWeek: i,
        forecastDate: forecastDate,
        score: Math.max(0, Math.min(100, predictedScore)),
        confidence: Math.max(60, 95 - (i * 3))
      });
    }

    res.json({
      historicalData,
      prediction: predictionData,
      summary: {
        totalSessions: historicalData.length,
        currentScore: historicalData[historicalData.length - 1].score,
        trend: trend > 0 ? 'Improving' : trend < 0 ? 'Declining' : 'Stable',
        projectedImprovement: predictionData[predictionData.length - 1].score - historicalData[historicalData.length - 1].score
      }
    });
  } catch (error) {
    console.error('Error fetching patient progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Behavioral Metrics - Latest Session Analysis
router.get('/behavioral-metrics/:patientId', requireResourceAccess('children'), async (req, res) => {
  try {
    const { patientId } = req.params;
    const { sessionId } = req.query;

    const patient = await Patient.findOne({
      _id: patientId,
      therapist_user_id: req.user.id
    });

    if (!patient) {
      return res.status(403).json({ message: 'Access denied. Patient not found.' });
    }

    let dreamFeature;
    
    if (sessionId) {
      dreamFeature = await DREAMFeatures.findById(sessionId);
    } else {
      dreamFeature = await DREAMFeatures.findOne({
        participantId: patient.patient_id || patientId
      }).sort({ processedAt: -1 });
    }

    if (!dreamFeature) {
      return res.json({
        sessionDate: new Date().toISOString().split('T')[0],
        averageJointVelocity: 0,
        headGazeVariance: 0,
        totalDisplacementRatio: 0,
        adosCommunicationScore: 0,
        adosTotalScore: 0,
        message: 'No DREAM dataset session available for this patient'
      });
    }

    res.json({
      sessionDate: dreamFeature.sessionDate || dreamFeature.processedAt,
      averageJointVelocity: dreamFeature.averageJointVelocity || 0,
      headGazeVariance: dreamFeature.headGazeVariance || 0,
      totalDisplacementRatio: dreamFeature.totalDisplacementRatio || 0,
      eyeGazeConsistency: dreamFeature.eyeGazeConsistency || 0,
      adosCommunicationScore: dreamFeature.adosCommunicationScore || 0,
      adosTotalScore: dreamFeature.adosTotalScore || 0,
      ageMonths: dreamFeature.ageMonths || 0,
      therapyCondition: dreamFeature.therapyCondition || 'Unknown',
      participantId: dreamFeature.participantId
    });
  } catch (error) {
    console.error('Error fetching behavioral metrics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a report for a student (Therapist version)
router.post('/reports', async (req, res) => {
  try {
    const { patientId, title, status } = req.body;
    
    // Verify the student exists and is accessible by this therapist
    const student = await Patient.findById(patientId);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const reportData = {
      patientId,
      title: title || `Gaze Analysis Report - ${student.name}`,
      status: status || 'final',
      teacherId: req.user.id // We use teacherId field as defined in the model, but it stores the creator ID
    };
    
    const report = new Report(reportData);
    await report.save();
    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Complete Session - Mark Appointment as Completed with Notes
router.post('/appointments/complete-session', requireResourceAccess('appointments'), async (req, res) => {
  try {
    const { appointmentId, status = 'completed', clinicalNotes } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ message: 'Appointment ID is required' });
    }

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      therapistId: req.user.id
    }).populate('childId', 'name').populate('parentId', 'username email');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found or access denied' });
    }

    appointment.status = status;
    if (clinicalNotes) {
      appointment.notes = clinicalNotes;
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Session completed successfully',
      appointment: formatAppointmentResponse(appointment)
    });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==============================================
// Patient Assignment System
// ==============================================

// Convert Guest Session to Patient
router.post('/convert-guest-to-patient', async (req, res) => {
  try {
    const { guestSessionId, patientName, patientAge, patientGender, additionalInfo } = req.body;

    if (!guestSessionId) {
      return res.status(400).json({ message: 'Guest session ID is required' });
    }

    // Find the guest session
    const guestSession = await GazeSession.findById(guestSessionId);
    if (!guestSession) {
      return res.status(404).json({ message: 'Guest session not found' });
    }

    if (!guestSession.isGuest) {
      return res.status(400).json({ message: 'This is not a guest session' });
    }

    // Check if patient already exists with this email
    const existingParent = await User.findOne({ email: guestSession.guestInfo.email });
    let parentId;

    if (existingParent) {
      parentId = existingParent._id;
      console.log(`✅ Found existing parent: ${existingParent.email}`);
    } else {
      // Create a placeholder parent account
      const newParent = new User({
        username: guestSession.guestInfo.parentName || 'Parent',
        email: guestSession.guestInfo.email,
        role: 'parent',
        status: 'approved',
        isActive: true
      });
      await newParent.save();
      parentId = newParent._id;
      console.log(`✅ Created new parent account: ${guestSession.guestInfo.email}`);
    }

    // Create patient profile
    const newPatient = new Patient({
      name: patientName || guestSession.guestInfo.childName,
      age: patientAge || 0,
      gender: patientGender || 'Not specified',
      medical_history: additionalInfo || '',
      parent_id: parentId,
      therapist_user_id: req.user.id, // Assign to current therapist
      screeningStatus: 'in-progress',
      reportStatus: 'pending'
    });

    await newPatient.save();
    console.log(`✅ Created patient: ${newPatient.name}`);

    // Link guest session to patient
    guestSession.patientId = newPatient._id;
    guestSession.therapistId = req.user.id;
    guestSession.isGuest = false;
    guestSession.sessionType = 'authenticated';
    await guestSession.save();

    // Find and link all other guest sessions with same email
    const otherGuestSessions = await GazeSession.find({
      'guestInfo.email': guestSession.guestInfo.email,
      isGuest: true,
      _id: { $ne: guestSessionId }
    });

    for (const session of otherGuestSessions) {
      session.patientId = newPatient._id;
      session.therapistId = req.user.id;
      session.isGuest = false;
      session.sessionType = 'authenticated';
      await session.save();
    }

    console.log(`✅ Linked ${otherGuestSessions.length} additional guest sessions to patient`);

    res.json({
      success: true,
      message: 'Guest successfully converted to patient',
      patient: newPatient,
      linkedSessions: otherGuestSessions.length + 1
    });

  } catch (error) {
    console.error('❌ Error converting guest to patient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add Patient Manually
router.post('/add-patient', async (req, res) => {
  try {
    const { 
      patientName, 
      patientAge, 
      patientGender, 
      medicalHistory,
      parentName,
      parentEmail,
      linkToGuestEmail // Optional: link to existing guest sessions
    } = req.body;

    if (!patientName || !patientAge || !patientGender || !parentEmail) {
      return res.status(400).json({ 
        message: 'Patient name, age, gender, and parent email are required' 
      });
    }

    // Check if parent exists or create new
    let parent = await User.findOne({ email: parentEmail });
    
    if (!parent) {
      parent = new User({
        username: parentName || 'Parent',
        email: parentEmail,
        role: 'parent',
        status: 'approved',
        isActive: true
      });
      await parent.save();
      console.log(`✅ Created new parent: ${parentEmail}`);
    }

    // Create patient
    const newPatient = new Patient({
      name: patientName,
      age: patientAge,
      gender: patientGender,
      medical_history: medicalHistory || '',
      parent_id: parent._id,
      therapist_user_id: req.user.id,
      screeningStatus: 'pending',
      reportStatus: 'pending'
    });

    await newPatient.save();
    console.log(`✅ Patient created: ${newPatient.name}`);

    // If linkToGuestEmail is provided, link all guest sessions with that email
    if (linkToGuestEmail) {
      const guestSessions = await GazeSession.find({
        'guestInfo.email': linkToGuestEmail,
        isGuest: true
      });

      for (const session of guestSessions) {
        session.patientId = newPatient._id;
        session.therapistId = req.user.id;
        session.isGuest = false;
        session.sessionType = 'authenticated';
        await session.save();
      }

      console.log(`✅ Linked ${guestSessions.length} guest sessions to patient`);

      return res.json({
        success: true,
        message: 'Patient added successfully',
        patient: newPatient,
        linkedSessions: guestSessions.length
      });
    }

    res.json({
      success: true,
      message: 'Patient added successfully',
      patient: newPatient
    });

  } catch (error) {
    console.error('❌ Error adding patient:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search Guest Sessions by Email
router.get('/search-guest-sessions', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ message: 'Email parameter is required' });
    }

    const guestSessions = await GazeSession.find({
      'guestInfo.email': email,
      isGuest: true
    }).sort({ createdAt: -1 }).limit(50);

    res.json({
      success: true,
      sessions: guestSessions,
      count: guestSessions.length
    });

  } catch (error) {
    console.error('❌ Error searching guest sessions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get All Guest Sessions for Review
router.get('/guest-sessions', async (req, res) => {
  try {
    const guestSessions = await GazeSession.find({
      isGuest: true,
      status: { $in: ['completed', 'pending_review'] }
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

    // Group by email
    const sessionsByEmail = guestSessions.reduce((acc, session) => {
      const email = session.guestInfo?.email;
      if (email) {
        if (!acc[email]) {
          acc[email] = {
            email,
            parentName: session.guestInfo?.parentName,
            childName: session.guestInfo?.childName,
            sessions: []
          };
        }
        acc[email].sessions.push(session);
      }
      return acc;
    }, {});

    res.json({
      success: true,
      guestGroups: Object.values(sessionsByEmail)
    });

  } catch (error) {
    console.error('❌ Error fetching guest sessions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
