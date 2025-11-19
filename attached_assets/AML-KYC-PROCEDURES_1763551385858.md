# AML/KYC Procedures

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Next Review Date:** 2026-11-05
**Applicable Regulations:** Bank Secrecy Act (BSA), USA PATRIOT Act, FinCEN Regulations, EU AML Directives

## Executive Summary

This document outlines our Anti-Money Laundering (AML) and Know Your Customer (KYC) procedures designed to prevent money laundering, terrorist financing, and other financial crimes. These procedures comply with applicable regulations including the Bank Secrecy Act, USA PATRIOT Act, and EU AML Directives.

## 1. AML/KYC Overview

### 1.1 Regulatory Framework

| Regulation | Jurisdiction | Key Requirements |
|-----------|--------------|------------------|
| Bank Secrecy Act (BSA) | USA | Record keeping, reporting, compliance program |
| USA PATRIOT Act | USA | Customer identification, beneficial ownership |
| FinCEN Regulations | USA | SAR filing, CTR reporting |
| 4th AML Directive | EU | Risk-based approach, beneficial ownership |
| 5th AML Directive | EU | Enhanced due diligence, crypto assets |
| 6th AML Directive | EU | Criminal liability, wider scope |

### 1.2 Program Components

Our AML/KYC program consists of:
1. **Customer Identification Program (CIP)**
2. **Customer Due Diligence (CDD)**
3. **Enhanced Due Diligence (EDD)**
4. **Ongoing Monitoring**
5. **Suspicious Activity Reporting**
6. **Sanctions Screening**
7. **Record Keeping**
8. **Training**
9. **Independent Testing**

### 1.3 Risk-Based Approach

We apply a risk-based approach to AML/KYC:
- **Low Risk:** Standard due diligence
- **Medium Risk:** Enhanced documentation
- **High Risk:** Enhanced due diligence + ongoing monitoring

## 2. Customer Identification Program (CIP)

### 2.1 Identification Requirements

**For Individuals:**

| Information Required | Verification Method | Acceptable Documents |
|---------------------|-------------------|---------------------|
| Full legal name | Government-issued ID | Passport, driver's license, national ID |
| Date of birth | Government-issued ID | Same as above |
| Residential address | Proof of address | Utility bill, bank statement, government letter |
| Nationality | Government-issued ID | Passport, national ID |
| Taxpayer identification | Self-declaration | SSN, Tax ID, VAT number |

**For Business Entities:**

| Information Required | Verification Method | Acceptable Documents |
|---------------------|-------------------|---------------------|
| Legal business name | Official registry | Certificate of incorporation |
| Business address | Proof of address | Utility bill, bank statement |
| Incorporation jurisdiction | Official registry | Certificate of incorporation |
| Business structure | Official registry | Articles of association |
| Tax identification | Official registry | EIN, VAT certificate |
| Beneficial owners (>25%) | Declaration + verification | ID documents for each owner |
| Directors/signatories | Official registry | Corporate registry excerpt |

### 2.2 Verification Methods

**Document Verification:**
```javascript
// Automated document verification workflow
async function verifyCustomerIdentity(customerId, documents) {
  // Step 1: Document authentication
  const documentCheck = await verifyDocument({
    type: documents.id_type, // 'passport', 'drivers_license', 'national_id'
    number: documents.id_number,
    country: documents.country,
    images: documents.scans // Front and back images
  });

  // Step 2: Liveness check (for individuals)
  const livenessCheck = await verifyLiveness({
    selfie: documents.selfie,
    id_photo: documentCheck.extracted_photo
  });

  // Step 3: Address verification
  const addressCheck = await verifyAddress({
    document: documents.proof_of_address,
    stated_address: documents.address
  });

  // Step 4: Risk scoring
  const riskScore = calculateRiskScore({
    document_validity: documentCheck.valid,
    liveness_passed: livenessCheck.passed,
    address_verified: addressCheck.verified,
    jurisdiction_risk: getJurisdictionRisk(documents.country)
  });

  // Store verification results
  await db.kyc_verifications.create({
    customer_id: customerId,
    verification_date: new Date(),
    documents_verified: documentCheck.valid,
    liveness_passed: livenessCheck.passed,
    address_verified: addressCheck.verified,
    risk_score: riskScore,
    status: riskScore < 70 ? 'approved' : 'manual_review',
    verified_by: 'automated_system'
  });

  return {
    approved: riskScore < 70,
    risk_score: riskScore,
    requires_manual_review: riskScore >= 70
  };
}
```

