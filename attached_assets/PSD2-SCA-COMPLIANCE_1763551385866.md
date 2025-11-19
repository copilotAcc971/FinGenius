# PSD2 Strong Customer Authentication (SCA) Compliance

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Next Review Date:** 2026-11-05
**Regulation:** Payment Services Directive 2 (EU) 2015/2366

## Executive Summary

This document outlines our compliance with the Payment Services Directive 2 (PSD2), specifically focusing on Strong Customer Authentication (SCA) requirements. PSD2 applies to payment service providers operating in the European Economic Area (EEA) and requires strong authentication for electronic payments.

## 1. PSD2 Overview

### 1.1 Scope of PSD2

PSD2 applies to:
- ✓ Electronic payment transactions
- ✓ Access to payment account information
- ✓ Payment initiation services
- ✓ Operations within the EEA

### 1.2 Key Requirements

| Requirement | Description | Our Implementation |
|-------------|-------------|-------------------|
| Strong Customer Authentication | Two-factor authentication for payments | Stripe SCA-compliant flows |
| Dynamic Linking | Link authentication to transaction details | Implemented via Stripe |
| Exemptions Management | Apply exemptions when appropriate | Automated via Stripe |
| Secure Communication | Secure API communication | TLS 1.3, API authentication |
| Transaction Monitoring | Monitor for fraud | Real-time fraud detection |

### 1.3 Regulatory Timeline

| Date | Requirement | Status |
|------|-------------|--------|
| Jan 13, 2018 | PSD2 came into force | ✓ Compliant |
| Sep 14, 2019 | SCA mandatory (original deadline) | ✓ Compliant |
| Dec 31, 2020 | End of enforcement grace period | ✓ Compliant |
| Ongoing | Maintain compliance | ✓ Maintained |

## 2. Strong Customer Authentication (SCA)

### 2.1 Definition

**Strong Customer Authentication requires TWO of the following THREE elements:**

1. **Knowledge:** Something only the user knows
   - Password
   - PIN
   - Security question answer

2. **Possession:** Something only the user has
   - Mobile device
   - Hardware token
   - Smart card

3. **Inherence:** Something the user is
   - Fingerprint
   - Face recognition
   - Voice recognition

### 2.2 Our SCA Implementation

**For Payments:**

```javascript
// Example: Initiating payment with SCA via Stripe
const paymentIntent = await stripe.paymentIntents.create({
  amount: 1000,
  currency: 'eur',
  customer: 'cus_xxx',
  payment_method: 'pm_xxx',
  confirmation_method: 'automatic',
  confirm: true,

  // SCA handling
  setup_future_usage: 'off_session', // For recurring payments

  // Return URL for 3D Secure challenge
  return_url: 'https://app.company.com/payment/complete',

  // Metadata for transaction
  metadata: {
    order_id: 'order_123',
    description: 'Subscription payment'
  }
});

// If SCA required, Stripe handles the challenge
if (paymentIntent.status === 'requires_action') {
  // User will be redirected to 3D Secure challenge
  // Challenge typically includes:
  // - Knowledge: Password or PIN
  // - Possession: One-time code sent to mobile device

  const { error } = await stripe.confirmCardPayment(
    paymentIntent.client_secret
  );
}
```

**Authentication Factors Used:**

| Scenario | Factor 1 (Knowledge) | Factor 2 (Possession) |
|----------|---------------------|----------------------|
| Card payment | Card details (Knowledge) | 3DS OTP to phone (Possession) |
| Bank transfer | Bank password (Knowledge) | Bank app on phone (Possession) |
| Biometric payment | PIN (Knowledge) | Fingerprint (Inherence) |

### 2.3 SCA Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│          STRONG CUSTOMER AUTHENTICATION FLOW             │
└─────────────────────────────────────────────────────────┘

User initiates payment
        ↓
