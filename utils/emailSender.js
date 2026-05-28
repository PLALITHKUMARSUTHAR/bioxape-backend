// ================================================================
//  BioXape — Email Sender Utility
//  FILE: utils/emailSender.js
//  Uses Nodemailer with Gmail App Password
// ================================================================

const nodemailer = require('nodemailer');

const transportConfig = process.env.EMAIL_HOST
  ? {
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 2525,
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    }
  : {
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    };

const transporter = nodemailer.createTransport(transportConfig);

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
      from:    `"BioXape" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
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