**Third-Party Verification Services:**
- Identity verification: Onfido, Jumio, Stripe Identity
- Address verification: Loqate, Experian
- Business verification: Dun & Bradstreet, Companies House

### 2.3 Non-Documentary Verification

**When Documents Unavailable:**
- Credit bureau check
- Database verification (public records)
- Reference from financial institution
- Collateral documentation

**Minimum Requirements:**
- At least two independent sources
- Source reliability documented
- Verification results recorded

### 2.4 Verification Timing

| Account Type | Verification Timing | Risk Level |
|-------------|-------------------|------------|
| Individual (low-risk country) | Before first transaction | Standard |
| Individual (high-risk country) | Before account activation | Enhanced |
| Business (< $10k transactions) | Within 30 days | Standard |
| Business (> $10k transactions) | Before account activation | Enhanced |
| High-risk customer | Before account activation | EDD required |

## 3. Customer Due Diligence (CDD)

### 3.1 CDD Levels

**Simplified Due Diligence (SDD):**
- Low-risk customers only
- Minimal transactions (< $1,000/month)
- EU/EEA individuals
- Established businesses with clean record

**Standard Due Diligence (Standard CDD):**
- Most customers
- Moderate transaction volumes
- Standard risk profile
- Regular monitoring

**Enhanced Due Diligence (EDD):**
- High-risk customers (see Section 4)
- PEPs (Politically Exposed Persons)
- High-risk jurisdictions
- Cash-intensive businesses
- >$50,000 transactions

### 3.2 Standard CDD Requirements

**Information to Collect:**
1. **Identity Information:**
   - Full name, DOB, address
   - Government ID verification
   - Proof of address

2. **Business Purpose:**
   - Nature of business
   - Expected transaction volume
   - Source of funds
   - Purpose of account

3. **Risk Factors:**
   - Jurisdiction
   - Business type
   - Transaction patterns
   - Source of wealth

**CDD Questionnaire:**
```
CUSTOMER DUE DILIGENCE QUESTIONNAIRE

1. PERSONAL/BUSINESS INFORMATION
   Name: _______________
   Type: [ ] Individual [ ] Business
   Country: _______________
   Occupation/Industry: _______________

2. ACCOUNT PURPOSE
   Why are you opening this account?
   _______________

   What services do you intend to use?
   [ ] Automated bookkeeping
   [ ] Payment processing
   [ ] Expense management
   [ ] Other: _______________

3. EXPECTED ACTIVITY
   Expected monthly transaction volume: _______________
   Expected monthly transaction value: $ _______________
   Expected transaction types:
   [ ] Customer payments
   [ ] Vendor payments
   [ ] Payroll
   [ ] Other: _______________

4. SOURCE OF FUNDS
   Primary source of funds:
   [ ] Employment income
   [ ] Business revenue
   [ ] Investments
   [ ] Other: _______________

5. BENEFICIAL OWNERSHIP (if business)
   List all individuals owning >25%:
   1. Name: _______________ Ownership: ____%
   2. Name: _______________ Ownership: ____%

6. POLITICALLY EXPOSED PERSON (PEP)
   Are you or any beneficial owner a PEP?
   [ ] Yes [ ] No

   If yes, provide details: _______________

7. HIGH-RISK JURISDICTION
   Do you have operations in high-risk jurisdictions?
   [ ] Yes [ ] No

   If yes, which countries: _______________

Signature: _______________ Date: _______________
```

### 3.3 Ongoing CDD

**Periodic Review Schedule:**

| Customer Risk Level | Review Frequency | Trigger Events |
|-------------------|-----------------|----------------|
| Low | Every 3 years | None (unless red flags) |
| Medium | Annually | Significant transaction changes |
| High | Every 6 months | Any unusual activity |
| PEP | Every 6 months | Any activity |

**Review Includes:**
- Update customer information
- Verify continued accuracy of risk rating
- Review transaction patterns
- Check for adverse media
- Re-run sanctions screening
- Update documentation

## 4. Enhanced Due Diligence (EDD)

### 4.1 When EDD Required

**Mandatory EDD:**
- Politically Exposed Persons (PEPs)
- Customers from high-risk jurisdictions (FATF list)
- Cash-intensive businesses
- Money service businesses
- Transactions > $50,000
- Adverse media findings
- Unexplained wealth