┌───────────────────┐
│ Payment Request   │
│ (with amount,     │
│  merchant details)│
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Check if SCA      │←─── Exemptions apply?
│ required          │     (see Section 3)
└────────┬──────────┘
         │
         ├─── No SCA needed → Process payment
         │
         ├─── SCA required
         │         ↓
         │   ┌───────────────────┐
         │   │ 3D Secure 2       │
         │   │ Challenge         │
         │   │                   │
         │   │ Factor 1: Card    │
         │   │ Factor 2: OTP     │
         │   └────────┬──────────┘
         │            │
         │            ▼
         │   ┌───────────────────┐
         │   │ User completes    │
         │   │ authentication    │
         │   └────────┬──────────┘
         │            │
         │            ├─── Success → Process payment
         │            │
         │            └─── Failure → Decline payment
         │
         ▼
┌───────────────────┐
│ Payment Complete  │
└───────────────────┘
```

### 2.4 3D Secure 2.0 (3DS2)

**What is 3DS2?**
- Enhanced version of 3D Secure
- Better user experience (fewer challenges)
- More data shared for risk assessment
- Mobile-optimized

**3DS2 Data Elements:**
Stripe automatically shares with issuer:
- Device information
- Billing/shipping address
- Previous transaction history
- Account age
- Behavioral analytics

**Issuer Decision:**
Based on risk analysis, issuer decides:
- **Frictionless:** No challenge needed (low risk)
- **Challenge:** User must authenticate (higher risk)
- **Decline:** Transaction refused

**Our Implementation:**
```javascript
// Stripe handles 3DS2 automatically
// We just handle the response

stripe.confirmCardPayment(clientSecret)
  .then(result => {
    if (result.error) {
      // Authentication failed
      handlePaymentError(result.error);
    } else if (result.paymentIntent.status === 'succeeded') {
      // Payment successful
      handlePaymentSuccess(result.paymentIntent);
    }
  });
```

## 3. SCA Exemptions

### 3.1 When SCA Can Be Waived

PSD2 allows exemptions in specific circumstances:

| Exemption | Criteria | Our Implementation |
|-----------|----------|-------------------|
| **Low-Value Transactions** | < €30 AND < 5 consecutive low-value OR < €100 cumulative since last SCA | Stripe applies automatically |
| **Trusted Beneficiaries** | User added merchant to trusted list | Supported via Stripe |
| **Transaction Risk Analysis (TRA)** | Low fraud rate AND low amount | Stripe applies based on risk |
| **Recurring Payments** | Fixed amount to same merchant | SCA on first payment only |
| **Corporate Payments** | Secure corporate payment process | Dedicated payment protocol |
| **Contactless Payments** | < €50 at physical terminal | Not applicable (online only) |

### 3.2 Low-Value Transaction Exemption

**Conditions:**
1. Transaction amount < €30
2. AND either:
   - Fewer than 5 consecutive low-value payments since last SCA, OR
   - Cumulative value < €100 since last SCA

**Implementation:**
```javascript
// Stripe automatically tracks and applies exemption
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2500, // €25.00
  currency: 'eur',

  // Request low-value exemption
  payment_method_options: {
    card: {
      request_three_d_secure: 'automatic' // Stripe decides based on rules
    }
  }
});

// Stripe will:
// 1. Check if exemption conditions met
// 2. Request exemption from issuer
// 3. Issuer may still require SCA (soft decline)
// 4. We handle soft decline by re-attempting with SCA
```

### 3.3 Transaction Risk Analysis (TRA)

**Conditions for TRA Exemption:**

| Amount | Fraud Rate Threshold |
|--------|---------------------|
| < €100 | < 0.13% |
| < €250 | < 0.06% |
| < €500 | < 0.01% |

**Requirements:**
- Real-time fraud monitoring
- Historical fraud rate calculation
- Immediate fraud notification to scheme

**Our Implementation:**
- Stripe calculates our fraud rate
- Stripe determines if TRA exemption applicable
- We have no direct control over TRA exemptions
- Stripe's fraud rate allows TRA for eligible amounts

### 3.4 Trusted Beneficiary Exemption

**How It Works:**
1. After successful SCA, user option to "Trust this merchant"
2. Future payments to trusted merchant may be exempt from SCA
3. User can manage trusted beneficiaries list
4. Issuer ultimately decides whether to honor exemption

**Implementation:**
```javascript
// After successful payment
if (paymentIntent.status === 'succeeded') {
  // Offer user option to trust merchant
  showTrustedBeneficiaryPrompt({
    message: "Trust this merchant for future payments?",
    benefits: "Faster checkout next time",
    onAccept: async () => {
      // User adds to trusted list via bank app
      // We don't directly manage this - it's between user and bank
    }
  });
}
```

### 3.5 Recurring Payment Exemption

**For Subscriptions and Recurring Payments:**

**Rules:**
- SCA required for FIRST payment
- Subsequent payments exempt IF:
  - Fixed amount
  - Same merchant
  - Fixed schedule

**Implementation:**
```javascript
// First subscription payment - SCA required
const setupIntent = await stripe.setupIntents.create({
  customer: 'cus_xxx',
  payment_method_types: ['card'],
  usage: 'off_session' // For future recurring use
});

