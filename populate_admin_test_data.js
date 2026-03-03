/**
 * Populate Test Data for Admin Dashboard
 * 
 * This script creates sample users and screenings to test the Admin Dashboard
 * with real database data across all months (August - January).
 * 
 * Run: node populate_admin_test_data.js
 */

const mongoose = require('mongoose');
const User = require('./models/user');
const Screening = require('./models/screening');

// MongoDB Connection - Load from environment
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/asd_database';

async function populateTestData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Create test users
    const testUsers = [
      // Active Parents
      { username: 'Parent1', email: 'parent1@test.com', password: 'test123', role: 'parent', status: 'approved', isActive: true },
      { username: 'Parent2', email: 'parent2@test.com', password: 'test123', role: 'parent', status: 'approved', isActive: true },
      { username: 'Parent3', email: 'parent3@test.com', password: 'test123', role: 'parent', status: 'approved', isActive: true },
      { username: 'Parent4', email: 'parent4@test.com', password: 'test123', role: 'parent', status: 'approved', isActive: true },
      { username: 'Parent5', email: 'parent5@test.com', password: 'test123', role: 'parent', status: 'approved', isActive: true },
      
      // Active Therapists
      { username: 'Therapist1', email: 'therapist1@test.com', password: 'test123', role: 'therapist', status: 'approved', isActive: true },
      { username: 'Therapist2', email: 'therapist2@test.com', password: 'test123', role: 'therapist', status: 'approved', isActive: true },
      { username: 'Therapist3', email: 'therapist3@test.com', password: 'test123', role: 'therapist', status: 'approved', isActive: true },
      
      // Pending Users (for Pending Approvals metric)
      { username: 'PendingTherapist1', email: 'pending1@test.com', password: 'test123', role: 'therapist', status: 'pending', isActive: false },
      { username: 'PendingTherapist2', email: 'pending2@test.com', password: 'test123', role: 'therapist', status: 'pending', isActive: false },
      { username: 'PendingParent1', email: 'pending3@test.com', password: 'test123', role: 'parent', status: 'pending', isActive: false },
    ];

    console.log('\\n📝 Creating test users...');
    const createdUsers = [];
    for (const userData of testUsers) {
      const existing = await User.findOne({ email: userData.email });
      if (!existing) {
        const user = await User.create(userData);
        createdUsers.push(user);
        console.log(`   ✅ Created: ${userData.username} (${userData.role}, ${userData.status})`);
      } else {
        createdUsers.push(existing);
        console.log(`   ⏭️  Exists: ${userData.username}`);
      }
    }

    // Create screenings across different months
    console.log('\\n📊 Creating test screenings...');
    
    const currentYear = new Date().getFullYear();
    const monthData = [
      { month: 'August', monthIndex: 7, count: 52 },
      { month: 'September', monthIndex: 8, count: 61 },
      { month: 'October', monthIndex: 9, count: 75 },
      { month: 'November', monthIndex: 10, count: 68 },
      { month: 'December', monthIndex: 11, count: 83 },
      { month: 'January', monthIndex: 0, count: 45, year: currentYear + 1 }
    ];

    let totalCreated = 0;
    for (const monthInfo of monthData) {
      const year = monthInfo.year || currentYear;
      const daysInMonth = new Date(year, monthInfo.monthIndex + 1, 0).getDate();
      
      console.log(`\\n   Creating ${monthInfo.count} screenings for ${monthInfo.month} ${year}...`);
      
      for (let i = 0; i < monthInfo.count; i++) {
        // Random day in the month
        const day = Math.floor(Math.random() * daysInMonth) + 1;
        const createdAt = new Date(year, monthInfo.monthIndex, day, 
                                   Math.floor(Math.random() * 24), 
                                   Math.floor(Math.random() * 60));
        
        // Random user from created users
        const randomUser = createdUsers[Math.floor(Math.random() * createdUsers.length)];
        
        const screening = {
          userId: randomUser._id,
          childName: `Child_${i + 1}`,
          screeningType: ['facial', 'gaze', 'voice', 'questionnaire'][Math.floor(Math.random() * 4)],
          result: ['low_risk', 'medium_risk', 'high_risk'][Math.floor(Math.random() * 3)],
          createdAt: createdAt
        };
        
        await Screening.create(screening);
        totalCreated++;
      }
      console.log(`   ✅ Created ${monthInfo.count} screenings for ${monthInfo.month}`);
    }

    console.log(`\\n✅ Successfully created ${totalCreated} test screenings!`);

    // Display summary
    console.log('\\n📊 Dashboard Metrics Summary:');
    const pendingCount = await User.countDocuments({ status: 'pending' });
    const activeUserCount = await User.countDocuments({ isActive: true });
    const currentMonth = new Date().getMonth();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
    const screeningsThisMonth = await Screening.countDocuments({
      createdAt: { $gte: firstDayOfMonth, $lt: firstDayOfNextMonth }
    });

    console.log(`   Pending Approvals: ${pendingCount}`);
    console.log(`   Total Active Users: ${activeUserCount}`);
    console.log(`   Screenings This Month: ${screeningsThisMonth}`);

    console.log('\\n🎯 Test data population complete!');
    console.log('   You can now test the Admin Dashboard with real data.');
    
  } catch (error) {
    console.error('❌ Error populating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
populateTestData();
