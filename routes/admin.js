const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Screening = require('../models/screening');
const Patient = require('../models/patient');
const Report = require('../models/report');
const sendEmail = require('../utils/email');
const { verifyToken, adminCheck } = require('../middlewares/auth');

// GET /api/admin/metrics - Real database-driven dashboard metrics
router.get('/metrics', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Count users with pending status (Pending Approvals)
    const pendingCount = await User.countDocuments({
      status: 'pending'
    });

    // Count all active users (Total Active Users)
    const activeUserCount = await User.countDocuments({
      isActive: true,
      status: { $ne: 'rejected' }
    });

    // Get screenings for current month (Screenings This Month)
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);

    const screeningsThisMonth = await Screening.countDocuments({
      createdAt: {
        $gte: firstDayOfMonth,
        $lt: firstDayOfNextMonth
      }
    });

    res.json({
      success: true,
      data: {
        pendingApprovals: pendingCount,
        totalActiveUsers: activeUserCount,
        screeningsThisMonth: screeningsThisMonth
      }
    });
  } catch (error) {
    console.error('Error fetching admin metrics:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch admin metrics', 
      details: error.message 
    });
  }
});

// Legacy endpoint for backward compatibility
router.get('/stats', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // Count all users with pending status (not just therapists)
    const pendingCount = await User.countDocuments({
      status: 'pending'
    });

    // Count all active users
    const userCount = await User.countDocuments({
      isActive: true
    });

    // Get screenings for current month
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);

    const screeningCount = await Screening.countDocuments({
      createdAt: {
        $gte: firstDayOfMonth,
        $lt: firstDayOfNextMonth
      }
    });

    res.json({
      pendingCount,
      userCount,
      screeningCount
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

// GET /api/admin/screening-trends - Month-wise screening trends (August to January)
router.get('/screening-trends', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    // Define month ranges (August to January)
    const monthRanges = [
      { month: 'August', start: new Date(currentYear, 7, 1), end: new Date(currentYear, 8, 1) },
      { month: 'September', start: new Date(currentYear, 8, 1), end: new Date(currentYear, 9, 1) },
      { month: 'October', start: new Date(currentYear, 9, 1), end: new Date(currentYear, 10, 1) },
      { month: 'November', start: new Date(currentYear, 10, 1), end: new Date(currentYear, 11, 1) },
      { month: 'December', start: new Date(currentYear, 11, 1), end: new Date(currentYear + 1, 0, 1) },
      { month: 'January', start: new Date(currentYear + 1, 0, 1), end: new Date(currentYear + 1, 1, 1) }
    ];

    // Use MongoDB aggregation for efficient counting
    const augustFirst = new Date(currentYear, 7, 1);
    const februaryFirst = new Date(currentYear + 1, 1, 1);

    const results = await Screening.aggregate([
      {
        $match: {
          createdAt: {
            $gte: augustFirst,
            $lt: februaryFirst
          }
        }
      },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Create a map for easy lookup
    const countsMap = {};
    results.forEach(result => {
      const key = `${result._id.year}-${result._id.month}`;
      countsMap[key] = result.count;
    });

    // Build the response with proper labels
    const trendsData = monthRanges.map(range => {
      const year = range.start.getFullYear();
      const month = range.start.getMonth() + 1;
      const key = `${year}-${month}`;
      
      return {
        month: range.month,
        screenings: countsMap[key] || 0
      };
    });

    res.json({
      success: true,
      data: trendsData
    });
  } catch (error) {
    console.error('Error fetching screening trends:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch screening trends', 
      details: error.message 
    });
  }
});

router.get('/therapist-requests', async (req, res) => {
  try {
    const pendingTherapists = await User.find({
      role: 'therapist',
      status: 'pending'
    }).select('-password -otp');

    res.json(pendingTherapists);
  } catch (error) {
    console.error('Error fetching therapist requests:', error);
    res.status(500).json({ error: 'Failed to fetch therapist requests', details: error.message });
  }
});

router.put('/therapist-requests/:userId/approve', verifyToken, adminCheck, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'therapist' || user.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid therapist request' });
    }

    user.status = 'approved';
    user.isActive = true;
    await user.save();

    const message = `Your therapist account has been approved! You can now access the therapist dashboard.`;
    await sendEmail({
      email: user.email,
      subject: 'Your Therapist Account Has Been Approved',
      message
    }).catch(err => console.error('Email send error:', err));

    res.json({ message: 'Therapist approved successfully', user });
  } catch (error) {
    console.error('Error approving therapist:', error);
    res.status(500).json({ error: 'Failed to approve therapist', details: error.message });
  }
});

router.put('/therapist-requests/:userId/reject', verifyToken, adminCheck, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'therapist' || user.status !== 'pending') {
      return res.status(400).json({ error: 'Invalid therapist request' });
    }

    user.status = 'rejected';
    user.isActive = false;
    await user.save();

    const message = `Your therapist account registration has been rejected. ${reason ? `Reason: ${reason}` : 'Please contact support for more information.'}`;
    await sendEmail({
      email: user.email,
      subject: 'Your Therapist Account Registration',
      message
    }).catch(err => console.error('Email send error:', err));

    res.json({ message: 'Therapist rejected successfully', user });
  } catch (error) {
    console.error('Error rejecting therapist:', error);
    res.status(500).json({ error: 'Failed to reject therapist', details: error.message });
  }
});

