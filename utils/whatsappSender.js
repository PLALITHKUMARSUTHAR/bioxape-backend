// ================================================================
//  BioXape — WhatsApp + SMS Sender Utility
//  FILE: utils/whatsappSender.js
//  Uses MSG91 API — sign up at https://msg91.com
// ================================================================

const axios = require('axios');

const sendWhatsApp = async ({ phone, message }) => {
  try {
    if (!process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY === 'your_msg91_auth_key') {
      console.log('⚠️  MSG91 not configured. WhatsApp skipped. Message would be:', message);
      return { success: false, skipped: true };
    }

    // Ensure phone is in international format e.g. 919876543210
    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0+/, '');

    const response = await axios.post(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      {
        "integrated_number": process.env.MSG91_WHATSAPP_NUMBER,
        "content_type": "template",
        "payload": {
          "messaging_product": "whatsapp",
          "type": "template",
          "template": {
            "name":     process.env.MSG91_TEMPLATE_ID,
            "language": { "code": "en" },
            "components": [
              {
                "type": "body",
                "parameters": [{ "type": "text", "text": message }]
              }
            ]
          },
          "to": cleanPhone
        }
      },
      {
        headers: {
          'authkey':      process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log(`✅ WhatsApp sent to ${phone}`);
    return { success: true, data: response.data };
  } catch (err) {
    console.error(`❌ WhatsApp failed to ${phone}:`, err.message);
    return { success: false, error: err.message };
  }
};

// SMS fallback
const sendSMS = async ({ phone, message }) => {
  try {
    if (!process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY === 'your_msg91_auth_key') {
      console.log('⚠️  MSG91 not configured. SMS skipped.');
      return { success: false, skipped: true };
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0+/, '');

    const response = await axios.post(
      'https://api.msg91.com/api/v5/flow/',
      {
        template_id: process.env.MSG91_TEMPLATE_ID,
        sender:      process.env.MSG91_SENDER_ID,
        mobiles:     cleanPhone,
        body:        message,
      },
      {
        headers: {
          'authkey':      process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    console.log(`✅ SMS sent to ${phone}`);
    return { success: true, data: response.data };
  } catch (err) {
    console.error(`❌ SMS failed to ${phone}:`, err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendWhatsApp, sendSMS };
