// Stripe Checkout integration for Foxy Adventure
// Plan A: RM365/year (Game subscription only)
// Plan B: RM730 (Game sub RM365/yr + Toy RM365 one-time — customer pays full price)
import { Hono } from "npm:hono";
import Stripe from "npm:stripe@14";
import { supabaseAdmin } from "./auth.tsx";

const STRIPE_PRICE_GAME = "price_1T2LBRPS5VWYunAIqCjxVFJM"; // Recurring RM365/year (LIVE)
const STRIPE_PRICE_TOY = "price_1T2LFhPS5VWYunAIX6wvmkuJ";  // One-time RM365 (LIVE)

// KG Pro plan — RM1,850/year recurring (LIVE)
const STRIPE_PRODUCT_KG_PRO = "prod_U0NPP3BMg0jvmw";
const STRIPE_PRICE_KG_PRO = "price_1T2MeHPS5VWYunAI4508KD71"; // Recurring RM1,850/year (LIVE)

const PRODUCTION_ORIGIN = "https://projectlumi.org";

function getStripe() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2024-04-10" });
}

// ── PG helpers ──
async function getParent(parentId: string) {
  const { data } = await supabaseAdmin.from('parents').select('*').eq('id', parentId).limit(1).single();
  return data;
}

async function updateParent(parentId: string, updates: Record<string, any>) {
  updates.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from('parents').update(updates).eq('id', parentId);
  if (error) console.error(`[STRIPE] updateParent ${parentId} error:`, error.message);
}

async function getSchoolById(schoolId: string) {
  const { data } = await supabaseAdmin.from('school_accounts').select('*').eq('id', schoolId).limit(1).single();
  return data;
}

