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
      console.error("VYAPAR_API_KEY missing in Secrets");
      return new Response(
        JSON.stringify({ success: false, error: "API Key missing in Supabase Secrets" }),
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

    console.log("Sending payload to Vyapar:", JSON.stringify(payload));

    const vyaparRes = await fetch("https://api.ekqr.in/api/create_order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const resText = await vyaparRes.text();
    console.log("Raw Vyapar Response:", resText);

    let vyaparData: any = {};
    try {
      vyaparData = JSON.parse(resText);
    } catch (e) {
      vyaparData = { raw: resText };
    }

    // QR Code / Intent URL எடுக்கும் முறை
    let qrImage = vyaparData?.data?.qr_image || 
                  vyaparData?.data?.qr_code || 
                  vyaparData?.data?.intent_url || 
                  vyaparData?.data?.payment_url;

    // UPI String வந்தால் QR Server மூலம் இமேஜாக மாற்றுதல்
    if (qrImage && !qrImage.startsWith("http") && !qrImage.startsWith("data:image")) {
      qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrImage)}`;
    }

    const finalOrderId = vyaparData?.data?.order_id || clientTxnId;

    if (qrImage) {
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
          error: "No QR returned from Vyapar Gateway",
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