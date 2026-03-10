import dotenv from 'dotenv';
dotenv.config({ override: true });

console.log('ENV CHECK:');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