**High-Risk Jurisdictions (Examples):**
- Countries on FATF blacklist/graylist
- Countries with inadequate AML controls
- Countries with high corruption index
- Sanctioned countries

### 4.2 EDD Requirements

**Additional Information Required:**

1. **Source of Wealth:**
   - Detailed documentation of how wealth accumulated
   - Tax returns, business records, inheritance documents
   - Bank statements showing fund sources

2. **Source of Funds:**
   - Specific source for each transaction
   - Documentation proving legitimacy
   - Traceability to legal source

3. **Business Relationships:**
   - Details of major customers/suppliers
   - Purpose of transactions
   - Economic rationale for business relationship

4. **PEP Details:**
   - Position held (current or former)
   - Country of position
   - Family members and close associates
   - Approval from senior management

**EDD Documentation Checklist:**
```
ENHANCED DUE DILIGENCE CHECKLIST

[ ] Certified copy of identification documents
[ ] Proof of address (< 3 months old)
[ ] Source of wealth documentation:
    [ ] Tax returns (last 3 years)
    [ ] Business financial statements
    [ ] Inheritance documents
    [ ] Investment records
[ ] Source of funds documentation:
    [ ] Bank statements
    [ ] Sale agreements
    [ ] Loan documents
    [ ] Employment records
[ ] PEP screening results
[ ] Adverse media search results
[ ] Sanctions screening results
[ ] Senior management approval
[ ] Ongoing monitoring plan

Completed by: _______________ Date: _______________
Approved by: _______________ Date: _______________
```

### 4.3 PEP Identification

**Definition of PEP:**
Individuals entrusted with prominent public functions, including:
- Heads of state/government
- Senior politicians
- Senior government officials
- Judicial officials
- Military officials
- State-owned enterprise executives
- Important political party officials

**Also Includes:**
- Family members of PEPs (spouse, children, parents)
- Close associates of PEPs (business partners, beneficial owners of same entities)

**PEP Screening:**
```javascript
// Automated PEP screening
async function screenForPEP(customer) {
  // Use third-party PEP database
  const pepCheck = await pepDatabase.screen({
    name: customer.name,
    date_of_birth: customer.dob,
    country: customer.country
  });

  if (pepCheck.is_pep) {
    // Trigger EDD workflow
    await triggerEDDWorkflow(customer.id, {
      reason: 'pep_identified',
      pep_details: pepCheck.details,
      risk_level: 'high'
    });

    // Require senior management approval
    await requestApproval(customer.id, {
      approver: 'compliance_officer',
      reason: 'PEP relationship - enhanced due diligence required'
    });

    // Enhanced monitoring
    await setMonitoringLevel(customer.id, 'enhanced');

    // Document decision
    await db.edd_records.create({
      customer_id: customer.id,
      edd_type: 'pep',
      pep_position: pepCheck.details.position,
      pep_country: pepCheck.details.country,
      approval_status: 'pending',
      initiated_date: new Date()
    });
  }

  return pepCheck;
}
```

### 4.4 Senior Management Approval

**Approval Required For:**
- PEP relationships
- High-risk jurisdictions
- Transactions > $50,000
- Adverse media findings

**Approval Process:**
1. Compliance Officer reviews EDD documentation
2. Makes recommendation (approve/decline)
3. Senior management (CEO/CFO) final decision
4. Decision documented with rationale
5. Ongoing monitoring plan established

## 5. Beneficial Ownership

### 5.1 Identification Requirements

**Beneficial Owner Definition:**
Individual who:
- Owns ≥25% of entity, OR
- Exercises significant control over entity

**Information Required:**
- Full name
- Date of birth
- Residential address
- Ownership percentage
- Government ID
- Tax identification number

### 5.2 Verification Process

**For Corporations:**
1. Obtain ownership structure chart
2. Identify individuals with ≥25% ownership
3. Verify identity of each beneficial owner
4. Document control structure
5. Update annually or when changes occur

**For Trusts:**
- Identify settlor/grantor
- Identify trustee(s)
- Identify beneficiaries
- Identify any other person with control

**For Partnerships:**
- Identify general partners
- Identify limited partners with ≥25%
- Verify control arrangements

### 5.3 Certification Form

