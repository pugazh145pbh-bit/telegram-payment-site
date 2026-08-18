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
        JSON.stringify({ success: false, error: "VYAPAR_API_KEY missing in Secrets" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Status Check
    if (reqBody.action === "check_status" && (reqBody.order_id || reqBody.client_txn_id)) {
      const statusRes = await fetch("https://vyapargateway.com/api/v1/check_order_status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({
          key: apiKey,
          order_id: reqBody.order_id,
          client_txn_id: reqBody.client_txn_id
        })
      });

      const statusData = await statusRes.json();
      return new Response(
        JSON.stringify({
          success: true,
          status: statusData?.data?.status || "pending",
          data: statusData?.data
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const numAmount = parseFloat(reqBody.amount || "199");
    const clientTxnId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payload = {
      key: apiKey,
      client_txn_id: clientTxnId,
      amount: numAmount,
      p_info: "Telegram VIP Access",
      customer_name: "Member",
      customer_email: "support@telegram.com",
      customer_mobile: "9876543210",
      callback_url: "https://wzqbscqagrilewsvjlhq.supabase.co/functions/v1/webhook",
      redirect_url: "https://t.me",
      udf1: "vip_access"
    };

    const vyaparRes = await fetch("https://vyapargateway.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const vyaparData = await vyaparRes.json();
    console.log("Vyapar Response Data:", JSON.stringify(vyaparData));

    if (vyaparData?.status === true && vyaparData?.data) {
      // Base64 QR அல்லது நேரடி Standard UPI QR Server
      let finalQr = vyaparData.data.qr_code;
      if (!finalQr && vyaparData.data.upi_string) {
        finalQr = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(vyaparData.data.upi_string)}`;
      }

      return new Response(
        JSON.stringify({
          success: true,
          orderId: vyaparData.data.order_id,
          clientTxnId: clientTxnId,
          qrCode: finalQr,
          upiString: vyaparData.data.upi_string,
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