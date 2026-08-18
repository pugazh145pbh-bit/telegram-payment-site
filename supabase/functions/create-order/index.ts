import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { amount } = await req.json();
    const apiKey = Deno.env.get("VYAPAR_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "VYAPAR_API_KEY missing in Secrets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const clientTxnId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // சரியான Vyapar / EkQR API Endpoint
    const vyaparRes = await fetch("https://merchant.vyapargateway.com/api/create_order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: apiKey,
        client_txn_id: clientTxnId,
        amount: String(amount || 199),
        p_info: "VIP Access",
        customer_name: "Member",
        customer_email: "member@telegram.com",
        customer_mobile: "9876543210",
        redirect_url: "https://t.me",
        udf1: "telegram_channel"
      }),
    });

    const vyaparData = await vyaparRes.json();
    console.log("Vyapar Gateway Response:", JSON.stringify(vyaparData));

    // Dynamic QR மற்றும் Payment Data பிரித்தெடுத்தல்
    let qrImage = vyaparData?.data?.qr_image || 
                  vyaparData?.data?.qr_code || 
                  vyaparData?.data?.intent_url || 
                  vyaparData?.data?.payment_url;

    if (qrImage && !qrImage.startsWith("http") && !qrImage.startsWith("data:image")) {
      qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrImage)}`;
    }

    const orderId = vyaparData?.data?.order_id || clientTxnId;

    if (qrImage) {
      return new Response(
        JSON.stringify({
          success: true,
          orderId: orderId,
          qrImage: qrImage,
          paymentUrl: vyaparData?.data?.payment_url
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Vyapar Response Error",
          detail: vyaparData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});