```
BENEFICIAL OWNERSHIP CERTIFICATION

Entity Name: _______________
Entity Type: _______________
Jurisdiction: _______________

I certify that the following individuals are beneficial owners
(owning ≥25% or exercising significant control):

1. Name: _______________
   DOB: _______________
   Address: _______________
   Ownership %: _______________
   Control: [ ] Ownership [ ] Voting [ ] Other: _______

2. Name: _______________
   DOB: _______________
   Address: _______________
   Ownership %: _______________
   Control: [ ] Ownership [ ] Voting [ ] Other: _______

I certify that the above information is true, accurate, and
complete to the best of my knowledge.

Signature: _______________ Title: _______________
Date: _______________

FOR COMPANY USE:
Verified by: _______________ Date: _______________
Documents reviewed:
[ ] Articles of Incorporation
[ ] Shareholder Register
[ ] Operating Agreement
[ ] Other: _______________
```

## 6. Transaction Monitoring

### 6.1 Monitoring Triggers

**Red Flags:**

| Red Flag | Risk Level | Action |
|----------|-----------|--------|
| Structuring (multiple <$10k) | High | SAR investigation |
| Unusual volume/frequency | Medium | Enhanced monitoring |
| Transactions inconsistent with business | Medium | Investigation |
| Rapid movement of funds | High | Enhanced monitoring |
| Payments to/from high-risk jurisdictions | High | EDD review |
| Round-dollar amounts (large) | Low | Review |
| Multiple wire transfers same day | Medium | Investigation |
| Customer reluctant to provide information | High | SAR consideration |

### 6.2 Automated Monitoring

```javascript
// Real-time transaction monitoring system
async function monitorTransaction(transaction) {
  const alerts = [];

  // Check for structuring
  const recentTransactions = await getRecentTransactions(
    transaction.customer_id,
    { since: Date.now() - 24 * 60 * 60 * 1000 } // Last 24 hours
  );

  // Multiple transactions just under $10,000
  const underThreshold = recentTransactions.filter(t =>
    t.amount > 9000 && t.amount < 10000
  );

  if (underThreshold.length >= 2) {
    alerts.push({
      type: 'possible_structuring',
      severity: 'high',
      description: `${underThreshold.length} transactions just under $10,000 in 24 hours`,
      requires_sar: true
    });
  }

  // Check velocity (unusual frequency)
  const avgDailyTransactions = await getAverageDailyTransactions(
    transaction.customer_id
  );

  if (recentTransactions.length > avgDailyTransactions * 3) {
    alerts.push({
      type: 'unusual_frequency',
      severity: 'medium',
      description: `Transaction frequency ${recentTransactions.length} is 3x normal`,
      requires_sar: false
    });
  }

  // Check amount (unusual size)
  const avgTransactionAmount = await getAverageTransactionAmount(
    transaction.customer_id
  );

  if (transaction.amount > avgTransactionAmount * 10) {
    alerts.push({
      type: 'unusual_amount',
      severity: 'medium',
      description: `Transaction amount is 10x typical amount`,
      requires_sar: false
    });
  }

  // Check high-risk jurisdiction
  if (isHighRiskJurisdiction(transaction.recipient_country)) {
    alerts.push({
      type: 'high_risk_jurisdiction',
      severity: 'high',
      description: `Transaction to high-risk country: ${transaction.recipient_country}`,
      requires_sar: false,
      requires_review: true
    });
  }

  // Check sanctions
  const sanctionsHit = await screenAgainstSanctions(
    transaction.recipient_name
  );

  if (sanctionsHit.match) {
    alerts.push({
      type: 'sanctions_hit',
      severity: 'critical',
      description: `Potential sanctions match: ${sanctionsHit.details}`,
      requires_sar: true,
      block_transaction: true
    });
  }

  // If alerts generated, create case
  if (alerts.length > 0) {
    await createInvestigationCase({
      transaction_id: transaction.id,
      customer_id: transaction.customer_id,
      alerts: alerts,
      status: 'pending_review',
      assigned_to: 'compliance_team'
    });

    // Block if critical
    if (alerts.some(a => a.block_transaction)) {
      await blockTransaction(transaction.id);
      await notifyCustomer(transaction.customer_id, 'transaction_blocked');
    }
  }

  return alerts;
}
```

### 6.3 Manual Review Process

**When Alert Triggered:**
1. **Initial Review** (within 24 hours)
   - Review transaction details
   - Check customer profile
   - Review historical activity
   - Assess legitimacy