async function updateSchool(schoolId: string, updates: Record<string, any>) {
  updates.updated_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from('school_accounts').update(updates).eq('id', schoolId);
  if (error) console.error(`[STRIPE] updateSchool ${schoolId} error:`, error.message);
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

    // ── Double-charge prevention: check if parent already has an active subscription ──
    const parentData = await getParent(parentId);
    if (parentData?.subscription_status === "active" && parentData?.premium_source !== "fmcg_trial") {
      console.log(`[STRIPE] Blocked checkout: parent ${parentId} already has active subscription (plan ${parentData.subscription_plan})`);
      return c.json({
        error: "You already have an active subscription. Use 'Manage Subscription' to make changes.",
        alreadySubscribed: true,
      }, 409);
    }

    const stripe = getStripe();

    // ── Stripe customer reuse: use existing customer ID if available ──
    let stripeCustomerId = parentData?.stripe_customer_id || null;

    // Verify the customer still exists in Stripe
    if (stripeCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(stripeCustomerId);
        if ((existing as any).deleted) {
          console.log(`[STRIPE] Customer ${stripeCustomerId} was deleted, creating new`);
          stripeCustomerId = null;
        }
      } catch {
        console.log(`[STRIPE] Customer ${stripeCustomerId} not found, creating new`);
        stripeCustomerId = null;
      }
    }

    // Create a new Stripe customer if we don't have one
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { parent_id: parentId },
      });
      stripeCustomerId = customer.id;
      // Persist for reuse
      if (parentData) {
        await updateParent(parentId, { stripe_customer_id: stripeCustomerId });
      }
      console.log(`[STRIPE] Created new customer ${stripeCustomerId} for parent ${parentId}`);
    }

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
      const { data: referrer } = await supabaseAdmin.from('parents').select('id').eq('referral_code', referralCode).limit(1).single();
      if (referrer) {
        // Check parent's accumulated credits
        const pd = await getParent(parentId);
        referralCredit = pd?.referral_credits || 0;
        console.log(`[STRIPE] Referral code ${referralCode} valid. Parent credits: RM${referralCredit}`);
      }
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: lineItems,
      billing_address_collection: "required",
      success_url: successUrl || `${PRODUCTION_ORIGIN}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${PRODUCTION_ORIGIN}?checkout=cancelled`,
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
    // Customer pays full RM730 (RM365 game + RM365 toy)
    if (plan === "B") {
      sessionParams.shipping_address_collection = {
        allowed_countries: ["MY", "SG"],
      };
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

// ── Foxy Toy standalone one-time purchase (Plan A users upgrading to get the toy) ──
stripeRoutes.post("/checkout-toy", async (c) => {
  try {
    const body = await c.req.json();
    const { parentId, email, successUrl, cancelUrl } = body;

    if (!parentId || !email) {
      return c.json({ error: "Missing required fields: parentId, email" }, 400);
    }

    // Only allow Plan A users to buy standalone toy
    const parentData = await getParent(parentId);
    if (!parentData) {
      return c.json({ error: "Parent not found" }, 404);
    }

    // Check they already have a subscription (Plan A)
    if (parentData.subscription_status !== "active" || parentData.premium_source === "fmcg_trial") {
      return c.json({ error: "You need an active Plan A subscription to purchase the Foxy Toy separately." }, 403);
    }

    // Check if they already purchased the toy
    if (parentData.toy_purchased) {
      return c.json({ error: "You've already purchased the Foxy AI Toy!", alreadyPurchased: true }, 409);
    }

    const stripe = getStripe();

    // Reuse existing Stripe customer
    let stripeCustomerId = parentData.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { parent_id: parentId },
      });
      stripeCustomerId = customer.id;
      await updateParent(parentId, { stripe_customer_id: stripeCustomerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: stripeCustomerId,
      line_items: [{ price: STRIPE_PRICE_TOY, quantity: 1 }],
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["MY", "SG"],
      },
      success_url: successUrl || `${PRODUCTION_ORIGIN}/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${PRODUCTION_ORIGIN}/plan?checkout=cancelled`,
      metadata: {
        parent_id: parentId,
        plan: "toy_addon",
      },
    });

    console.log(`[STRIPE] Toy checkout session created: ${session.id} for parent ${parentId}`);

    return c.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("[STRIPE] Toy checkout error:", error);
    return c.json({ error: `Toy checkout failed: ${error.message}` }, 500);
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
      const parentData = await getParent(parentId);
      if (parentData) {
        if (plan === "toy_addon") {
          const toyUpdates: Record<string, any> = {
            toy_purchased: true,
            toy_purchased_at: new Date().toISOString(),
          };
          if (session.shipping_details) {
            toyUpdates.shipping_address = session.shipping_details;
          }
          await updateParent(parentId, toyUpdates);
          console.log(`[STRIPE] Parent ${parentId} purchased standalone Foxy Toy`);
        } else {
          const subUpdates: Record<string, any> = {
            subscription_plan: plan,
            subscription_status: "active",
            premium_source: "stripe",
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          };

          if (plan === "B" && session.shipping_details) {
            subUpdates.shipping_address = session.shipping_details;
            subUpdates.toy_purchased = true;
            subUpdates.toy_purchased_at = new Date().toISOString();
          }

          await updateParent(parentId, subUpdates);

          if (referralCode) {
            await processReferralReward(referralCode, parentId, plan);
          }

          console.log(`[STRIPE] Parent ${parentId} upgraded to Plan ${plan}`);
        }
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
    const parentData = await getParent(parentId);

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
    const { data: referrerRow } = await supabaseAdmin.from('parents').select('id').eq('referral_code', referralCode).limit(1).single();
    if (!referrerRow) return;
    const referrerParentId = referrerRow.id;

    const referrerData = await getParent(referrerParentId);
    if (!referrerData) return;

    // Credit 10% of plan value to referrer (1 level only, no MLM)
    const currentCredits = referrerData.referral_credits || 0;
    const REFERRAL_REWARD = plan === "B" ? 73.00 : 36.50;
    const newCredits = currentCredits + REFERRAL_REWARD;

    await updateParent(referrerParentId, {
      referral_credits: newCredits,
      referral_count: (referrerData.referral_count || 0) + 1,
    });

    // ── Bible v5: Diamond referral rewards ──
    const PAID_DIAMONDS = plan === "B" ? 5 : 3;
    const freeSignupDiamondsAlready = referrerData.extra?.[`_ref_free_diamond_${newPaidParentId}`] || 0;
    const diamondDelta = Math.max(0, PAID_DIAMONDS - freeSignupDiamondsAlready);

    if (diamondDelta > 0) {
      await grantDiamondInbox(referrerParentId, diamondDelta, `Referral reward: Plan ${plan} subscription`);
      console.log(`[REFERRAL] Granted ${diamondDelta}💎 to referrer ${referrerParentId} (plan=${plan}, freeAlready=${freeSignupDiamondsAlready})`);
    }

    // Credit RM10 to origin kindergarten (regardless of depth)
    const originTag = referrerData.origin_tag || null;
    if (originTag) {
      const kindergartenData = await getSchoolById(originTag);
      if (kindergartenData) {
        await updateSchool(originTag, {
          parent_earnings: (kindergartenData.parent_earnings || 0) + 10,
          paid_parent_count: (kindergartenData.paid_parent_count || 0) + 1,
        });
        console.log(`[REFERRAL] Credited RM10 to kindergarten ${originTag}`);
      }
    }

    // Record the referral transaction
    const txnId = crypto.randomUUID();
    await supabaseAdmin.from('referral_transactions').insert({
      id: txnId,
      referrer_id: referrerParentId,
      referred_id: newPaidParentId,
      referral_code: referralCode,
      reward_amount: REFERRAL_REWARD,
      diamond_reward: diamondDelta,
      origin_tag: originTag,
      kg_reward: originTag ? 10 : 0,
      plan: plan,
      type: "paid_subscription",
      created_at: new Date().toISOString(),
    });

    console.log(`[REFERRAL] Credited RM${REFERRAL_REWARD} + ${diamondDelta}💎 to parent ${referrerParentId} (total: RM${newCredits})`);
  } catch (error) {
    console.error("[REFERRAL] Processing error:", error);
  }
}

