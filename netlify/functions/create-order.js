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
    const clientTxnId = "TXN_" + Date.now();

    // VyaparGateway Official Create Order Call
    const response = await fetch("https://vyapargateway.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: process.env.VYAPAR_API_KEY,
        amount: orderAmount,
        client_txn_id: clientTxnId,
        p_info: "Private Telegram Access"
      })
    });

    const data = await response.json();
    console.log("VyaparGateway Response:", JSON.stringify(data));

    if (!data.status || !data.data) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.msg || "API Error from Gateway" })
      };
    }

    const finalOrderId = data.data.order_id;
    const qrCodeImage = data.data.qr_code; // Base64 QR Image from Vyapar

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
        qrImage: qrCodeImage
      })
    };
  } catch (error) {
    console.error("Backend Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};