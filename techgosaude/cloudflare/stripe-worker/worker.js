export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }
    if (request.method === "POST" && url.pathname === "/create-checkout") {
      return withCors(request, env, handleCreateCheckout(request, env));
    }
    if (request.method === "POST" && url.pathname === "/stripe-webhook") {
      return withCors(request, env, handleWebhook(request, env));
    }
    return withCors(request, env, new Response("Not found", { status: 404 }));
  }
};

function getAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = [
    env.WEB_ORIGIN,
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://mlima3022.github.io"
  ].filter(Boolean);
  if (allowed.includes(origin)) return origin;
  return allowed[0] || "*";
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400"
  };
}

function handleOptions(request, env) {
  const origin = getAllowedOrigin(request, env);
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function withCors(request, env, responsePromise) {
  return Promise.resolve(responsePromise).then((response) => {
    const origin = getAllowedOrigin(request, env);
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, { status: response.status, headers });
  });
}

async function handleCreateCheckout(request, env) {
  try {
    const auth = request.headers.get("Authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const body = await request.json();
    const priceId = body.priceId || env.STRIPE_PRICE_ID;
    const successUrl = body.successUrl || env.STRIPE_SUCCESS_URL;
    const cancelUrl = body.cancelUrl || env.STRIPE_CANCEL_URL;
    if (!priceId || !successUrl || !cancelUrl) {
      return json({ error: "Missing checkout config" }, 400);
    }

    // Validate Supabase user
    const supabaseResp = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: env.SUPABASE_ANON_KEY,
      }
    });
    if (!supabaseResp.ok) {
      return json({ error: "Invalid user" }, 401);
    }
    const user = await supabaseResp.json();

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("client_reference_id", user.id);
    if (user.email) params.set("customer_email", user.email);
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("metadata[user_id]", user.id);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!stripeRes.ok) {
      const text = await stripeRes.text();
      console.log("Stripe error", text);
      return json({ error: "Stripe error" }, 500);
    }

    const session = await stripeRes.json();
    return json({ url: session.url });
  } catch (err) {
    console.log(err);
    return json({ error: "Checkout error" }, 500);
  }
}

async function handleWebhook(request, env) {
  const signature = request.headers.get("stripe-signature") || "";
  const payload = await request.text();

  const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response("Webhook signature error", { status: 400 });
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = (session.metadata && session.metadata.user_id) || session.client_reference_id;
    if (userId) {
      await updateProfilePlan(env, userId, {
        plan: "pro",
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    await updateProfilePlanByCustomer(env, customerId, { plan: "free" });
  }

  return new Response("ok", { status: 200 });
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",");
  const timestampPart = parts.find(p => p.startsWith("t="));
  const signaturePart = parts.find(p => p.startsWith("v1="));
  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.split("=")[1];
  const signature = signaturePart.split("=")[1];
  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function updateProfilePlan(env, userId, data) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      ...data,
      updated_at: new Date().toISOString()
    })
  });
  if (!resp.ok) {
    console.log("Supabase update failed", await resp.text());
  }
}

async function updateProfilePlanByCustomer(env, customerId, data) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?stripe_customer_id=eq.${customerId}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      ...data,
      updated_at: new Date().toISOString()
    })
  });
  if (!resp.ok) {
    console.log("Supabase update failed", await resp.text());
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
