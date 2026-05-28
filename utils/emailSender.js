// ================================================================
//  BioXape — Email Sender Utility
//  FILE: utils/emailSender.js
//  Uses Nodemailer with Gmail App Password
// ================================================================

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 5000, // 5 seconds connection timeout
  greetingTimeout: 5000,   // 5 seconds SMTP greeting timeout
  socketTimeout: 5000,     // 5 seconds socket inactivity timeout
});

// Verify SMTP connection on load
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection verification failed:', error.message);
  } else {
    console.log('🚀 SMTP server is ready to take messages');
  }
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from:    `"BioXape" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail };
