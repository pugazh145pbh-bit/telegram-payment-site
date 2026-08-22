import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Base64URL-ஐ வழக்கமான உரையாக (Decoded String) மாற்றும் Helper
function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return atob(base64);
}

// Gmail Payload-லிருந்து Email Body-ஐ முழுமையாகப் பிரித்தெடுக்கும் Helper
function extractEmailBody(payload: any): string {
  let body = "";
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body += decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data && !body) {
        body += decodeBase64Url(part.body.data);
      } else if (part.parts) {
        body += extractEmailBody(part);
      }
    }
  } else if (payload.body?.data) {
    body = decodeBase64Url(payload.body.data);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawText = await req.text();
    let bodyObj: any = {};
    try {
      bodyObj = JSON.parse(rawText);
    } catch {
      return new Response("Invalid JSON payload", { status: 400 });
    }

    console.log("Pub/Sub Notification Received:", JSON.stringify(bodyObj));

    // 1. Google OAuth மூலம் Access Token பெறுதல்
    const clientId = Deno.env.get("GMAIL_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET") ?? "";
    const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN") ?? "";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Failed to generate Access Token:", tokenData);
      throw new Error("Failed to authenticate with Google");
    }

    const accessToken = tokenData.access_token;

    // 2. Gmail paytm-alerts லேபிளிலிருந்து சமீபத்திய மெசேஜ் ஐடியைப் பெறுதல்
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:paytm-alerts&maxResults=1",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      console.log("No messages found in paytm-alerts label");
      return new Response(JSON.stringify({ status: "no_messages_found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messageId = listData.messages[0].id;

    // 3. அந்த மெசேஜின் முழு விவரங்களைப் பெறுதல்
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const msgData = await msgRes.json();
    const emailBody = extractEmailBody(msgData.payload);

    // 4. மெயில் உள்ளடக்கத்திலிருந்து Order ID அல்லது ClientTxnId-ஐத் தேடுதல்
    const txnMatch =
      emailBody.match(/ORD_\d+_\d+/i) ||
      emailBody.match(/TXN[a-zA-Z0-9_-]+/i) ||
      emailBody.match(/Order ID:?\s*([a-zA-Z0-9_-]+)/i);

    const orderId = txnMatch ? (txnMatch[1] || txnMatch[0]).trim() : null;

    console.log("Extracted Order ID from Email:", orderId);

    if (!orderId) {
      console.log("Could not find matching Order ID in email");
      return new Response(JSON.stringify({ status: "no_order_id_matched" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Telegram இன்வைட் லிங்க் உருவாக்குதல்
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHANNEL_ID");
    let inviteLink = "https://t.me/+qPXnMnSRlJNiZWI1";

    if (botToken && chatId) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              member_limit: 1,
              expire_date: Math.floor(Date.now() / 1000) + 86400,
            }),
          }
        );
        const tgData = await tgRes.json();
        if (tgData.result?.invite_link) {
          inviteLink = tgData.result.invite_link;
        }
      } catch (err) {
        console.error("Telegram API Error:", err);
      }
    }

    // 6. Supabase Database-ல் 'paid' என மாற்றுதல்
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase
      .from("orders")
      .update({
        status: "paid",
        telegram_link: inviteLink,
      })
      .eq("order_id", orderId);

    if (dbError) {
      console.error("Database Update Error:", dbError);
      throw dbError;
    }

    console.log(`Order ${orderId} marked as PAID with link ${inviteLink}`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        status: "paid",
        telegram_link: inviteLink,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Webhook Processing Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});