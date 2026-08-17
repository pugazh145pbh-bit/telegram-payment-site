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

    let qrCodeUrl = "";

    // VyaparGateway Create Order API Call
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
    console.log("VyaparGateway Response:", JSON.stringify(data));

    // VyaparGateway தரும் QR URL அல்லது Base64 தரவை எடுத்தல்
    qrCodeUrl = data.qr_url || data.qr_code || data.qr_image || data.upi_qr || (data.data && data.data.qr_url) || "";

    // Supabase Database-ல் சேமித்தல்
    await supabase.from("orders").insert([
      {
        order_id: orderId,
        amount: orderAmount,
        status: "pending"
      }
    ]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        orderId: orderId,
        amount: orderAmount,
        qrImage: qrCodeUrl
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
