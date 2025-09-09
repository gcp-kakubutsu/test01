#!/usr/bin/env node

/**
 * payment_uidの現在の状態を確認するスクリプト
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Firebase Admin SDK初期化
let app;
try {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase configuration.');
    }
    
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: '',
      private_key: privateKey.replace(/\\n/g, '\n'),
      client_email: clientEmail,
      client_id: '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
    };
    
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId
    });
    
    console.log('✅ Firebase Admin initialized successfully');
  } else {
    app = admin.apps[0];
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function checkPaymentUids() {
  try {
    console.log('🔍 Checking payment_uid status...\n');
    
    const usersSnapshot = await db.collection('users').get();
    
    const stats = {
      total: 0,
      withPaymentUid: 0,
      withoutPaymentUid: 0,
      withEmptyString: 0,
      withNull: 0,
      withUndefined: 0,
      existingUids: []
    };
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      stats.total++;
      
      if (userData.hasOwnProperty('payment_uid')) {
        if (userData.payment_uid === null) {
          stats.withNull++;
          console.log(`❌ User ${doc.id}: payment_uid is null`);
        } else if (userData.payment_uid === undefined) {
          stats.withUndefined++;
          console.log(`❌ User ${doc.id}: payment_uid is undefined`);
        } else if (userData.payment_uid === '') {
          stats.withEmptyString++;
          console.log(`⚠️ User ${doc.id}: payment_uid is empty string`);
        } else {
          stats.withPaymentUid++;
          stats.existingUids.push({
            userId: doc.id,
            paymentUid: userData.payment_uid,
            createdAt: userData.payment_uid_created_at,
            updatedAt: userData.payment_uid_updated_at
          });
        }
      } else {
        stats.withoutPaymentUid++;
      }
    });
    
    console.log('\n📊 Summary:');
    console.log(`Total users: ${stats.total}`);
    console.log(`Users with valid payment_uid: ${stats.withPaymentUid}`);
    console.log(`Users without payment_uid field: ${stats.withoutPaymentUid}`);
    console.log(`Users with null payment_uid: ${stats.withNull}`);
    console.log(`Users with undefined payment_uid: ${stats.withUndefined}`);
    console.log(`Users with empty string payment_uid: ${stats.withEmptyString}`);
    
    if (stats.existingUids.length > 0) {
      console.log('\n✅ Users with existing payment_uid:');
      stats.existingUids.forEach(item => {
        console.log(`  - ${item.userId}: ${item.paymentUid}`);
        if (item.createdAt) {
          console.log(`    Created: ${item.createdAt.toDate ? item.createdAt.toDate() : item.createdAt}`);
        }
      });
    }
    
    // チェック条件のテスト
    console.log('\n🧪 Condition test for each user:');
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const wouldBeMigrated = !userData.payment_uid;
      const hasField = userData.hasOwnProperty('payment_uid');
      const value = userData.payment_uid;
      
      if (hasField && value) {
        console.log(`✅ ${doc.id}: Would NOT be migrated (has payment_uid: ${value})`);
      } else {
        console.log(`⚠️ ${doc.id}: Would be migrated (payment_uid: ${value}, hasField: ${hasField})`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (app) {
      await admin.app().delete();
    }
  }
}

checkPaymentUids();