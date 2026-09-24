import { sendOtpEmail } from '../services/email.service.js';

const to = process.argv[2] ?? 'test@example.com';

sendOtpEmail({ to, otp: '123456', purpose: 'Registration' })
  .then(() => console.log('sendOtpEmail resolved OK'))
  .catch((err) => console.error('sendOtpEmail threw:', err));