// User completes SCA for setup

// Future recurring payments - no SCA needed
const subscription = await stripe.subscriptions.create({
  customer: 'cus_xxx',
  items: [{ price: 'price_xxx' }],

  // This payment method already authenticated via setupIntent
  default_payment_method: 'pm_xxx',

  // Exempt from SCA
  off_session: true
});
```

**Important Note:**
- If amount changes significantly, SCA may be required again
- If payment fails due to soft decline, must retry with SCA

### 3.6 Exemption Management Strategy

**Our Approach:**
1. Request appropriate exemptions automatically (via Stripe)
2. Handle soft declines gracefully (retry with SCA)
3. Monitor exemption success rate
4. Optimize for user experience while maintaining security

**Soft Decline Handling:**
```javascript
async function processPayment(paymentIntent) {
  try {
    const result = await stripe.confirmCardPayment(paymentIntent.client_secret);

    if (result.error) {
      // Check if soft decline (issuer requires SCA despite exemption)
      if (result.error.code === 'authentication_required') {
        // Retry with SCA
        const scaResult = await stripe.confirmCardPayment(
          paymentIntent.client_secret,
          {
            payment_method_options: {
              card: {
                request_three_d_secure: 'any' // Force SCA
              }
            }
          }
        );

        return handlePaymentResult(scaResult);
      }

      throw result.error;
    }

    return result.paymentIntent;

  } catch (error) {
    handlePaymentError(error);
  }
}
```

## 4. Dynamic Linking

### 4.1 Definition

Dynamic linking ensures authentication is linked to:
1. **Transaction amount**
2. **Payee (recipient)**

User must see these details during authentication.

### 4.2 Implementation

**Via 3D Secure 2:**

```javascript
// When creating payment intent, include transaction details
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // €50.00
  currency: 'eur',
  customer: 'cus_xxx',

  // These details shown to user during 3DS challenge
  description: 'Subscription - Pro Plan',

  metadata: {
    merchant_name: 'Company Name',
    order_id: 'order_123'
  },

  // Shipping/billing address (shown in challenge)
  shipping: {
    name: 'John Doe',
    address: {
      line1: '123 Main St',
      city: 'London',
      postal_code: 'SW1A 1AA',
      country: 'GB'
    }
  }
});

// During 3DS challenge, user sees:
// "Authorize payment of €50.00 to Company Name"
// User confirms THIS specific transaction
```

**Dynamic Linking Screen Example:**
```
┌─────────────────────────────────────┐
│   Authentication Required           │
├─────────────────────────────────────┤
│                                     │
│   Authorize payment of:             │
│                                     │
│   Amount: €50.00                    │
│   To: Company Name                  │
│   For: Subscription - Pro Plan      │
│                                     │
│   Enter code sent to ***6789:       │
│   [______]                          │
│                                     │
│   [Cancel]  [Confirm]               │
│                                     │
└─────────────────────────────────────┘
```

### 4.3 Compliance Verification

**Requirements Met:**
- ✓ Amount displayed during authentication
- ✓ Payee (merchant) displayed during authentication
- ✓ Authentication code dynamically generated
- ✓ Code specific to this transaction
- ✓ Cannot be reused for different amount or payee

**Stripe's Implementation:**
- Stripe passes transaction details to issuer
- Issuer displays in authentication challenge
- Authentication cryptographically linked to transaction

## 5. Secure Communication Standards

### 5.1 API Security

**Requirements:**
- Secure communication channels (TLS)
- API authentication
- Message integrity
- Mutual authentication (for TPPs)

**Our Implementation:**

```javascript
// All API calls use HTTPS with TLS 1.3
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  typescript: true,

  // Enforce TLS 1.3
  httpClient: Stripe.createNodeHttpClient({
    minVersion: 'TLSv1.3'
  })
});

