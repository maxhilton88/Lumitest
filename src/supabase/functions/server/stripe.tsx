// Stripe Checkout integration for Foxy Adventure
// Plan A: RM365/year (Game subscription only)
// Plan B: RM365 promo (Game sub RM365/yr + Toy RM365 one-time, coupon zeros out the toy)
//         → Customer pays RM365 today, renews at RM365/yr (subscription only)
import { Hono } from "npm:hono";
import Stripe from "npm:stripe@14";
import * as kv from "./kv_store.tsx";

const STRIPE_PRICE_GAME = "price_1T2LBRPS5VWYunAIqCjxVFJM"; // Recurring RM365/year (LIVE)
const STRIPE_PRICE_TOY = "price_1T2LFhPS5VWYunAIX6wvmkuJ";  // One-time RM365 (LIVE)
const STRIPE_COUPON_INTRO = "Founder_discount"; // Founder discount — 100% off toy for first batch (LIVE)

// KG Pro plan — RM1,850/year recurring (LIVE)
const STRIPE_PRODUCT_KG_PRO = "prod_U0NPP3BMg0jvmw";
const STRIPE_PRICE_KG_PRO = "price_1T2MeHPS5VWYunAI4508KD71"; // Recurring RM1,850/year (LIVE)

function getStripe() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2024-04-10" });
}

const stripeRoutes = new Hono();

