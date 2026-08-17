const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const signature = event.headers["x-vyapargateway-signature"];
    const timestamp = event.headers["x-vyapargateway-timestamp"];
    const rawPayload = event.body;
    const webhookSecret = process.env.VYAPAR_WEBHOOK_SECRET;

    // Signature verification
    if (signature && webhookSecret && timestamp) {
      const stringToSign = `${timestamp}.${rawPayload}`;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(stringToSign)
        .digest("hex");

      if (signature !== expectedSignature) {
        return { statusCode: 400, body: "Invalid Signature" };
      }
    }

    const payload = JSON.parse(rawPayload || "{}");
    const orderId = payload.order_id;
    const status = payload.status;

    if (status === "success" || payload.event === "payment.success") {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHANNEL_ID,
            member_limit: 1
          })
        }
      );
      const tgData = await tgRes.json();
      const inviteLink = tgData.result ? tgData.result.invite_link : "";

      await supabase
        .from("orders")
        .update({ status: "paid", telegram_link: inviteLink })
        .eq("order_id", orderId);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ received: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};