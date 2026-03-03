/**
 * Development Utility: Clear All Speech Therapy Subscriptions
 * 
 * This script removes all subscription data from the database
 * to test fresh start scenarios in development.
 */

const mongoose = require('mongoose');

async function clearAllSubscriptions() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧹 [DEV MODE] Clearing all subscriptions...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const SpeechChild = require('../models/SpeechChild');
    const Patient = require('../models/patient');
    const User = require('../models/user');
    
    // Clear subscriptions from SpeechChild model
    const speechChildResult = await SpeechChild.updateMany(
      {},
      { $set: { subscriptionExpiry: null } }
    );
    console.log(`✅ Cleared ${speechChildResult.modifiedCount} SpeechChild subscriptions`);
    
    // Clear subscriptions from Patient model (if any)
    const patientResult = await Patient.updateMany(
      {},
      { 
        $set: { 
          subscriptionStatus: null,
          subscriptionExpiry: null 
        } 
      }
    );
    console.log(`✅ Cleared ${patientResult.modifiedCount} Patient subscriptions`);
    
    // Clear Pro plans from User model (if any)
    const userResult = await User.updateMany(
      { plan: 'PRO' },
      { 
        $set: { 
          plan: 'FREE',
          planExpiry: null 
        } 
      }
    );
    console.log(`✅ Reset ${userResult.modifiedCount} User Pro plans to FREE`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 All subscriptions cleared!');
    console.log('   App will start in FREE mode');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error) {
    console.error('❌ Error clearing subscriptions:', error);
  }
}

module.exports = { clearAllSubscriptions };
