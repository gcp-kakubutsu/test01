#!/usr/bin/env node

/**
 * 既存のpayment_uidをバックアップするスクリプト
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
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

async function backupPaymentUids() {
  try {
    console.log('📦 Creating backup of payment_uids...\n');
    
    const usersSnapshot = await db.collection('users').get();
    const backup = {
      timestamp: new Date().toISOString(),
      totalUsers: usersSnapshot.size,
      users: []
    };
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.payment_uid) {
        backup.users.push({
          userId: doc.id,
          payment_uid: userData.payment_uid,
          payment_uid_created_at: userData.payment_uid_created_at ? 
            (userData.payment_uid_created_at.toDate ? userData.payment_uid_created_at.toDate().toISOString() : userData.payment_uid_created_at) : null,
          payment_uid_updated_at: userData.payment_uid_updated_at ? 
            (userData.payment_uid_updated_at.toDate ? userData.payment_uid_updated_at.toDate().toISOString() : userData.payment_uid_updated_at) : null
        });
      }
    });
    
    const backupFileName = `payment_uids_backup_${new Date().toISOString().replace(/:/g, '-')}.json`;
    const backupPath = path.join(__dirname, backupFileName);
    
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`✅ Backup created successfully: ${backupFileName}`);
    console.log(`📊 Backed up ${backup.users.length} payment_uids out of ${backup.totalUsers} total users`);
    console.log(`📁 Backup location: ${backupPath}`);
    
    return backupPath;
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  } finally {
    if (app) {
      await admin.app().delete();
    }
  }
}

backupPaymentUids();