/**
 * Grant diamonds via inbox pattern — safe against race conditions with online users.
 * Inserts into diamond_inbox table which RealmContext consumes on init.
 * Bible v5: Diamonds are intentionally rare, only from referrals + milestones.
 */
async function grantDiamondInbox(userId: string, amount: number, reason: string) {
  const { error } = await supabaseAdmin.from('diamond_inbox').insert({
    user_id: userId,
    amount,
    reason,
    consumed: false,
    granted_at: new Date().toISOString(),
  });
  if (error) {
    console.error(`[DIAMOND-INBOX] Insert error for ${userId}:`, error.message);
  } else {
    console.log(`[DIAMOND-INBOX] Queued +${amount}💎 for ${userId}: ${reason}`);
  }
}

// Export for use in index.tsx (free signup diamond grant)
export { grantDiamondInbox };

// ===== WEBHOOK — Stripe signature-verified event handler =====
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

  // ── Idempotency: dedup by event ID ──
  const { data: existingEvent } = await supabaseAdmin.from('stripe_events').select('event_id').eq('event_id', event.id).limit(1).single();
  if (existingEvent) {
    console.log(`[STRIPE-WEBHOOK] Skipping duplicate event: ${event.id}`);
    return c.json({ received: true, duplicate: true });
  }
  await supabaseAdmin.from('stripe_events').insert({ event_id: event.id, event_type: event.type, processed_at: new Date().toISOString() });

  try {
    switch (event.type) {
      // ── checkout.session.completed ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const parentId = session.metadata?.parent_id;
        const plan = session.metadata?.plan;
        const referralCode = session.metadata?.referral_code;
        const schoolId = session.metadata?.school_id;

        // ── Parent Plan A/B checkout ──
        if (parentId) {
          const parentData = await getParent(parentId);
          if (parentData) {
            if (plan === "toy_addon") {
              const toyUpdates: Record<string, any> = {
                toy_purchased: true,
                toy_purchased_at: new Date().toISOString(),
              };
              if (session.shipping_details) {
                toyUpdates.shipping_address = session.shipping_details;
              }
              await updateParent(parentId, toyUpdates);
              console.log(`[STRIPE-WEBHOOK] checkout.session.completed — parent ${parentId} → Toy addon purchased`);
            } else {
              const subUpdates: Record<string, any> = {
                subscription_plan: plan,
                subscription_status: "active",
                premium_source: "stripe",
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
              };

              if (plan === "B" && session.shipping_details) {
                subUpdates.shipping_address = session.shipping_details;
                subUpdates.toy_purchased = true;
                subUpdates.toy_purchased_at = new Date().toISOString();
              }

              await updateParent(parentId, subUpdates);

              if (referralCode) {
                await processReferralReward(referralCode, parentId, plan);
              }

              console.log(`[STRIPE-WEBHOOK] checkout.session.completed — parent ${parentId} → Plan ${plan}`);
            }
          } else {
            console.warn(`[STRIPE-WEBHOOK] Parent PG record not found for ${parentId}`);
          }
        }

        // ── KG Pro checkout ──
        if (schoolId) {
          const schoolData = await getSchoolById(schoolId);
          if (schoolData) {
            await updateSchool(schoolId, {
              subscription_tier: "pro",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            });
            console.log(`[STRIPE-WEBHOOK] checkout.session.completed — school ${schoolId} → Pro`);
          }
        }
        break;
      }

      // ── customer.subscription.updated ──
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const parentId = subscription.metadata?.parent_id;
        const newStatus = subscription.status;

        if (parentId) {
          const parentData = await getParent(parentId);
          if (parentData) {
            const mappedStatus =
              newStatus === "active" ? "active" :
              newStatus === "past_due" ? "past_due" :
              newStatus === "canceled" ? "cancelled" :
              newStatus === "unpaid" ? "unpaid" :
              newStatus;

            await updateParent(parentId, { subscription_status: mappedStatus });
            console.log(`[STRIPE-WEBHOOK] subscription.updated — parent ${parentId} status → ${mappedStatus}`);
          }
        }

        const schoolId = subscription.metadata?.school_id;
        if (schoolId) {
          const schoolData = await getSchoolById(schoolId);
          if (schoolData) {
            const tier = newStatus === "active" ? "pro" : "trial";
            await updateSchool(schoolId, { subscription_tier: tier });
            console.log(`[STRIPE-WEBHOOK] subscription.updated — school ${schoolId} tier → ${tier}`);
          }
        }
        break;
      }

      // ── customer.subscription.deleted ──
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const parentId = subscription.metadata?.parent_id;

        if (parentId) {
          const parentData = await getParent(parentId);
          if (parentData) {
            const hasFmcgPremium = parentData.premium_expires_at
              && new Date(parentData.premium_expires_at).getTime() > Date.now();

            const delUpdates: Record<string, any> = {
              subscription_status: hasFmcgPremium ? "active" : "cancelled",
              subscription_plan: hasFmcgPremium ? "fmcg_trial" : "free",
              premium_source: hasFmcgPremium ? "fmcg_trial" : null,
              stripe_subscription_id: null,
            };

            await updateParent(parentId, delUpdates);
            console.log(`[STRIPE-WEBHOOK] subscription.deleted — parent ${parentId} → ${hasFmcgPremium ? 'fmcg_trial (FMCG days still active)' : 'free'}`);
          }
        }

        const schoolId = subscription.metadata?.school_id;
        if (schoolId) {
          const schoolData = await getSchoolById(schoolId);
          if (schoolData) {
            await updateSchool(schoolId, { subscription_tier: "trial" });
            console.log(`[STRIPE-WEBHOOK] subscription.deleted — school ${schoolId} reverted to trial`);
          }
        }
        break;
      }

      // ── invoice.payment_failed ──
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const stripe = getStripe();
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const parentId = sub.metadata?.parent_id;
            if (parentId) {
              const parentData = await getParent(parentId);
              if (parentData) {
                await updateParent(parentId, { subscription_status: "past_due" });
                console.log(`[STRIPE-WEBHOOK] invoice.payment_failed — parent ${parentId} → past_due`);
              }
            }
            const schoolId = sub.metadata?.school_id;
            if (schoolId) {
              const schoolData = await getSchoolById(schoolId);
              if (schoolData) {
                await updateSchool(schoolId, { subscription_tier: "past_due" });
                console.log(`[STRIPE-WEBHOOK] invoice.payment_failed — school ${schoolId} → past_due`);
              }
            }
          } catch (subErr) {
            console.error(`[STRIPE-WEBHOOK] Failed to retrieve subscription ${subscriptionId}:`, subErr);
          }
        }
        break;
      }

      // ── invoice.payment_succeeded ──
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (subscriptionId && invoice.billing_reason === "subscription_cycle") {
          const stripe = getStripe();
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const parentId = sub.metadata?.parent_id;
            if (parentId) {
              const parentData = await getParent(parentId);
              if (parentData && parentData.subscription_status !== "active") {
                await updateParent(parentId, {
                  subscription_status: "active",
                  premium_source: "stripe",
                });
                console.log(`[STRIPE-WEBHOOK] invoice.payment_succeeded — parent ${parentId} recovered to active`);
              }
            }
          } catch (subErr) {
            console.error(`[STRIPE-WEBHOOK] Failed to retrieve subscription ${subscriptionId} on payment_succeeded:`, subErr);
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
    return c.json({ received: true, error: error.message });
  }
});

