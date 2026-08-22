import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. Gmail-லிருந்து புதிய Access Token பெறும் செயல்பாடு
async function getAccessToken() {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

// 2. உண்மையான மெயிலைப் படிக்கும் செயல்பாடு
async function getLatestEmail(accessToken) {
  // 'paytm-alerts' லேபிளில் உள்ள படிக்காத (unread) மெயிலை மட்டும் எடுக்கிறோம்
  const searchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread label:paytm-alerts&maxResults=1', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchData = await searchRes.json();

  if (!searchData.messages || searchData.messages.length === 0) return null;

  const messageId = searchData.messages[0].id;
  const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const msgData = await msgRes.json();

  let emailBody = "";
  if (msgData.payload.parts) {
    const part = msgData.payload.parts.find(p => p.mimeType === 'text/plain');
    if (part && part.body.data) {
      emailBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  } else if (msgData.payload.body.data) {
    emailBody = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }

  // மெயிலைப் படித்ததாக (Read) மாற்றுகிறோம் (அடுத்த முறை மீண்டும் வராமல் இருக்க)
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
  });

  return emailBody;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const payloadObj = await req.json();
    const base64Data = payloadObj?.message?.data;
    if (!base64Data) return new Response('No data', { status: 200 });

    console.log("Pub/Sub Triggered! Fetching actual email...");

    // 3. Gmail API மூலம் மெயிலைப் படிக்கிறோம்
    const accessToken = await getAccessToken();
    const emailText = await getLatestEmail(accessToken);

    if (!emailText) {
      return new Response(JSON.stringify({ message: "No unread emails found" }), { status: 200 });
    }

    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. Gmail API-லிருந்து Access Token பெறும் செயல்பாடு
async function getAccessToken() {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID');
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

// 2. உண்மையான மெயிலின் உள்ளடக்கத்தைப் படிக்கும் செயல்பாடு
async function getLatestEmail(accessToken) {
  // 'Paytm Alerts' லேபிளில் உள்ள படிக்காத (unread) மெயிலை மட்டும் எடுக்கிறோம்
  const searchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread label:paytm-alerts&maxResults=1', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const searchData = await searchRes.json();

  if (!searchData.messages || searchData.messages.length === 0) return null;

  const messageId = searchData.messages[0].id;
  const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const msgData = await msgRes.json();

  let emailBody = "";
  if (msgData.payload.parts) {
    const part = msgData.payload.parts.find(p => p.mimeType === 'text/plain');
    if (part && part.body.data) {
      emailBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
  } else if (msgData.payload.body.data) {
    emailBody = atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }

  // மெயிலைப் படித்ததாக (Read) மாற்றுகிறோம் (அடுத்த முறை மீண்டும் வராமல் இருக்க)
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
  });

  return emailBody;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const payloadObj = await req.json();
    const base64Data = payloadObj?.message?.data;
    if (!base64Data) return new Response('No data found in request', { status: 200 });

    console.log("Pub/Sub Triggered! Fetching actual email from Gmail...");

    // 3. Gmail API மூலம் மெயிலைப் படிக்கிறோம்
    const accessToken = await getAccessToken();
    const emailText = await getLatestEmail(accessToken);

    if (!emailText) {
      console.log("No unread Paytm emails found.");
      return new Response(JSON.stringify({ message: "No unread emails found" }), { status: 200 });
    }

    console.log("Email content fetched successfully.");

    // 4. Future-Proof Parsing: Regex மற்றும் Fallback மூலம் தகவல்களை எடுத்தல்
    let amount = null;
    let orderId = null;

    // தொகையை எடுத்தல் (Amount)
    const amountMatch = emailText.match(/₹\s*([0-9,]+(\.[0-9]{1,2})?)/);
    if (amountMatch) {
      amount = parseFloat(amountMatch[1].replace(',', ''));
    } else {
      // Fallback: 'Rupee' என்ற வார்த்தையை வைத்துத் தேடுதல்
      const words = emailText.split(' ');
      const rupeeIndex = words.findIndex(w => w.toLowerCase() === 'rupee');
      if (rupeeIndex !== -1 && words[rupeeIndex - 1]) {
        const potentialAmount = parseFloat(words[rupeeIndex - 1]);
        if (!isNaN(potentialAmount)) amount = potentialAmount;
      }
    }

    // ஆர்டர் ஐடியை எடுத்தல் (Order ID)
    const orderIdMatch = emailText.match(/(?:Order ID|Transaction ID|Order No|TXN)[\s:]*([A-Za-z0-9_-]+)/i);
    if (orderIdMatch) {
      orderId = orderIdMatch[1];
    } else {
      // Fallback: 10-க்கும் மேற்பட்ட எண்கள்/எழுத்துக்கள் தொடர்ச்சியாக இருந்தால்
      const longNumberMatch = emailText.match(/[0-9A-Z]{10,}/);
      if (longNumberMatch) orderId = longNumberMatch[0];
    }

    if (orderId && amount) {
      console.log(`Extracted -> Order ID: ${orderId}, Amount: ₹${amount}`);

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseKey);

      // டேட்டாபேஸில் Order ID உள்ளதா மற்றும் Amount சரியாக உள்ளதா என சரிபார்க்கிறோம்
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("order_id", orderId)
        .single();

      if (orderData && Number(orderData.amount) === amount) {
          console.log("Validation Successful! Creating Telegram Link...");

          const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
          const chatId = Deno.env.get('TELEGRAM_CHANNEL_ID');

          const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createChatInviteLink`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, member_limit: 1, expire_date: Math.floor(Date.now() / 1000) + 3600 })
          });
          
          const tgData = await tgRes.json();
          const inviteLink = tgData.result ? tgData.result.invite_link : "";

          // டேட்டாபேஸை 'paid' என அப்டேட் செய்தல்
          await supabase
            .from("orders")
            .update({ status: "paid", telegram_link: inviteLink })
            .eq("order_id", orderId);
          
          console.log("Order updated to PAID.");
          return new Response(JSON.stringify({ success: true, message: "Payment processed successfully!" }), { status: 200 });
      } else {
          console.log("Validation Failed: Amount mismatch or Order not found in DB");
          return new Response(JSON.stringify({ message: "Validation Mismatch or Not Found" }), { status: 200 });
      }
    } else {
      console.log("Parsing Failed: Could not find Order ID or Amount in the email.");
      return new Response(JSON.stringify({ message: "Failed to extract required details" }), { status: 200 });
    }
  } catch (error) {
    console.error("Webhook Error:", error.message);
    // Error வந்தாலும் Google Pub/Sub-க்கு 200 OK அனுப்ப வேண்டும் (Retries-ஐ தவிர்க்க)
    return new Response(JSON.stringify({ error: error.message }), { status: 200 }); 
  }
});