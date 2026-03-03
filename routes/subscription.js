const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/user');
const { verifyToken } = require('../middlewares/auth');

// Log Razorpay credentials on startup (masked for security)
console.log('Razorpay Configuration:', {
    key_id: process.env.RAZORPAY_KEY_ID ? `${process.env.RAZORPAY_KEY_ID.substring(0, 10)}...` : 'MISSING',
    key_secret: process.env.RAZORPAY_KEY_SECRET ? 'SET' : 'MISSING'
});

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create Order (Public Route)
router.post('/create-order', async (req, res) => {
    try {
        const { email, name, isSpeechOnly } = req.body;
        
        console.log('Creating Razorpay order for:', email || 'anonymous');
        
        const options = {
            amount: 99900, // ₹999 in paise
            currency: 'INR',
            receipt: `speech_therapy_pro_${Date.now()}`,
            notes: {
                email: email,
                isSpeechOnly: isSpeechOnly,
                plan: 'Speech Therapy Pro'
            }
        };

        const order = await razorpay.orders.create(options);
        console.log('Razorpay order created:', order.id);
        
        res.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Razorpay Order Error:', error);
        res.status(500).json({ message: 'Error creating Razorpay order', error: error.message });
    }
});

// Verify Payment
router.post('/verify-payment', async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return verifyToken(req, res, next);
    }
    next();
}, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, isSpeechOnly, childId, parentId } = req.body;
        const userId = req.user ? req.user.id : null;
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💳 [PAYMENT VERIFICATION] Starting...');
        console.log('  👤 User ID:', userId);
        console.log('  📧 Email:', email);
        console.log('  👶 Child ID:', childId);
        console.log('  👨‍👩‍👧 Parent ID:', parentId);
        console.log('  🎯 Order ID:', razorpay_order_id);
        console.log('  💰 Payment ID:', razorpay_payment_id);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Validate Razorpay signature
        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

        if (razorpay_signature !== expectedSign) {
            console.error('❌ Invalid payment signature');
            return res.status(400).json({ 
                success: false,
                message: 'Invalid payment signature' 
            });
        }
        
        console.log('✅ Payment signature verified successfully!');
        
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year subscription
        console.log('📅 Subscription expiry date set to:', expiryDate.toISOString());

        // CRITICAL: Child-based subscription logic
        if (childId) {
            const SpeechChild = require('../models/SpeechChild');
            const Patient = require('../models/patient');
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('👶 [CHILD SUBSCRIPTION] Processing update...');
            console.log('  🆔 Child ID:', childId);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // Try SpeechChild model first (new lightweight architecture)
            let child = await SpeechChild.findById(childId);
            
            if (child) {
                console.log('✅ Found SpeechChild in database');
                console.log('  📝 Child Name:', child.childName);
                console.log('  🔗 Parent ID (in DB):', child.parentId.toString());
                
                // Verify parentId if provided (security check)
                if (parentId && child.parentId.toString() !== parentId) {
                    console.error('❌ SECURITY VIOLATION: Child does not belong to specified parent');
                    console.error('  🔴 Child\'s parentId:', child.parentId.toString());
                    console.error('  🔴 Provided parentId:', parentId);
                    return res.status(403).json({ 
                        success: false,
                        message: 'Unauthorized: Child does not belong to this parent' 
                    });
                }
                
                console.log('✅ Parent verification passed');
                console.log('📅 Setting subscription expiry to:', expiryDate.toISOString());
                
                child.subscriptionExpiry = expiryDate;
                await child.save();
                
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('🎉 [SUCCESS] SpeechChild subscription activated!');
                console.log('  👶 Child ID:', childId);
                console.log('  📝 Child Name:', child.childName);
                console.log('  📅 Expires:', expiryDate.toISOString());
                console.log('  ⏰ Valid for (days):', Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24)));
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                
                return res.json({ 
                    success: true,
                    message: 'Payment verified and subscription activated',
                    childId: child._id,
                    childName: child.childName,
                    status: 'ACTIVE',
                    expiry: expiryDate
                });
            }
            
            // Fallback to Patient model (legacy/full auth)
            console.log('⚠️  SpeechChild not found, trying Patient model...');
            child = await Patient.findById(childId);
            if (child) {
                console.log('✓ Found Patient child');
                child.subscriptionStatus = 'active';
                child.subscriptionExpiry = expiryDate;
                await child.save();
                console.log('✅ Patient child subscription updated successfully!');
                
                return res.json({ 
                    success: true,
                    message: 'Payment verified and subscription activated',
                    childId: child._id,
                    status: 'ACTIVE',
                    expiry: expiryDate
                });
            }
            
            // Child not found
            console.error('❌ Child not found with ID:', childId);
            return res.status(404).json({ 
                success: false,
                message: 'Child not found. Please register child profile first.' 
            });
        }

        // Fallback: Update User (if not child-based)
        if (userId && !isSpeechOnly) {
            await User.findByIdAndUpdate(userId, {
                plan: 'PRO',
                planExpiry: expiryDate,
                razorpayPaymentId: razorpay_payment_id,
                trialUsed: true
            });
            console.log('Full user upgraded to PRO:', userId);
            
            return res.json({ 
                success: true,
                message: 'Payment verified successfully',
                plan: 'PRO',
                planExpiry: expiryDate
            });
        } 
        
        if (email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                existingUser.plan = 'PRO';
                existingUser.planExpiry = expiryDate;
                existingUser.razorpayPaymentId = razorpay_payment_id;
                existingUser.trialUsed = true;
                await existingUser.save();
                console.log('Found user by email and upgraded to PRO:', email);
                
                return res.json({ 
                    success: true,
                    message: 'Payment verified successfully',
                    plan: 'PRO',
                    planExpiry: expiryDate
                });
            } else {
                console.log('Speech-only user verified (no full account yet):', email);
                return res.json({ 
                    success: true,
                    message: 'Payment verified but no child linked. Please select a child.',
                    plan: 'PRO',
                    planExpiry: expiryDate
                });
            }
        }
        
        // No valid target found
        return res.status(400).json({ 
            success: false,
            message: 'No valid subscription target (childId required)' 
        });

    } catch (error) {
        console.error('Verify Payment Error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error verifying payment', 
            error: error.message 
        });
    }
});

// Start Free Trial
router.post('/start-trial', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (user.trialUsed) {
            return res.status(400).json({ message: 'Free trial already used' });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7); // 7-day trial

        await User.findByIdAndUpdate(req.user.id, {
            plan: 'PRO',
            planExpiry: expiryDate,
            trialUsed: true
        });

        res.json({ message: '7-day free trial started successfully', expiryDate });
    } catch (error) {
        console.error('Start Trial Error:', error);
        res.status(500).json({ message: 'Error starting free trial' });
    }
});

// Get Subscription Status
router.get('/status', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('plan planExpiry trialUsed');
        
        // Check if plan has expired
        if (user.plan === 'PRO' && user.planExpiry && new Date() > user.planExpiry) {
            user.plan = 'FREE';
            await user.save();
        }

        res.json({
            plan: user.plan,
            planExpiry: user.planExpiry,
            trialUsed: user.trialUsed
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching subscription status' });
    }
});

module.exports = router;