2. **Investigation** (within 3 business days)
   - Contact customer for explanation (if appropriate)
   - Gather additional documentation
   - Research parties involved
   - Check adverse media

3. **Decision** (within 5 business days)
   - Approve transaction (legitimate)
   - File SAR (suspicious)
   - Close account (serious concerns)
   - Request additional information

4. **Documentation** (within 2 business days of decision)
   - Document investigation steps
   - Record decision and rationale
   - File SAR if required
   - Update customer risk rating

## 7. Suspicious Activity Reporting (SAR)

### 7.1 When to File SAR

**Mandatory SAR Filing:**
- Transaction involves ≥$5,000 and suspicious
- Attempted transaction would involve ≥$5,000 if completed
- Involves potential money laundering or violation of BSA
- Involves potential terrorist financing (any amount)
- Involves structuring ($10,000 threshold)

**Examples of Suspicious Activity:**
- Customer provides insufficient/false information
- Customer reluctant to provide information
- Customer has no business rationale for transaction
- Transaction inconsistent with customer's business
- Funds rapidly moved in and out
- Customer uses multiple accounts to evade limits
- Customer makes large cash deposits
- Customer uses shell companies with no clear purpose

### 7.2 SAR Filing Process

**Timeline:**
- **30 calendar days** from detection of suspicious activity
- **60 calendar days** if no suspect identified

**SAR Filing Steps:**
1. **Identify** suspicious activity
2. **Investigate** and gather facts
3. **Document** findings
4. **Prepare** SAR (FinCEN Form 111)
5. **Obtain** approval from senior management
6. **File** electronically via BSA E-Filing System
7. **Retain** copy for 5 years

**SAR Contents:**
- Subject information (name, address, ID)
- Suspicious activity description
- Dates of activity
- Amounts involved
- Supporting documentation
- Institution's role
- Action taken (account closed, etc.)

### 7.3 SAR Template

```
SUSPICIOUS ACTIVITY REPORT

Part I: Subject Information
Name: _______________
Address: _______________
Date of Birth: _______________
SSN/TIN: _______________
Account Number: _______________

Part II: Suspicious Activity Information
Date(s) of Activity: _______________
Total Dollar Amount: $ _______________

Part III: Description of Suspicious Activity
[Provide detailed narrative including:
- What happened
- When it happened
- Who was involved
- Why it's suspicious
- What you did about it]

Part IV: Supporting Documentation
[ ] Transaction records
[ ] Account statements
[ ] Correspondence
[ ] Internal investigation report
[ ] Other: _______________

Part V: Law Enforcement Contact
Law enforcement contacted? [ ] Yes [ ] No
If yes, agency: _______________
Contact name: _______________
Date contacted: _______________

Prepared by: _______________ Date: _______________
Reviewed by: _______________ Date: _______________
Approved by: _______________ Date: _______________

Filed via FinCEN BSA E-Filing: _______________
```

### 7.4 SAR Confidentiality

**Strict Confidentiality:**
- DO NOT disclose SAR to subject
- DO NOT disclose that SAR was filed
- Limited disclosure to:
  - FinCEN
  - Federal/state law enforcement
  - Federal regulatory authority
  - Self-regulatory organization
  - Foreign branch/affiliate (with safeguards)

**Criminal Penalties:**
- Unauthorized disclosure = up to 5 years prison + fine

### 7.5 SAR Continuing Activity

**If Suspicious Activity Continues:**
- File new SAR every 90 days
- Reference original SAR number
- Describe continuing activity
- Continue until activity ceases or account closed

## 8. Currency Transaction Reports (CTR)

### 8.1 When to File CTR

**Mandatory Filing:**
- Cash transactions > $10,000
- In one business day
- By one person
- Includes multiple transactions if aggregated

**Note:** As a fintech company, we typically don't handle cash directly. If we add cash deposit features, CTR requirements would apply.

### 8.2 CTR vs. SAR

| Report | Threshold | Purpose | Suspicious? |
|--------|-----------|---------|------------|
| CTR | >$10,000 cash | Report large cash | Not necessarily |
| SAR | ≥$5,000 | Report suspicious activity | Yes |

**Can File Both:**
- If large cash transaction is also suspicious, file both CTR and SAR

## 9. Sanctions Screening

### 9.1 Sanctions Lists

**Lists Checked:**