// Create Stripe Checkout Session
// Body: { plan: "A" | "B", parentId: string, email: string, referralCode?: string, successUrl: string, cancelUrl: string }
stripeRoutes.post("/checkout", async (c) => {
  try {
    const body = await c.req.json();
    const { plan, parentId, email, referralCode, successUrl, cancelUrl, shippingRequired } = body;

    if (!plan || !parentId || !email) {
      return c.json({ error: "Missing required fields: plan, parentId, email" }, 400);
    }

    if (!["A", "B"].includes(plan)) {
      return c.json({ error: "plan must be 'A' or 'B'" }, 400);
    }

    const stripe = getStripe();

    // Build line items based on plan
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (plan === "A") {
      // Plan A: Game subscription only
      lineItems.push({ price: STRIPE_PRICE_GAME, quantity: 1 });
    } else {
      // Plan B: Game subscription + Toy (one-time) in same basket
      lineItems.push({ price: STRIPE_PRICE_GAME, quantity: 1 });
      lineItems.push({ price: STRIPE_PRICE_TOY, quantity: 1 });
    }

    // Apply referral credit if available
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    let referralCredit = 0;

    if (referralCode) {
      const referrer = await kv.get(`referral_code:${referralCode}`);
      if (referrer) {
        // Check parent's accumulated credits
        const parentData = await kv.get(`parent:${parentId}`);
        referralCredit = parentData?.referral_credits || 0;
        console.log(`[STRIPE] Referral code ${referralCode} valid. Parent credits: RM${referralCredit}`);
      }
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer_email: email,
      line_items: lineItems,
      billing_address_collection: "required",
      success_url: successUrl || `${c.req.url.split("/make-server")[0]}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${c.req.url.split("/make-server")[0]}?checkout=cancelled`,
      metadata: {
        parent_id: parentId,
        plan: plan,
        referral_code: referralCode || "",
      },
      subscription_data: {
        metadata: {
          parent_id: parentId,
          plan: plan,
        },
      },
    };

    // Plan B needs shipping address for the Foxy AI Toy
    if (plan === "B") {
      sessionParams.shipping_address_collection = {
        allowed_countries: ["MY", "SG"],
      };
      // Auto-apply the Limited Intro Offer coupon — 100% off the toy
      // Note: `discounts` and `allow_promotion_codes` are mutually exclusive in Stripe Checkout
      sessionParams.discounts = [{ coupon: STRIPE_COUPON_INTRO }];
    }

    console.log(`[STRIPE] Creating checkout session: plan=${plan}, parent=${parentId}, email=${email}`);

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[STRIPE] Session created: ${session.id}, url=${session.url}`);

    return c.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("[STRIPE] Checkout error:", error);
    return c.json({ error: `Stripe checkout failed: ${error.message}` }, 500);
  }
});

// Verify checkout session (called after redirect back from Stripe)
stripeRoutes.get("/verify/:sessionId", async (c) => {
  try {
    const sessionId = c.req.param("sessionId");
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return c.json({ error: "Payment not completed", status: session.payment_status }, 400);
    }

    const parentId = session.metadata?.parent_id;
    const plan = session.metadata?.plan;
    const referralCode = session.metadata?.referral_code;

    if (parentId) {
      // Update parent subscription status
      const parentData = await kv.get(`parent:${parentId}`);
      if (parentData) {
        const updatedParent = {
          ...parentData,
          subscription_plan: plan,
          subscription_status: "active",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          subscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // If Plan B, store shipping address
        if (plan === "B" && session.shipping_details) {
          updatedParent.shipping_address = session.shipping_details;
        }

        await kv.set(`parent:${parentId}`, updatedParent);
        await kv.set(`parent_by_email:${parentData.email}`, updatedParent);

        // Process referral reward
        if (referralCode) {
          await processReferralReward(referralCode, parentId, plan);
        }

        console.log(`[STRIPE] Parent ${parentId} upgraded to Plan ${plan}`);
      }
    }

    return c.json({
      success: true,
      plan: plan,
      status: "active",
      customerEmail: session.customer_email,
    });
  } catch (error) {
    console.error("[STRIPE] Verify error:", error);
    return c.json({ error: `Verification failed: ${error.message}` }, 500);
  }
});

// Get subscription status for a parent
stripeRoutes.get("/status/:parentId", async (c) => {
  try {
    const parentId = c.req.param("parentId");
    const parentData = await kv.get(`parent:${parentId}`);

    if (!parentData) {
      return c.json({ error: "Parent not found" }, 404);
    }

    return c.json({
      success: true,
      subscription: {
        plan: parentData.subscription_plan || "free",
        status: parentData.subscription_status || "free",
        subscribedAt: parentData.subscribed_at || null,
      },
    });
  } catch (error) {
    console.error("[STRIPE] Status error:", error);
    return c.json({ error: `Status check failed: ${error.message}` }, 500);
  }
});

// Process referral reward when a referred parent pays
async function processReferralReward(referralCode: string, newPaidParentId: string, plan: string | undefined) {
  try {
    const referrerParentId = await kv.get(`referral_code:${referralCode}`);
    if (!referrerParentId) return;

    const referrerData = await kv.get(`parent:${referrerParentId}`);
    if (!referrerData) return;

    // Credit RM36.50 to referrer (1 level only)
    const currentCredits = referrerData.referral_credits || 0;
    const REFERRAL_REWARD = 36.50;
    const newCredits = currentCredits + REFERRAL_REWARD;

    const updatedReferrer = {
      ...referrerData,
      referral_credits: newCredits,
      referral_count: (referrerData.referral_count || 0) + 1,
      updated_at: new Date().toISOString(),
    };

    await kv.set(`parent:${referrerParentId}`, updatedReferrer);
    await kv.set(`parent_by_email:${referrerData.email}`, updatedReferrer);

    // Credit RM10 to origin kindergarten (regardless of depth)
    const originTag = referrerData.origin_tag || null;
    if (originTag) {
      const kindergartenData = await kv.get(`school_by_id:${originTag}`);
      if (kindergartenData) {
        const kgEarnings = kindergartenData.parent_earnings || 0;
        const kgPaidCount = kindergartenData.paid_parent_count || 0;
        await kv.set(`school_by_id:${originTag}`, {
          ...kindergartenData,
          parent_earnings: kgEarnings + 10,
          paid_parent_count: kgPaidCount + 1,
          updated_at: new Date().toISOString(),
        });
        console.log(`[REFERRAL] Credited RM10 to kindergarten ${originTag}`);
      }
    }

    // Record the referral transaction
    const txnId = crypto.randomUUID();
    await kv.set(`referral_txn:${txnId}`, {
      id: txnId,
      referrer_id: referrerParentId,
      referred_id: newPaidParentId,
      referral_code: referralCode,
      reward_amount: REFERRAL_REWARD,
      origin_tag: originTag,
      kg_reward: originTag ? 10 : 0,
      plan: plan,
      created_at: new Date().toISOString(),
    });

    console.log(`[REFERRAL] Credited RM${REFERRAL_REWARD} to parent ${referrerParentId} (total: RM${newCredits})`);
  } catch (error) {
    console.error("[REFERRAL] Processing error:", error);
  }
}

// ===== WEBHOOK — Stripe signature-verified event handler =====
// Endpoint: POST /make-server-221a61bc/stripe/webhook
// Events: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted, invoice.payment_failed
stripeRoutes.post("/webhook", async (c) => {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[STRIPE-WEBHOOK] STRIPE_WEBHOOK_SECRET not set");
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const sig = c.req.header("stripe-signature");
  if (!sig) {
    console.error("[STRIPE-WEBHOOK] Missing stripe-signature header");
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  let event: Stripe.Event;
  try {
    const rawBody = await c.req.text();
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error(`[STRIPE-WEBHOOK] Signature verification failed: ${err.message}`);
    return c.json({ error: `Webhook signature verification failed: ${err.message}` }, 400);
  }

  console.log(`[STRIPE-WEBHOOK] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      // ── checkout.session.completed ──
      // Fired when a customer completes Checkout. Mirrors /verify/:sessionId logic
      // but triggered automatically by Stripe (no frontend polling needed).
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const parentId = session.metadata?.parent_id;
        const plan = session.metadata?.plan;
        const referralCode = session.metadata?.referral_code;
        const schoolId = session.metadata?.school_id;

        // ── Parent Plan A/B checkout ──
        if (parentId) {
          const parentData = await kv.get(`parent:${parentId}`);
          if (parentData) {
            const updatedParent = {
              ...parentData,
              subscription_plan: plan,
              subscription_status: "active",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              subscribed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            if (plan === "B" && session.shipping_details) {
              updatedParent.shipping_address = session.shipping_details;
            }

            await kv.set(`parent:${parentId}`, updatedParent);
            if (parentData.email) {
              await kv.set(`parent_by_email:${parentData.email}`, updatedParent);
            }

            if (referralCode) {
              await processReferralReward(referralCode, parentId, plan);
            }

            console.log(`[STRIPE-WEBHOOK] checkout.session.completed — parent ${parentId} → Plan ${plan}`);
          } else {
            console.warn(`[STRIPE-WEBHOOK] Parent KV record not found for ${parentId}`);
          }
        }

        // ── KG Pro checkout ──
        if (schoolId) {
          const schoolData = await kv.get(`school_by_id:${schoolId}`);
          if (schoolData) {
            await kv.set(`school_by_id:${schoolId}`, {
              ...schoolData,
              subscription_tier: "pro",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              upgraded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            console.log(`[STRIPE-WEBHOOK] checkout.session.completed — school ${schoolId} → Pro`);
          }
        }
        break;
      }

      // ── customer.subscription.updated ──
      // Fired on renewal, plan change, trial end, payment method update, etc.
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const parentId = subscription.metadata?.parent_id;
        const newStatus = subscription.status; // active, past_due, unpaid, canceled, etc.

        if (parentId) {
          const parentData = await kv.get(`parent:${parentId}`);
          if (parentData) {
            const mappedStatus =
              newStatus === "active" ? "active" :
              newStatus === "past_due" ? "past_due" :
              newStatus === "canceled" ? "cancelled" :
              newStatus === "unpaid" ? "unpaid" :
              newStatus;

            await kv.set(`parent:${parentId}`, {
              ...parentData,
              subscription_status: mappedStatus,
              updated_at: new Date().toISOString(),
            });
            if (parentData.email) {
              await kv.set(`parent_by_email:${parentData.email}`, {
                ...parentData,
                subscription_status: mappedStatus,
                updated_at: new Date().toISOString(),
              });
            }
            console.log(`[STRIPE-WEBHOOK] subscription.updated — parent ${parentId} status → ${mappedStatus}`);
          }
        }

        // Also check if this is a KG subscription via metadata
        const schoolId = subscription.metadata?.school_id;
        if (schoolId) {
          const schoolData = await kv.get(`school_by_id:${schoolId}`);
          if (schoolData) {
            const tier = newStatus === "active" ? "pro" : "trial";
            await kv.set(`school_by_id:${schoolId}`, {
              ...schoolData,
              subscription_tier: tier,
              updated_at: new Date().toISOString(),
            });
            console.log(`[STRIPE-WEBHOOK] subscription.updated — school ${schoolId} tier → ${tier}`);
          }
        }
        break;
      }

      // ── customer.subscription.deleted ──
      // Fired when a subscription is fully cancelled (end of billing period).
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const parentId = subscription.metadata?.parent_id;

        if (parentId) {
          const parentData = await kv.get(`parent:${parentId}`);
          if (parentData) {
            await kv.set(`parent:${parentId}`, {
              ...parentData,
              subscription_status: "cancelled",
              subscription_plan: "free",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            if (parentData.email) {
              await kv.set(`parent_by_email:${parentData.email}`, {
                ...parentData,
                subscription_status: "cancelled",
                subscription_plan: "free",
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
            console.log(`[STRIPE-WEBHOOK] subscription.deleted — parent ${parentId} reverted to free`);
          }
        }

        const schoolId = subscription.metadata?.school_id;
        if (schoolId) {
          const schoolData = await kv.get(`school_by_id:${schoolId}`);
          if (schoolData) {
            await kv.set(`school_by_id:${schoolId}`, {
              ...schoolData,
              subscription_tier: "trial",
              updated_at: new Date().toISOString(),
            });
            console.log(`[STRIPE-WEBHOOK] subscription.deleted — school ${schoolId} reverted to trial`);
          }
        }
        break;
      }

      // ── invoice.payment_failed ──
      // Fired when a recurring payment attempt fails.
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        // Try to find the parent by subscription ID
        if (subscriptionId) {
          const stripe = getStripe();
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const parentId = sub.metadata?.parent_id;
            if (parentId) {
              const parentData = await kv.get(`parent:${parentId}`);
              if (parentData) {
                await kv.set(`parent:${parentId}`, {
                  ...parentData,
                  subscription_status: "past_due",
                  payment_failed_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });
                console.log(`[STRIPE-WEBHOOK] invoice.payment_failed — parent ${parentId} → past_due`);
              }
            }
            const schoolId = sub.metadata?.school_id;
            if (schoolId) {
              const schoolData = await kv.get(`school_by_id:${schoolId}`);
              if (schoolData) {
                await kv.set(`school_by_id:${schoolId}`, {
                  ...schoolData,
                  subscription_tier: "past_due",
                  updated_at: new Date().toISOString(),
                });
                console.log(`[STRIPE-WEBHOOK] invoice.payment_failed — school ${schoolId} → past_due`);
              }
            }
          } catch (subErr) {
            console.error(`[STRIPE-WEBHOOK] Failed to retrieve subscription ${subscriptionId}:`, subErr);
          }
        }
        break;
      }

      default:
        console.log(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Stripe expects 200 to acknowledge receipt
    return c.json({ received: true });
  } catch (error) {
    console.error(`[STRIPE-WEBHOOK] Event processing error for ${event.type}:`, error);
    // Still return 200 to avoid Stripe retries on processing errors (data is safe to retry)
    return c.json({ received: true, error: error.message });
  }
});

// ===== CUSTOMER PORTAL — Manage subscription, payment method, invoices =====
// Body: { parentId: string } (or { schoolId: string } for KG)
stripeRoutes.post("/portal", async (c) => {
  try {
    const body = await c.req.json();
    const { parentId, schoolId, returnUrl } = body;

    if (!parentId && !schoolId) {
      return c.json({ error: "Missing parentId or schoolId" }, 400);
    }

    let stripeCustomerId: string | null = null;

    if (parentId) {
      const parentData = await kv.get(`parent:${parentId}`);
      if (!parentData) return c.json({ error: "Parent not found" }, 404);
      stripeCustomerId = parentData.stripe_customer_id;
    } else if (schoolId) {
      const schoolData = await kv.get(`school_by_id:${schoolId}`);
      if (!schoolData) return c.json({ error: "School not found" }, 404);
      stripeCustomerId = schoolData.stripe_customer_id;
    }

    if (!stripeCustomerId) {
      return c.json({ error: "No Stripe customer ID found. Please subscribe first." }, 400);
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || `${c.req.url.split("/make-server")[0]}/plan`,
    });

    console.log(`[STRIPE-PORTAL] Created portal session for customer ${stripeCustomerId}`);

    return c.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error("[STRIPE-PORTAL] Error:", error);
    return c.json({ error: `Portal session failed: ${error.message}` }, 500);
  }
});

// ===== KG PRO CHECKOUT — Kindergarten Pro plan upgrade =====
// Single plan: RM1,850/year recurring, product: prod_TyIQKnxdmqeBRf
// Body: { schoolId: string, email: string, successUrl?, cancelUrl? }
stripeRoutes.post("/kg-checkout", async (c) => {
  try {
    const body = await c.req.json();
    const { schoolId, email, successUrl, cancelUrl } = body;

    if (!schoolId || !email) {
      return c.json({ error: "Missing required fields: schoolId, email" }, 400);
    }

    const schoolData = await kv.get(`school_by_id:${schoolId}`);
    if (!schoolData) {
      return c.json({ error: "School not found" }, 404);
    }

    const stripe = getStripe();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: STRIPE_PRICE_KG_PRO,
          quantity: 1,
        },
      ],
      billing_address_collection: "required",
      success_url: successUrl || `${c.req.url.split("/make-server")[0]}/kg?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${c.req.url.split("/make-server")[0]}/kg?checkout=cancelled`,
      metadata: {
        school_id: schoolId,
        plan: "kg_pro",
      },
      subscription_data: {
        metadata: {
          school_id: schoolId,
          plan: "kg_pro",
        },
      },
    };

    console.log(`[STRIPE-KG] Creating KG Pro checkout: school=${schoolId}, email=${email}, Price ID=${STRIPE_PRICE_KG_PRO}`);

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[STRIPE-KG] Session created: ${session.id}, url=${session.url}`);

    return c.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("[STRIPE-KG] Checkout error:", error);
    return c.json({ error: `KG checkout failed: ${error.message}` }, 500);
  }
});

// ===== ADMIN: LIST ALL ORDERS — fetches completed checkout sessions from Stripe =====
// GET /orders?limit=50&starting_after=cs_xxx
// Returns: { orders: [...], has_more: boolean, next_cursor: string | null }
stripeRoutes.get("/orders", async (c) => {
  try {
    const stripe = getStripe();
    const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
    const startingAfter = c.req.query("starting_after") || undefined;

    const params: Record<string, any> = {
      limit,
      expand: ["data.customer_details", "data.line_items"],
    };
    if (startingAfter) params.starting_after = startingAfter;

    console.log(`[STRIPE-ORDERS] Listing checkout sessions: limit=${limit}, starting_after=${startingAfter || 'none'}`);

    const sessions = await stripe.checkout.sessions.list(params);

    const orders = sessions.data
      .filter((s: any) => s.payment_status === "paid")
      .map((s: any) => {
        // Format billing address
        const billing = s.customer_details?.address || null;
        const billingAddr = billing
          ? [billing.line1, billing.line2, billing.city, billing.state, billing.postal_code, billing.country]
              .filter(Boolean)
              .join(", ")
          : null;

        // Format shipping address (Plan B orders)
        const shipping = s.shipping_details?.address || null;
        const shippingAddr = shipping
          ? [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.postal_code, shipping.country]
              .filter(Boolean)
              .join(", ")
          : null;

        // Extract line item names
        const items = (s.line_items?.data || []).map((li: any) => ({
          description: li.description || li.price?.product?.name || "—",
          amount: li.amount_total / 100,
          currency: li.currency?.toUpperCase() || "MYR",
          quantity: li.quantity || 1,
        }));

        return {
          id: s.id,
          email: s.customer_email || s.customer_details?.email || "—",
          name: s.customer_details?.name || "—",
          phone: s.customer_details?.phone || "—",
          plan: s.metadata?.plan || "—",
          parent_id: s.metadata?.parent_id || null,
          school_id: s.metadata?.school_id || null,
          amount_total: (s.amount_total || 0) / 100,
          currency: s.currency?.toUpperCase() || "MYR",
          payment_status: s.payment_status,
          billing_address: billingAddr,
          billing_raw: billing,
          shipping_name: s.shipping_details?.name || null,
          shipping_address: shippingAddr,
          shipping_raw: shipping,
          items,
          created_at: new Date(s.created * 1000).toISOString(),
        };
      });

    console.log(`[STRIPE-ORDERS] Returning ${orders.length} paid orders (has_more: ${sessions.has_more})`);

    return c.json({
      success: true,
      orders,
      has_more: sessions.has_more,
      next_cursor: sessions.has_more && sessions.data.length > 0
        ? sessions.data[sessions.data.length - 1].id
        : null,
    });
  } catch (error) {
    console.error("[STRIPE-ORDERS] Error:", error);
    return c.json({ error: `Failed to fetch orders: ${error.message}` }, 500);
  }
});

export { stripeRoutes };