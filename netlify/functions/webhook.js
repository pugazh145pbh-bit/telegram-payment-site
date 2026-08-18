const crypto = require('crypto');
const { createClient } = require("@supabase/supabase-js");

// Supabase Database Connection
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  // Ensure Webhook receives only POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    // 1. Extract Headers sent by Vyapar Gateway
    const signature = event.headers['x-vyapargateway-signature'];
    const timestamp = event.headers['x-vyapargateway-timestamp'];
    const webhookSecret = process.env.VYAPAR_WEBHOOK_SECRET;

    const payloadObj = JSON.parse(event.body);

    // 2. Signature Verification for Security
    if (signature && timestamp && webhookSecret) {
        // Sort keys and convert payload to string as per documentation
        const payloadJson = JSON.stringify(payloadObj, Object.keys(payloadObj).sort());
        const stringToSign = `${timestamp}.${payloadJson}`;

        // Generate HMAC-SHA256 signature
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(stringToSign)
          .digest('hex');

        // Reject if signatures do not match
        if (signature !== expectedSignature) {
            console.error("Invalid Webhook Signature!");
            return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signature' }) };
        }
    } else {
        console.warn("Missing signature headers or webhook secret");
    }

    // 3. Check if payment is successful
    // Dynamic QR payload returns status: "success"
    if (payloadObj.status === "success") {
        const orderId = payloadObj.order_id; 

        // Create Telegram Invite Link
        const tgRes = await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: process.env.TELEGRAM_CHANNEL_ID,
                    member_limit: 1, // Limit to 1 member only
                    expire_date: Math.floor(Date.now() / 1000) + 3600 // Expire in exactly 1 hour
                })
            }
        );
        
        const tgData = await tgRes.json();
        const inviteLink = tgData.result ? tgData.result.invite_link : "";

        // Update order status as Paid in Supabase database
        await supabase
            .from("orders")
            .update({ status: "paid", telegram_link: inviteLink })
            .eq("order_id", orderId);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ received: true, message: "Payment processed successfully" })
        };
    }

    // If payment is not successful (pending / failed)
    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received: true, status: payloadObj.status })
    };

  } catch (error) {
    console.error("Webhook processing error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};