| List | Issuer | Purpose |
|------|--------|---------|
| OFAC SDN | US Treasury | Blocked persons/entities |
| OFAC Sectoral Sanctions | US Treasury | Restricted sectors |
| UN Sanctions | United Nations | Global sanctions |
| EU Sanctions | European Union | EU sanctions |
| UK Sanctions | UK Treasury | UK sanctions |
| PEP Lists | Various | Politically exposed persons |

### 9.2 Screening Process

**When to Screen:**
- Customer onboarding
- Daily batch screening of all customers
- Before each transaction (real-time)
- After sanctions list updates

**Screening Algorithm:**
```javascript
// Comprehensive sanctions screening
async function screenAgainstSanctions(entity) {
  // Normalize name for better matching
  const normalizedName = normalizeName(entity.name);

  // Check against multiple lists
  const checks = await Promise.all([
    checkOFAC_SDN(normalizedName, entity.dob, entity.country),
    checkUN_Sanctions(normalizedName, entity.country),
    checkEU_Sanctions(normalizedName, entity.country),
    checkUK_Sanctions(normalizedName, entity.country)
  ]);

  // Fuzzy matching with confidence scores
  const matches = checks.flatMap(check => check.matches || []);

  // Filter by confidence threshold
  const significantMatches = matches.filter(m => m.confidence > 0.85);

  if (significantMatches.length > 0) {
    // Potential sanctions hit
    return {
      match: true,
      list: significantMatches[0].list,
      name: significantMatches[0].name,
      confidence: significantMatches[0].confidence,
      details: significantMatches[0].details,
      action: 'block_and_investigate'
    };
  }

  // Weak matches require manual review
  const weakMatches = matches.filter(m =>
    m.confidence > 0.70 && m.confidence <= 0.85
  );

  if (weakMatches.length > 0) {
    return {
      match: 'possible',
      matches: weakMatches,
      action: 'manual_review_required'
    };
  }

  return {
    match: false,
    action: 'proceed'
  };
}
```

### 9.3 Sanctions Hit Procedures

**If Sanctions Match:**
1. **IMMEDIATE:** Block transaction/account
2. **Within 1 hour:** Notify Compliance Officer
3. **Within 24 hours:** Complete investigation
4. **Determine:** True positive vs. false positive
5. **If true positive:**
   - Reject transaction
   - Freeze assets
   - File OFAC report (within 10 days)
   - Close account
6. **If false positive:**
   - Document why it's false positive
   - Unblock account
   - Process transaction

**Documentation Required:**
- Screening results
- Investigation steps
- Decision rationale
- Approver signature
- Date/time of all actions

## 10. Record Keeping

### 10.1 Retention Requirements

| Record Type | Retention Period | Regulatory Basis |
|-------------|-----------------|------------------|
| CIP records | 5 years after account closure | USA PATRIOT Act |
| CDD documentation | 5 years after account closure | FinCEN |
| EDD documentation | 5 years after account closure | FinCEN |
| Transaction records | 5 years after transaction | BSA |
| SAR and supporting docs | 5 years after filing | BSA |
| CTR and supporting docs | 5 years after filing | BSA |
| Sanctions screening | 5 years | OFAC |
| Training records | 5 years | BSA |
| Independent testing | 5 years | BSA |

**Our Policy:**
- Retain AML records for **7 years** (exceeds regulatory minimum, aligns with SOX)

### 10.2 Record Organization

**Filing System:**
```
/compliance/aml/
  /customer-records/
    /[customer-id]/
      /identification/
        - passport_scan.pdf
        - proof_of_address.pdf
        - verification_report.pdf
      /due-diligence/
        - cdd_questionnaire.pdf
        - edd_documentation.pdf (if applicable)
        - beneficial_ownership.pdf
      /monitoring/
        - transaction_monitoring_alerts.pdf
        - investigation_reports.pdf
      /periodic-reviews/
        - 2025_annual_review.pdf
  /sar-filings/
    - SAR_2025_001.pdf
    - SAR_2025_002.pdf
  /training/
    - training_attendance_2025.pdf
  /testing/
    - independent_testing_2025.pdf
```

### 10.3 Electronic Record Requirements

**Must Be:**
- Easily retrievable
- Searchable
- Reproducible (can print clear copy)
- Protected from alteration
- Backed up
- Access-controlled

## 11. Training Program

### 11.1 Training Requirements

**Who Must Be Trained:**
- All employees
- Officers and directors
- Contractors with customer contact
- Third-party agents