// API key authentication
// Keys stored in environment variables, never in code
// Different keys for test/production
// Keys rotated every 90 days
```

### 5.2 TLS Configuration

**Minimum Requirements:**
- TLS 1.2 or higher
- Strong cipher suites only
- Certificate validation

**Our Configuration:**
```nginx
# Nginx configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;

# Certificate pinning
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 5.3 API Authentication

**Stripe API Keys:**
- Secret key: Server-side only, never exposed
- Publishable key: Client-side, limited permissions
- Restricted keys: Specific permissions only

**Key Management:**
```javascript
// Development
const stripeTest = require('stripe')(process.env.STRIPE_TEST_SECRET_KEY);

// Production
const stripeLive = require('stripe')(process.env.STRIPE_LIVE_SECRET_KEY);

// Restricted key for webhook endpoint only
const stripeWebhook = require('stripe')(process.env.STRIPE_WEBHOOK_KEY);

// Key rotation procedure: Every 90 days
// 1. Generate new key in Stripe dashboard
// 2. Update environment variable
// 3. Deploy with zero downtime (both keys valid during transition)
// 4. Revoke old key after verification
```

## 6. Transaction Monitoring

### 6.1 Fraud Detection

**Real-Time Monitoring:**

| Risk Signal | Action | Threshold |
|-------------|--------|-----------|
| Multiple failed payments | Block temporarily | 3 failures in 1 hour |
| High-value unusual transaction | Request SCA | >2x typical amount |
| New device | Additional verification | First use |
| Geo-location mismatch | Challenge | Different country than usual |
| Velocity check | Rate limit | 5 transactions in 10 minutes |

**Implementation:**
```javascript
// Stripe Radar (automatic fraud detection)
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'eur',

  // Stripe Radar analyzes automatically
  // No additional code needed

  // But we can add custom rules
  metadata: {
    user_id: 'usr_123',
    typical_amount: 5000,
    previous_country: 'GB'
  }
});

// Custom fraud checks
async function additionalFraudChecks(payment) {
  // Check velocity (transactions per time period)
  const recentTransactions = await getRecentTransactions(
    payment.customer,
    { since: Date.now() - 3600000 } // Last hour
  );

  if (recentTransactions.length > 5) {
    return { risk: 'high', reason: 'velocity' };
  }

  // Check amount vs. historical average
  const avgAmount = await getAverageTransactionAmount(payment.customer);
  if (payment.amount > avgAmount * 2) {
    return { risk: 'medium', reason: 'unusual_amount' };
  }

  return { risk: 'low' };
}
```

### 6.2 Fraud Reporting

**Requirements:**
- Report fraud to payment scheme
- Contribute to industry fraud statistics
- Enable TRA exemption eligibility

**Our Process:**
1. Stripe automatically reports fraud data
2. We supplement with additional fraud cases
3. Quarterly review of fraud metrics
4. Annual fraud rate calculation

**Fraud Metrics Tracked:**
- Fraud rate (fraudulent amount / total amount)
- Fraud rate by transaction amount
- Fraud rate by authentication method
- False positive rate (legitimate transactions declined)

### 6.3 Suspicious Activity Detection

**Patterns We Monitor:**

| Pattern | Detection Method | Response |
|---------|-----------------|----------|
| Card testing | Multiple small transactions | Block card |
| Account takeover | Login from unusual location | Require re-authentication |
| Stolen cards | High-value purchase after account change | Manual review |
| Friendly fraud | Chargeback history | Flag for review |

**Alerting:**
```javascript
// Real-time fraud alerts
fraudDetectionSystem.on('suspicious_activity', async (event) => {
  // Log incident
  await auditLog.create({
    type: 'fraud_alert',
    severity: event.risk_level,
    details: event
  });

  // Take action based on risk level
  switch (event.risk_level) {
    case 'high':
      await blockUser(event.user_id);
      await notifySecurityTeam(event);
      break;
    case 'medium':
      await requestAdditionalAuthentication(event.user_id);
      break;
    case 'low':
      await logForReview(event);
      break;
  }
});
```

