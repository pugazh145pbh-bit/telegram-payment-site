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

    const numAmount = parseFloat(reqBody.amount || "199");
    const clientTxnId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // VyaparGateway Documentation-க்கு ஏற்ற சரியான Payload
    const payload = {
      key: apiKey,
      client_txn_id: clientTxnId,
      amount: numAmount,
      p_info: "Telegram VIP Access",
      customer_name: "Customer",
      customer_email: "support@telegram.com",
      customer_mobile: "9999999999",
      redirect_url: "https://t.me",
      callback_url: "https://wzqbscqagrilewsvjlhq.supabase.co/functions/v1/webhook",
      udf1: "telegram"
    };

    console.log("Sending payload to Vyapar:", JSON.stringify(payload));

    // சரியான அதிகாரப்பூர்வ URL
    const vyaparRes = await fetch("https://vyapargateway.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
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

    if (vyaparData?.status === true && vyaparData?.data) {
      const qrCode = vyaparData.data.qr_code;
      const orderId = vyaparData.data.order_id || clientTxnId;
      const paymentUrl = vyaparData.data.payment_url || vyaparData.data.upi_string;

      return new Response(
        JSON.stringify({
          success: true,
          orderId: orderId,
          qrImage: qrCode,
          paymentUrl: paymentUrl,
          upiIntent: vyaparData.data.upi_intent
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: vyaparData?.msg || "Gateway Error",
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