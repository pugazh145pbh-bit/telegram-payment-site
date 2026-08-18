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

    const apiKey = (Deno.env.get("VYAPAR_API_KEY") || "").trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key missing in Supabase Secrets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const orderAmount = String(reqBody.amount || 199);
    const clientTxnId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payload = {
      key: apiKey,
      client_txn_id: clientTxnId,
      amount: orderAmount,
      p_info: "Telegram VIP Access",
      customer_name: "Customer",
      customer_email: "support@telegram.com",
      customer_mobile: "9876543210",
      redirect_url: "https://t.me",
      udf1: "telegram"
    };

    console.log("Sending payload:", JSON.stringify(payload));

    const vyaparRes = await fetch("https://merchant.vyapargateway.com/api/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "x-api-key": apiKey
      },
      body: JSON.stringify(payload),
    });

    const resText = await vyaparRes.text();
    console.log("Raw Vyapar Response:", resText);

    let vyaparData: any = {};
    try {
      vyaparData = JSON.parse(resText);
    } catch {
      vyaparData = { raw: resText };
    }

    let qrImage = vyaparData?.data?.qr_image || 
                  vyaparData?.data?.qr_code || 
                  vyaparData?.data?.intent_url || 
                  vyaparData?.data?.payment_url;

    if (qrImage && (qrImage.startsWith("upi://") || !qrImage.startsWith("http"))) {
      qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrImage)}`;
    }

    const finalOrderId = vyaparData?.data?.order_id || clientTxnId;

    if (qrImage || vyaparData?.status === true) {
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
          error: vyaparData?.msg || "Unauthorized / Invalid Key",
          detail: vyaparData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});