## 7. Payment Flows

### 7.1 One-Time Payment Flow

```javascript
// Step 1: Create payment intent
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000,
  currency: 'eur',
  customer: 'cus_xxx',
  payment_method: 'pm_xxx',
  confirmation_method: 'manual', // Client confirms

  // Metadata for compliance logging
  metadata: {
    order_id: 'order_123',
    user_id: 'usr_456'
  }
});

// Step 2: Client confirms payment (may trigger SCA)
// Frontend code:
const { error, paymentIntent: confirmedPayment } =
  await stripe.confirmCardPayment(clientSecret);

if (error) {
  // Handle error (authentication failed, card declined, etc.)
  handlePaymentError(error);
} else if (confirmedPayment.status === 'succeeded') {
  // Payment successful
  handlePaymentSuccess(confirmedPayment);
}

// Step 3: Log for compliance
await auditLog.create({
  action: 'payment_completed',
  payment_intent_id: confirmedPayment.id,
  amount: confirmedPayment.amount,
  currency: confirmedPayment.currency,
  sca_performed: confirmedPayment.charges.data[0].payment_method_details.card.three_d_secure !== null,
  timestamp: new Date()
});
```

### 7.2 Subscription Setup Flow

```javascript
// Step 1: Create setup intent (for future payments)
const setupIntent = await stripe.setupIntents.create({
  customer: 'cus_xxx',
  payment_method_types: ['card'],
  usage: 'off_session', // Will be charged without customer present

  // Mandate data (terms user agrees to)
  mandate_data: {
    customer_acceptance: {
      type: 'online',
      online: {
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      }
    }
  }
});

// Step 2: Client confirms setup (SCA REQUIRED for first time)
// Frontend:
const { error, setupIntent: confirmedSetup } =
  await stripe.confirmCardSetup(clientSecret);

if (confirmedSetup.status === 'succeeded') {
  // Setup complete - can now charge off-session

  // Step 3: Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: 'cus_xxx',
    items: [{ price: 'price_monthly_pro' }],
    default_payment_method: confirmedSetup.payment_method,

    // Future charges exempt from SCA (recurring exemption)
    off_session: true,

    // But handle soft declines
    payment_behavior: 'default_incomplete'
  });
}
```

### 7.3 Soft Decline Recovery Flow

```javascript
// When recurring payment fails with soft decline
stripe.webhooks.on('invoice.payment_action_required', async (invoice) => {
  // Issuer requires SCA despite recurring exemption

  // Email customer
  await sendEmail({
    to: invoice.customer_email,
    subject: 'Action Required: Confirm Your Payment',
    body: `
      Your payment requires additional authentication.
      Please visit: ${generatePaymentConfirmationUrl(invoice)}
    `
  });

  // Customer clicks link, completes SCA
  // On success, payment retried automatically
});

// Handle successful retry
stripe.webhooks.on('invoice.paid', async (invoice) => {
  if (invoice.billing_reason === 'subscription_cycle') {
    await auditLog.create({
      action: 'subscription_payment_succeeded',
      customer_id: invoice.customer,
      amount: invoice.amount_paid,
      sca_performed: true // If this was after soft decline
    });
  }
});
```

### 7.4 Saved Card Payment Flow

```javascript
// Using previously saved card (already authenticated)
const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000,
  currency: 'eur',
  customer: 'cus_xxx',
  payment_method: 'pm_xxx', // Previously saved
  off_session: true, // Customer not present
  confirm: true, // Immediate confirmation

  // May trigger SCA if exemption not applicable
  payment_method_options: {
    card: {
      request_three_d_secure: 'automatic'
    }
  }
});

// Handle result
if (paymentIntent.status === 'requires_action') {
  // SCA required - notify customer
  await sendSCARequest(paymentIntent);
} else if (paymentIntent.status === 'succeeded') {
  // Payment successful without SCA (exemption applied)
  await confirmOrder(paymentIntent);
}
```

## 8. Record Keeping

### 8.1 Transaction Records

**What We Log:**