// ===== CUSTOMER PORTAL — Manage subscription, payment method, invoices =====
stripeRoutes.post("/portal", async (c) => {
  try {
    const body = await c.req.json();
    const { parentId, schoolId, returnUrl } = body;

    if (!parentId && !schoolId) {
      return c.json({ error: "Missing parentId or schoolId" }, 400);
    }

    let stripeCustomerId: string | null = null;

    if (parentId) {
      const parentData = await getParent(parentId);
      if (!parentData) return c.json({ error: "Parent not found" }, 404);
      stripeCustomerId = parentData.stripe_customer_id;
    } else if (schoolId) {
      const schoolData = await getSchoolById(schoolId);
      if (!schoolData) return c.json({ error: "School not found" }, 404);
      stripeCustomerId = schoolData.stripe_customer_id;
    }

    if (!stripeCustomerId) {
      return c.json({ error: "No Stripe customer ID found. Please subscribe first." }, 400);
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl || `${PRODUCTION_ORIGIN}/plan`,
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
stripeRoutes.post("/kg-checkout", async (c) => {
  try {
    const body = await c.req.json();
    const { schoolId, email, successUrl, cancelUrl } = body;

    if (!schoolId || !email) {
      return c.json({ error: "Missing required fields: schoolId, email" }, 400);
    }

    const schoolData = await getSchoolById(schoolId);
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
      success_url: successUrl || `${PRODUCTION_ORIGIN}/kg?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${PRODUCTION_ORIGIN}/kg?checkout=cancelled`,
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
        const billing = s.customer_details?.address || null;
        const billingAddr = billing
          ? [billing.line1, billing.line2, billing.city, billing.state, billing.postal_code, billing.country]
              .filter(Boolean)
              .join(", ")
          : null;

        const shipping = s.shipping_details?.address || null;
        const shippingAddr = shipping
          ? [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.postal_code, shipping.country]
              .filter(Boolean)
              .join(", ")
          : null;

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
