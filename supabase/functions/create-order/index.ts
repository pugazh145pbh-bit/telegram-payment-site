import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS கையாளுதல்
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

    // சுபாபேஸ் இணைப்பு அமைத்தல்
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- 1. STATUS CHECK API (Frontend Polling-க்கு) ---
    if (reqBody.action === "check_status" && (reqBody.order_id || reqBody.client_txn_id)) {
      const searchId = reqBody.order_id || reqBody.client_txn_id;

      const { data, error } = await supabase
        .from('orders')
        .select('status, telegram_link')
        .eq('order_id', searchId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, status: "pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: data.status,
          invite_link: data.telegram_link
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- 2. CREATE ORDER API (புதிய QR Code உருவாக்க) ---
    // Frontend அனுப்பும் TXN ID-ஐப் பெறுதல்
    const clientTxnId = reqBody.clientTxnId || `TXN_${Date.now()}`;
    const numAmount = parseFloat(reqBody.amount || "199");

    // டேட்டாபேஸில் புதிய ஆர்டரைச் சேமித்தல் (முக்கியமான படி)
    const { error: insertError } = await supabase
      .from('orders')
      .insert([
        {
          order_id: clientTxnId,
          amount: numAmount,
          status: 'pending'
        }
      ]);

    if (insertError) {
      throw new Error("Failed to save order to database");
    }

    // நேரடியான UPI லிங்க் உருவாக்குதல் (Vyapar தேவையில்லை)
    // குறிப்பு: உங்கள் HTML-ல் உள்ள அதே Paytm UPI ID இங்கே கொடுக்கப்பட்டுள்ளது
    const upiId = "paytmqr281005050101v4jfqfl7j94m@paytm"; 
    const upiString = `upi://pay?pa=${upiId}&pn=IndhujaOnline&am=${numAmount}&cu=INR&tr=${clientTxnId}&tn=VIP%20Access`;
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(upiString)}`;

    // Frontend-க்கு வெற்றியான தகவலை அனுப்புதல்
    return new Response(
      JSON.stringify({
        success: true,
        orderId: clientTxnId,
        clientTxnId: clientTxnId,
        qrCode: qrCode,
        upiString: upiString
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});