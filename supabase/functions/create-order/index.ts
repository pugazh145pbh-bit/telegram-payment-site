import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS Headers - Frontend எந்த தடையுமின்றி API-ஐ அழைக்க இது அவசியம்
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS Preflight Request கையாளுதல்
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

    // சுபாபேஸ் (Supabase) பாதுகாப்பான இணைப்பு அமைத்தல்
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ==========================================
    // 1. STATUS CHECK API (Frontend Polling-க்கு)
    // ==========================================
    if (reqBody.action === "check_status" && (reqBody.order_id || reqBody.client_txn_id)) {
      const searchId = reqBody.order_id || reqBody.client_txn_id;

      const { data, error } = await supabase
        .from('orders')
        .select('status, telegram_link')
        .eq('order_id', searchId)
        .single();

      // ஆர்டர் கிடைக்கவில்லை என்றாலோ, எரர் வந்தாலோ 'pending' என அனுப்புவோம்
      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, status: "pending" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // பேமெண்ட் வெற்றி பெற்று 'paid' என மாறியிருந்தால் லிங்க்கை அனுப்புவோம்
      return new Response(
        JSON.stringify({
          success: true,
          status: data.status,
          invite_link: data.telegram_link
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // 2. CREATE ORDER API (புதிய QR Code உருவாக்க)
    // ==========================================
    
    // Frontend அனுப்பும் TXN ID-ஐப் பெறுதல் அல்லது புதிதாக உருவாக்குதல்
    const clientTxnId = reqBody.clientTxnId || `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const numAmount = parseFloat(reqBody.amount || "199");

    // டேட்டாபேஸில் புதிய ஆர்டரைச் 'pending' எனச் சேமித்தல்
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
      console.error("Database Insert Error:", insertError);
      throw new Error("Failed to save order to database");
    }

    // நேரடியான UPI லிங்க் உருவாக்குதல் (Third-party Gateway தேவையில்லை)
    const upiId = "paytmqr281005050101v4jfqfl7j94m@paytm"; 
    const upiString = `upi://pay?pa=${upiId}&pn=IndhujaOnline&am=${numAmount}&cu=INR&tr=${clientTxnId}&tn=VIP%20Access`;
    
    // QR Code Image URL (Google API or QRServer)
    const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=${encodeURIComponent(upiString)}`;

    // Frontend-க்கு வெற்றியான தகவலை (QR Code & UPI String) அனுப்புதல்
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
    console.error("Create Order Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});