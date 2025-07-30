const admin = require('firebase-admin');
const serviceAccount = require('../nukune-e72e97115cbd.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function makePremiumUser(email, months = 12) {
  try {
    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('Found user:', userRecord.uid);

    // Calculate subscription dates
    const now = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + months);

    // Update user document with premium status
    const userRef = db.collection('users').doc(userRecord.uid);
    await userRef.update({
      isPremium: true,
      subscriptionStatus: 'active',
      subscriptionPlan: '12month',
      subscriptionStartDate: admin.firestore.Timestamp.fromDate(now),
      subscriptionEndDate: admin.firestore.Timestamp.fromDate(endDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`Successfully updated user ${email} to premium status`);
    console.log(`Subscription valid until: ${endDate.toISOString()}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// ハードコーディングでメールアドレスを指定
const email = 'varuvaru10000@yahoo.co.jp';
const months = 12;

// Run the script
makePremiumUser(email, months);