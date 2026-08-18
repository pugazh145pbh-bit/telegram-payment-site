import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS Headers (வெப்சைட்டில் இருந்து எரர் வராமல் தடுக்க இது மிக முக்கியம்)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Preflight CORS கோரிக்கையைக் கையாளுதல்
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const { amount } = await req.json()
    const orderAmount = Number(amount) || 199; // தொகையை இங்கே மாற்றிக்கொள்ளலாம்

    const userNumericId = Date.now().toString().slice(-6) + Math.floor(1000 + Math.random() * 9000);
    const clientTxnId = "TXN_" + userNumericId;

    // Vyapar API-க்கு கோரிக்கை அனுப்புதல்
    const vyaparResponse = await fetch("https://vyapargateway.com/api/v1/create_order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        key: Deno.env.get("VYAPAR_API_KEY"),
        amount: orderAmount,
        client_txn_id: clientTxnId,
        p_info: "Private Telegram Access",
      })
    });

    const data = await vyaparResponse.json();

    if (!data.status || !data.data) {
      console.error("Vyapar Error:", data);
      return new Response(
        JSON.stringify({ error: data.msg || "Gateway rejected request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const finalOrderId = data.data.order_id;
    const qrCodeImage = data.data.qr_code;

    // சுபாபேஸ் டேட்டாபேஸில் சேமிக்க
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("orders").upsert([
      {
        order_id: finalOrderId,
        amount: orderAmount,
        status: "pending"
      }
    ]);

    // வெற்றிகரமான பதிலை வெப்சைட்டிற்கு அனுப்புதல்
    return new Response(
      JSON.stringify({
        success: true,
        orderId: finalOrderId,
        numericTxnId: userNumericId,
        amount: orderAmount,
        qrImage: qrCodeImage
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Server Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})