// Get notifications (therapist requests + new registrations)
router.get('/notifications', verifyToken, adminCheck, async (req, res) => {
  try {
    const pendingTherapists = await User.countDocuments({
      role: 'therapist',
      status: 'pending'
    });

    const recentRegistrations = await Patient.countDocuments({
      createdAt: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    });

    const pendingScreenings = await Patient.countDocuments({
      screeningStatus: { $regex: /^pending$/i }
    });

    const pendingReports = await Patient.countDocuments({
      reportStatus: { $regex: /^pending$/i }
    });

    res.json({
      pendingTherapists,
      recentRegistrations,
      pendingScreenings,
      pendingReports
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
});

// Get children registered by parents with their screening and report data
router.get('/children-data', verifyToken, adminCheck, async (req, res) => {
  try {
    const children = await Patient.find()
      .populate('parent_id', 'username email')
      .sort({ createdAt: -1 })
      .limit(100);

    const childrenWithData = await Promise.all(children.map(async (child) => {
      const screening = await Screening.findOne({ patientId: child._id });
      const report = await Report.findOne({ patientId: child._id });

      return {
        ...child.toObject(),
        screeningData: screening || null,
        reportData: report || null
      };
    }));

    res.json(childrenWithData);
  } catch (error) {
    console.error('Error fetching children data:', error);
    res.status(500).json({ error: 'Failed to fetch children data', details: error.message });
  }
});

// Get children by parent ID with screening and report data
router.get('/children-data/:parentId', verifyToken, adminCheck, async (req, res) => {
  try {
    const { parentId } = req.params;
    const children = await Patient.find({ parent_id: parentId })
      .sort({ createdAt: -1 });

    const childrenWithData = await Promise.all(children.map(async (child) => {
      const screening = await Screening.findOne({ patientId: child._id });
      const report = await Report.findOne({ patientId: child._id });

      return {
        ...child.toObject(),
        screeningData: screening || null,
        reportData: report || null
      };
    }));

    res.json(childrenWithData);
  } catch (error) {
    console.error('Error fetching children data:', error);
    res.status(500).json({ error: 'Failed to fetch children data', details: error.message });
  }
});

// Get recent therapist requests (for notification dropdown)
router.get('/recent-therapist-requests', verifyToken, adminCheck, async (req, res) => {
  try {
    const requests = await User.find({
      role: 'therapist',
      status: 'pending'
    })
      .select('-password -otp')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json(requests);
  } catch (error) {
    console.error('Error fetching recent therapist requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests', details: error.message });
  }
});

// Get all active therapists
router.get('/therapists', verifyToken, adminCheck, async (req, res) => {
  try {
    const therapists = await User.find({
      role: 'therapist',
      isActive: true,
      status: 'approved'
    })
      .select('_id username firstName lastName email')
      .sort({ username: 1 });

    const formattedTherapists = therapists.map(t => ({
      id: t._id,
      name: `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.username || t.email,
      email: t.email
    }));

    res.json(formattedTherapists);
  } catch (error) {
    console.error('Error fetching therapists:', error);
    res.status(500).json({ error: 'Failed to fetch therapists', details: error.message });
  }
});

// Assign therapist to patient
router.put('/children/:childId/assign-therapist', verifyToken, adminCheck, async (req, res) => {
  try {
    const { childId } = req.params;
    const { therapistId } = req.body;

    if (!therapistId) {
      return res.status(400).json({ error: 'Therapist ID is required' });
    }

    const patient = await Patient.findById(childId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const therapist = await User.findOne({
      _id: therapistId,
      role: 'therapist',
      isActive: true,
      status: 'approved'
    });

    if (!therapist) {
      return res.status(404).json({ error: 'Therapist not found or inactive' });
    }

    patient.therapist_user_id = therapistId;
    await patient.save();

    const therapistName = `${therapist.firstName || ''} ${therapist.lastName || ''}`.trim() || therapist.username;
    res.json({
      success: true,
      message: `Patient assigned to therapist ${therapistName}`,
      patient
    });
  } catch (error) {
    console.error('Error assigning therapist:', error);
    res.status(500).json({ error: 'Failed to assign therapist', details: error.message });
  }
});

// Unassign therapist from patient
router.put('/children/:childId/unassign-therapist', verifyToken, adminCheck, async (req, res) => {
  try {
    const { childId } = req.params;

    const patient = await Patient.findById(childId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    patient.therapist_user_id = null;
    await patient.save();

    res.json({
      success: true,
      message: 'Therapist unassigned from patient',
      patient
    });
  } catch (error) {
    console.error('Error unassigning therapist:', error);
    res.status(500).json({ error: 'Failed to unassign therapist', details: error.message });
  }
});

module.exports = router;