**Training Frequency:**
- Initial: Within 30 days of hire
- Annual: Every 12 months
- Ad-hoc: When regulations change

### 11.2 Training Content

**General AML Training (All Employees):**
- AML/KYC overview and importance
- Red flags and suspicious activity
- Reporting procedures
- Consequences of violations
- **Duration:** 2 hours

**Advanced AML Training (Compliance Staff):**
- Detailed regulations (BSA, PATRIOT Act)
- CIP/CDD/EDD procedures
- SAR/CTR filing
- Sanctions screening
- Investigation techniques
- **Duration:** 8 hours

**Role-Specific Training:**

**Customer Support:**
- Identifying red flags
- Escalation procedures
- What NOT to tell customers
- **Duration:** 1 hour

**Finance/Accounting:**
- Transaction monitoring
- Recordkeeping requirements
- CTR filing (if applicable)
- **Duration:** 2 hours

### 11.3 Training Documentation

**Records to Maintain:**
- Training date
- Training content/topics
- Trainer name
- Attendees (names, signatures)
- Test results (if applicable)
- Training materials

**Training Certification:**
```
AML TRAINING CERTIFICATION

Employee Name: _______________
Employee ID: _______________
Training Date: _______________
Training Topic: AML/KYC Fundamentals
Duration: 2 hours
Trainer: _______________

Topics Covered:
[ ] AML regulations overview
[ ] Customer identification requirements
[ ] Red flags and suspicious activity
[ ] Reporting procedures (SAR)
[ ] Sanctions screening
[ ] Record keeping
[ ] Confidentiality

Test Score: _____% (80% required to pass)

Employee Signature: _______________ Date: _______________
Trainer Signature: _______________ Date: _______________
```

## 12. Independent Testing

### 12.1 Testing Requirements

**Frequency:** Annually (minimum)

**Who Conducts:**
- Independent third party, OR
- Internal audit (if independent from AML function)

**Scope:**
- Adequacy of AML program
- Effectiveness of CIP
- CDD/EDD procedures
- Transaction monitoring
- SAR filing process
- Training program
- Record keeping
- Systems and controls

### 12.2 Testing Procedures

**Sample Testing:**
- CIP: 25 new accounts
- CDD: 25 existing accounts
- EDD: 100% of EDD accounts
- Transaction monitoring: 50 alerts
- SAR decisions: 100% of SARs
- Sanctions screening: Daily batch samples

**Testing Checklist:**
```
INDEPENDENT AML TESTING CHECKLIST

1. WRITTEN AML PROGRAM
   [ ] Program approved by board/senior management
   [ ] Program includes all required elements
   [ ] Program updated within last 12 months

2. AML COMPLIANCE OFFICER
   [ ] Officer designated
   [ ] Officer has adequate authority
   [ ] Officer has adequate resources

3. CUSTOMER IDENTIFICATION PROGRAM
   [ ] CIP procedures documented
   [ ] ID verification performed timely
   [ ] Documentation retained
   [ ] Sample testing (25 accounts): ___% compliant

4. CUSTOMER DUE DILIGENCE
   [ ] CDD procedures documented
   [ ] Risk rating methodology defined
   [ ] Beneficial ownership identified
   [ ] Sample testing (25 accounts): ___% compliant

5. ENHANCED DUE DILIGENCE
   [ ] EDD triggers defined
   [ ] EDD procedures documented
   [ ] Senior management approval obtained
   [ ] Sample testing (all EDD accounts): ___% compliant

6. TRANSACTION MONITORING
   [ ] Monitoring system implemented
   [ ] Red flags defined
   [ ] Alerts investigated timely
   [ ] Sample testing (50 alerts): ___% compliant

7. SUSPICIOUS ACTIVITY REPORTING
   [ ] SAR procedures documented
   [ ] SARs filed timely
   [ ] SAR confidentiality maintained
   [ ] Sample testing (all SARs): ___% compliant

8. SANCTIONS SCREENING
   [ ] Screening performed at onboarding
   [ ] Ongoing screening performed
   [ ] Screening includes all relevant lists
   [ ] Hits investigated and documented

9. TRAINING
   [ ] Training program documented
   [ ] All staff trained annually
   [ ] Training records maintained
   [ ] Attendance rate: ___%

10. RECORD KEEPING
    [ ] Records retained per requirements
    [ ] Records easily retrievable
    [ ] Records properly organized

OVERALL RATING: [ ] Satisfactory [ ] Needs Improvement [ ] Unsatisfactory

Tested by: _______________ Date: _______________
```

