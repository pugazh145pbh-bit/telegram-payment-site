import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const signature = req.headers.get('x-vyapargateway-signature');
    const timestamp = req.headers.get('x-vyapargateway-timestamp');
    const webhookSecret = Deno.env.get('VYAPAR_WEBHOOK_SECRET');

    // ஆவணத்தின்படி: raw body-ஐ அப்படியே பயன்படுத்திச் சரிபார்க்க வேண்டும்
    const rawBody = await req.text();

    if (signature && timestamp && webhookSecret) {
      const stringToSign = `${timestamp}.${rawBody}`;
      
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(stringToSign)
      );

      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (signature !== expectedSignature) {
        console.error("Invalid Webhook Signature!");
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
      }
    }

    const payloadObj = JSON.parse(rawBody);

    if (payloadObj.status === "success") {
      const orderId = payloadObj.order_id; 

      // Telegram இன்வைட் லிங்க் உருவாக்குதல்
      const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const chatId = Deno.env.get('TELEGRAM_CHANNEL_ID');

      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 3600 
          })
        }
      );
      
      const tgData = await tgRes.json();
      const inviteLink = tgData.result ? tgData.result.invite_link : "";

      // சுபாபேஸ் டேட்டாபேஸில் ஸ்டேட்டஸ் மற்றும் லிங்க்கை அப்டேட் செய்ய
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("orders")
        .update({ status: "paid", telegram_link: inviteLink })
        .eq("order_id", orderId);

      return new Response(
        JSON.stringify({ received: true, message: "Payment processed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ received: true, status: payloadObj.status }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
})