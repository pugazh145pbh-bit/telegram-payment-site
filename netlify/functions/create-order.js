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
    const orderAmount = Number(amount) || 1;

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
        body: JSON.stringify({ error: data.msg || "Gateway rejected request" })
      };
    }

    const finalOrderId = data.data.order_id;
    const qrCodeImage = data.data.qr_code;

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