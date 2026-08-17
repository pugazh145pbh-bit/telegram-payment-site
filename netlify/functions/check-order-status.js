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

    if (!orderId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing orderId" }) };
    }

    const { data, error } = await supabase
      .from("orders")
      .select("status, telegram_link")
      .eq("order_id", orderId)
      .single();

    if (error || !data) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: data.status,
        telegramLink: data.telegram_link
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
