#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs
 *
 * Then copy the output into your .env.local file.
 */

import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('  VAPID Keys Generated — Add to .env.local');
console.log('═══════════════════════════════════════════════════');
console.log('');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('');
console.log('Also generate a random secret for the push API:');
console.log(`PUSH_API_SECRET=${crypto.randomUUID()}`);
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('');