```javascript
// Comprehensive transaction log
const transactionRecord = {
  // Payment identification
  payment_intent_id: 'pi_xxx',
  stripe_charge_id: 'ch_xxx',
  order_id: 'order_123',

  // Amounts
  amount: 5000,
  currency: 'eur',
  fee: 150,
  net: 4850,

  // SCA compliance
  sca_performed: true,
  three_d_secure_result: {
    authenticated: true,
    version: '2.1.0',
    electronic_commerce_indicator: '05',
    transaction_id: '3ds_xxx'
  },

  // Exemption info
  exemption_requested: 'low_value',
  exemption_applied: true,

  // Risk assessment
  radar_risk_score: 25, // 0-100
  radar_risk_level: 'normal',

  // Timestamps
  created_at: '2025-11-05T10:00:00Z',
  authorized_at: '2025-11-05T10:00:15Z',
  captured_at: '2025-11-05T10:00:20Z',

  // Parties
  customer_id: 'cus_xxx',
  customer_email: 'user@example.com',
  merchant_id: 'acct_our_account',

  // Device/location
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0...',
  country: 'GB',

  // Compliance
  psd2_compliant: true,
  retained_until: '2032-11-05' // 7 years
};
```

### 8.2 Retention Period

**PSD2 Requirements:**
- Transaction records: 5 years minimum
- Authentication records: 5 years minimum

**Our Policy:**
- Transaction records: 7 years (exceeds PSD2, meets SOX)
- Authentication records: 7 years
- Audit logs: 7 years

### 8.3 Audit Trail

**For Each Payment:**
1. Payment initiated (timestamp, user, amount)
2. Exemption evaluation (type, approved/denied)
3. Authentication required (yes/no, method)
4. Authentication completed (success/failure)
5. Payment authorized (timestamp, auth code)
6. Payment captured (timestamp)
7. Settlement (timestamp)

**Example Audit Trail:**
```
2025-11-05 10:00:00 | payment_initiated | usr_123 | €50.00 | order_456
2025-11-05 10:00:05 | exemption_check | low_value | denied | amount_exceeds_threshold
2025-11-05 10:00:06 | sca_required | 3ds2 | requested
2025-11-05 10:00:10 | sca_challenge_sent | SMS | phone_***6789
2025-11-05 10:00:45 | sca_completed | success | authenticated
2025-11-05 10:00:50 | payment_authorized | ch_xxx | auth_abc123
2025-11-05 10:00:55 | payment_captured | ch_xxx | €50.00
2025-11-05 23:59:59 | payment_settled | transfer_xyz | €48.50 (net of fees)
```

## 9. Compliance Monitoring

### 9.1 Key Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| SCA completion rate | >95% | - | Monitoring |
| Exemption approval rate | >80% | - | Monitoring |
| Soft decline rate | <5% | - | Monitoring |
| Authentication abandonment | <10% | - | Monitoring |
| Fraud rate | <0.13% | - | Monitoring |

### 9.2 Monthly Compliance Review

**Review Checklist:**
- [ ] Review SCA application rate
- [ ] Review exemption usage (appropriate?)
- [ ] Review soft decline handling
- [ ] Review fraud metrics
- [ ] Review authentication failures
- [ ] Check Stripe compliance updates
- [ ] Update documentation if needed

### 9.3 Quarterly Compliance Audit

**Audit Areas:**
- Transaction sample testing (25 transactions)
- Verify SCA applied when required
- Verify exemptions properly applied
- Verify dynamic linking implementation
- Review fraud monitoring effectiveness
- Test soft decline recovery process

## 10. Regulatory Updates

### 10.1 Monitoring Process

**Sources:**
- European Banking Authority (EBA) website
- Payment scheme notifications
- Stripe regulatory updates
- Industry newsletters
- Legal counsel advisories

**Review Schedule:**
- Daily: Stripe dashboard for urgent updates
- Weekly: Industry news review
- Monthly: Regulatory authority websites
- Quarterly: Legal counsel consultation

### 10.2 Change Management

**When Regulatory Change Occurs:**
1. **Impact Assessment** (within 5 days)
   - What's changing?
   - Does it affect our implementation?
   - Timeline for compliance?

2. **Implementation Plan** (within 10 days)
   - Technical changes needed
   - Policy updates required
   - Training requirements
   - Testing approach

