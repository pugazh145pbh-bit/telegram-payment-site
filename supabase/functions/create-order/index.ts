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
    let reqBody: any = {};
    try {
      reqBody = await req.json();
    } catch {
      reqBody = {};
    }

    const apiKey = Deno.env.get("VYAPAR_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "VYAPAR_API_KEY missing in Secrets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const orderAmount = String(reqBody.amount || 199);
    const clientTxnId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payload = {
      key: apiKey.trim(),
      client_txn_id: clientTxnId,
      amount: orderAmount,
      p_info: "Telegram VIP Access",
      customer_name: "Customer",
      customer_email: "support@telegram.com",
      customer_mobile: "9999999999",
      redirect_url: "https://t.me",
      udf1: "telegram"
    };

    console.log("Sending payload to Vyapar Gateway:", JSON.stringify(payload));

    // Vyapar Gateway Live Endpoints (Fallback முறை)
    let vyaparRes = await fetch("https://api.vyapargateway.com/api/v1/create_order", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
    });

    // முதல் URL தவறானால் 2வது URL-ஐ அழைக்கும்
    if (!vyaparRes.ok || vyaparRes.status === 404) {
      vyaparRes = await fetch("https://api.vyapargateway.com/create_order", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });
    }

    const resText = await vyaparRes.text();
    console.log("Raw Vyapar Response:", resText);

    let vyaparData: any = {};
    try {
      vyaparData = JSON.parse(resText);
    } catch (e) {
      vyaparData = { raw: resText };
    }

    let qrImage = vyaparData?.data?.qr_image || 
                  vyaparData?.data?.qr_code || 
                  vyaparData?.data?.intent_url || 
                  vyaparData?.data?.payment_url ||
                  vyaparData?.qr_image;

    if (qrImage && !qrImage.startsWith("http") && !qrImage.startsWith("data:image")) {
      qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrImage)}`;
    }

    const finalOrderId = vyaparData?.data?.order_id || clientTxnId;

    if (qrImage || vyaparData?.status === true || vyaparData?.success === true) {
      return new Response(
        JSON.stringify({
          success: true,
          orderId: finalOrderId,
          qrImage: qrImage,
          paymentUrl: vyaparData?.data?.payment_url
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: vyaparData?.msg || vyaparData?.message || "Gateway Error",
          detail: vyaparData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (error: any) {
    console.error("Critical Function Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});