### 12.3 Remediation

**If Deficiencies Found:**
1. Document deficiency
2. Determine root cause
3. Develop remediation plan (30/60/90 day)
4. Assign responsibility
5. Implement corrective actions
6. Retest effectiveness
7. Report to senior management

## 13. AML Compliance Officer

### 13.1 Designation

**Requirements:**
- Designated in writing
- Has authority to implement AML program
- Has adequate resources
- Reports to senior management

**Responsibilities:**
- Oversee AML program
- Ensure compliance with regulations
- Coordinate CIP/CDD/EDD
- Review transaction monitoring alerts
- SAR decision-making
- Coordinate with law enforcement
- Manage AML training
- Coordinate independent testing
- Report to board/senior management

### 13.2 Contact Information

```
AML COMPLIANCE OFFICER

Name: [Name]
Title: Chief Compliance Officer
Email: aml@company.com
Phone: [Phone]
Address: [Company Address]

Available for:
- Suspicious activity reports
- AML questions and guidance
- Regulatory inquiries
- Law enforcement requests
```

## 14. Geographic Risk Assessment

### 14.1 High-Risk Jurisdictions

**FATF Blacklist (High Risk):**
- Countries with strategic AML deficiencies
- Subject to call for counter-measures
- **Current examples:** Iran, North Korea

**FATF Greylist (Increased Monitoring):**
- Countries with AML deficiencies
- Committed to addressing deficiencies
- Subject to enhanced due diligence
- **Current examples:** Check current FATF list

**Other High-Risk Indicators:**
- Countries with high corruption index
- Countries with inadequate banking supervision
- Countries with terrorist activity
- Tax havens

### 14.2 Risk Rating by Country

| Country | Risk Level | EDD Required | Senior Approval |
|---------|-----------|--------------|----------------|
| USA, UK, EU | Low | No | No |
| Greylist countries | High | Yes | Yes |
| Blacklist countries | Prohibited | N/A | N/A |

## 15. Regulatory Reporting

### 15.1 Reports to File

| Report | Trigger | Deadline | Where to File |
|--------|---------|----------|---------------|
| SAR | Suspicious ≥$5,000 | 30 days | FinCEN BSA E-Filing |
| CTR | Cash >$10,000 | 15 days | FinCEN BSA E-Filing |
| OFAC Report | Sanctions violation | 10 days | OFAC |
| Form 8300 | Cash >$10,000 (trade/business) | 15 days | IRS |

### 15.2 Law Enforcement Requests

**Information Requests:**
- Respond within timeframe specified
- Provide all requested information
- Do NOT tip off customer
- Document request and response

**Subpoenas:**
- Review with legal counsel
- Gather requested information
- Respond by deadline
- Maintain confidentiality

## 16. Key Contacts

| Role | Name | Email | Phone |
|------|------|-------|-------|
| AML Compliance Officer | [Name] | aml@company.com | [Phone] |
| Chief Compliance Officer | [Name] | compliance@company.com | [Phone] |
| Legal Counsel | [Name] | legal@company.com | [Phone] |
| FinCEN (General) | - | frc@fincen.gov | 800-767-2825 |
| OFAC Hotline | - | ofac_feedback@treasury.gov | 800-540-6322 |

## 17. Document Control

### 17.1 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-05 | Compliance Team | Initial version |

### 17.2 Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Board of Directors | [Name] | ___________ | ______ |
| Chief Executive Officer | [Name] | ___________ | ______ |
| AML Compliance Officer | [Name] | ___________ | ______ |

---

**Document Classification:** INTERNAL - HIGHLY CONFIDENTIAL
**Next Review Date:** 2026-11-05

## Appendix A: Resources

- [FinCEN](https://www.fincen.gov/)
- [OFAC](https://www.treasury.gov/about/organizational-structure/offices/Pages/Office-of-Foreign-Assets-Control.aspx)
- [FATF](https://www.fatf-gafi.org/)
- [Bank Secrecy Act](https://www.fincen.gov/resources/statutes-regulations/bank-secrecy-act)

## Appendix B: Red Flags Reference

[Comprehensive list of money laundering red flags]

## Appendix C: SAR Filing Instructions

[Step-by-step instructions for filing SAR via BSA E-Filing System]
