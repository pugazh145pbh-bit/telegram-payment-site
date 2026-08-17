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
    const { amount } = JSON.parse(event.body || "{}");
    const orderAmount = amount || 199;
    const orderId = "ORD_" + Date.now();

    // VyaparGateway API
    const response = await fetch("https://api.vyapargateway.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.VYAPAR_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: orderAmount,
        order_id: orderId
      })
    });

    const data = await response.json();
    const finalOrderId = data.id || orderId;
    const qrUrl = data.qr_url || data.qr_image || "";

    // Save order in Supabase
    await supabase.from("orders").insert([
      {
        order_id: finalOrderId,
        amount: orderAmount,
        status: "pending"
      }
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        orderId: finalOrderId,
        amount: orderAmount,
        qrImage: qrUrl
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
