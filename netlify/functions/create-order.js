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
    // Test price set to 1 (Change to 199 later)
    const orderAmount = Number(amount) || 1;

    // Generate clean numeric ID for display & unique client transaction ID
    const userNumericId = Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000);
    const clientTxnId = "TXN_" + userNumericId;

    const response = await fetch("https://vyapargateway.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: process.env.VYAPAR_API_KEY,
        amount: orderAmount,
        client_txn_id: clientTxnId,
        p_info: "Private Telegram Access",
        customer_name: "Customer"
      })
    });

    const data = await response.json();

    if (!data.status || !data.data) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.msg || "Gateway error" })
      };
    }

    const finalOrderId = data.data.order_id;
    const qrCodeImage = data.data.qr_code;

    // Save initial order in Supabase
    await supabase.from("orders").upsert([
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
        numericTxnId: userNumericId,
        amount: orderAmount,
        qrImage: qrCodeImage
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};