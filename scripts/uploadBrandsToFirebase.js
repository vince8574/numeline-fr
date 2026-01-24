// Upload brands.json to Firebase Storage
// Run: node scripts/uploadBrandsToFirebase.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
// Make sure you have downloaded your service account key from Firebase Console
// and saved it as firebase-admin-key.json in the project root
try {
  const serviceAccount = require('../firebase-admin-key.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'gs://your-project-id.appspot.com' // Replace with your actual bucket
  });
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:');
  console.error('Please download your service account key from Firebase Console and save it as firebase-admin-key.json');
  console.error('https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk');
  process.exit(1);
}

const bucket = admin.storage().bucket();
const filePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets', 'brands.json');

console.log('📦 Uploading brands.json to Firebase Storage...');
console.log(`   File: ${filePath}`);

// Upload the file
bucket.upload(filePath, {
  destination: 'brands/brands.json',
  metadata: {
    contentType: 'application/json',
    cacheControl: 'public, max-age=86400', // Cache for 1 day
  },
  public: true, // Make file publicly accessible
}, (err, file) => {
  if (err) {
    console.error('❌ Upload failed:', err);
    process.exit(1);
  }

  // Get the public URL
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/brands/brands.json`;

  console.log('✅ Upload successful!');
  console.log(`📎 Public URL: ${publicUrl}`);
  console.log('');
  console.log('Copy this URL and use it in src/services/brandMatcher.ts');

  process.exit(0);
});
