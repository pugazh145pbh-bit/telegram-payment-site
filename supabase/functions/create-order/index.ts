import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MERCHANT_UPI = "paytmqr281005050101v4jfqfl7j94m@paytm";
const MERCHANT_NAME = "Indhuja Online";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Status Check Route (Frontend Polling மூலமாக டேட்டாபேஸைச் சரிபார்க்க)
    if (reqBody.action === "check_status" && (reqBody.order_id || reqBody.client_txn_id)) {
      const searchId = reqBody.order_id || reqBody.client_txn_id;

      const { data, error } = await supabase
        .from("orders")
        .select("status, telegram_link")
        .eq("order_id", searchId)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: true, status: "pending", invite_link: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isSuccess = data.status === "paid" || data.status === "success";

      return new Response(
        JSON.stringify({
          success: true,
          status: isSuccess ? "success" : "pending",
          invite_link: isSuccess ? data.telegram_link : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create Order Route (ஆர்டரை டேட்டாபேஸில் பதிவு செய்து NPCI QR உருவாக்குதல்)
    const numAmount = parseFloat(reqBody.amount || "1.00");
    const clientTxnId =
      reqBody.clientTxnId || `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Supabase டேட்டாபேஸில் pending ஆர்டராகச் சேமித்தல்
    const { error: insertError } = await supabase.from("orders").insert([
      {
        order_id: clientTxnId,
        amount: numAmount,
        status: "pending",
      },
    ]);

    if (insertError) {
      console.error("Database Insert Error:", insertError);
      throw new Error("Failed to insert pending order into Supabase");
    }

    // NPCI அங்கீகரிக்கப்பட்ட UPI QR String
    const standardUpiString = `upi://pay?pa=${MERCHANT_UPI}&pn=${encodeURIComponent(
      MERCHANT_NAME
    )}&am=${numAmount.toFixed(2)}&cu=INR&tr=${clientTxnId}&tn=${encodeURIComponent(
      "VIP Group Access"
    )}`;

    const standardQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(
      standardUpiString
    )}`;

    return new Response(
      JSON.stringify({
        success: true,
        orderId: clientTxnId,
        clientTxnId: clientTxnId,
        qrCode: standardQrCode,
        upiString: standardUpiString,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Create Order Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});