3. **Implementation** (per regulatory timeline)
   - Develop changes
   - Test thoroughly
   - Deploy to production
   - Verify compliance

4. **Documentation** (within 5 days of implementation)
   - Update compliance documentation
   - Update policies
   - Communicate to team

## 11. Third-Party Provider (TPP) Access

**Note:** If we later offer Account Information Services (AIS) or Payment Initiation Services (PIS), additional requirements apply.

### 11.1 TPP Access Requirements (If Applicable)

If we become an Account Servicing Payment Service Provider (ASPSP):
- Provide API for TPP access
- Implement strong customer authentication for TPP
- Support TPP identification and authentication
- Provide fallback mechanism

**Not currently applicable** - we are a merchant, not an ASPSP.

## 12. Customer Communication

### 12.1 SCA Explanation for Users

**User-Facing Language:**

```
Why am I seeing an additional security step?

For your protection, European regulations require us to verify
your identity for certain payments. This helps prevent fraud
and keeps your payment information secure.

You'll receive a one-time code via text message or your banking
app. Simply enter this code to complete your payment.

This only takes a few seconds and helps keep your money safe.
```

### 12.2 Exemption Communication

**When Low-Value Exemption Applied:**

```
Quick Checkout

For faster checkout on this small purchase, we've skipped the
extra security step.

For your protection, we'll ask you to verify your identity
periodically, or for larger purchases.
```

### 12.3 Soft Decline Handling

**Email Template:**

```
Subject: Action Needed: Verify Your Payment

Hi [Name],

We need your help to complete your payment of €[amount].

Your bank requires an additional security check. This only takes
a moment.

[Verify Payment Button]

Why is this needed?
For your security, your bank occasionally requires verification
even for recurring payments. This helps protect against fraud.

Questions? Contact our support team.

Thanks,
[Company Name]
```

## 13. Training Requirements

### 13.1 Staff Training

**Customer Support:**
- PSD2 overview and SCA purpose
- How to explain SCA to customers
- Troubleshooting authentication issues
- Recognizing soft declines
- **Duration:** 2 hours

**Developers:**
- PSD2 technical requirements
- Stripe SCA implementation
- Exemption handling
- Soft decline recovery
- Testing SCA flows
- **Duration:** 4 hours

**Finance/Operations:**
- PSD2 compliance requirements
- Record keeping obligations
- Reporting requirements
- **Duration:** 2 hours

### 13.2 Training Schedule

- Initial training: Upon hire
- Annual refresher: Required
- Ad-hoc training: When regulations change

## 14. Key Contacts

| Role | Contact | Phone | Email |
|------|---------|-------|-------|
| PSD2 Compliance Officer | [Name] | [Phone] | compliance@company.com |
| Technical Lead (Payments) | [Name] | [Phone] | payments@company.com |
| Stripe Account Manager | [Name] | [Phone] | [Stripe email] |
| Legal Counsel | [Name] | [Phone] | legal@company.com |

## 15. Document Control

### 15.1 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-05 | Compliance Team | Initial version |

### 15.2 Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Chief Technology Officer | [Name] | ___________ | ______ |
| Chief Financial Officer | [Name] | ___________ | ______ |
| Legal Counsel | [Name] | ___________ | ______ |

---

**Document Classification:** INTERNAL - CONFIDENTIAL
**Next Review Date:** 2026-11-05

## Appendix A: Resources

- [European Banking Authority - PSD2](https://www.eba.europa.eu/regulation-and-policy/payment-services-and-electronic-money/regulatory-technical-standards-on-strong-customer-authentication-and-secure-communication-under-psd2)
- [Stripe PSD2 Guide](https://stripe.com/docs/strong-customer-authentication)
- [PSD2 Official Text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32015L2366)

## Appendix B: Testing Scenarios

**Test Cases for SCA:**
1. Standard payment requiring SCA
2. Low-value payment exemption
3. Recurring payment (first vs. subsequent)
4. Trusted beneficiary flow
5. Soft decline and recovery
6. 3DS challenge completion
7. 3DS challenge abandonment
8. Failed authentication

## Appendix C: Exemption Decision Tree

[Visual decision tree for determining appropriate exemption]
