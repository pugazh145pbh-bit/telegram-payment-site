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
    const { orderId } = JSON.parse(event.body || "{}");

    // 1. Check in Supabase first
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (order && order.status === "paid") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          telegramLink: order.telegram_link
        })
      };
    }

    // 2. Poll VyaparGateway Status directly
    const response = await fetch("https://vyapargateway.com/api/v1/check_order_status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: process.env.VYAPAR_API_KEY,
        order_id: orderId
      })
    });

    const data = await response.json();

    if (data.status && data.data && data.data.status === "success") {
      // Create Telegram Invite Link
      const tgRes = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHANNEL_ID,
            member_limit: 1,
          }),
        }
      );
      const tgData = await tgRes.json();
      const inviteLink = tgData.result ? tgData.result.invite_link : "";

      // Update Supabase
      await supabase
        .from("orders")
        .update({ status: "paid", telegram_link: inviteLink })
        .eq("order_id", orderId);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          telegramLink: inviteLink
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};