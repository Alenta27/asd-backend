const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { verifyToken, therapistCheck, requireResourceAccess } = require('../middlewares/auth');
const User = require('../models/user');
const Patient = require('../models/patient');
const Report = require('../models/report');
const Slot = require('../models/slot');
const Appointment = require('../models/appointment');

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

// Get billing information
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
const path = require('path');

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

module.exports = router;
