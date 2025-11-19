# Audit Preparation Checklist

**Version:** 1.0 | **Date:** 2025-11-05 | **Audit Type:** Comprehensive Compliance

## 1. Pre-Audit Preparation (30 Days Before)

### 1.1 Organizational Preparation

```
[ ] Audit notification received and confirmed
[ ] Audit scope and objectives understood
[ ] Audit team lead designated
[ ] Internal coordination meeting held
[ ] Document request list received
[ ] Document collection plan created
[ ] War room/workspace designated
[ ] Access credentials prepared
[ ] NDA signed (if external auditor)
[ ] Audit schedule coordinated
```

### 1.2 Team Assembly

```
[ ] Point of contact designated for each area:
    [ ] Financial/Accounting
    [ ] IT/Security
    [ ] Compliance/Legal
    [ ] Operations
    [ ] HR

[ ] Team availability confirmed
[ ] Backup contacts identified
[ ] Communication protocol established
```

## 2. Documentation Checklist

### 2.1 Corporate Documents

```
[ ] Certificate of Incorporation
[ ] Articles of Association/Bylaws
[ ] Board meeting minutes (last 2 years)
[ ] Organizational chart
[ ] Business licenses
[ ] Insurance policies
[ ] Material contracts
```

### 2.2 Financial Documents

```
SOX COMPLIANCE:
[ ] Financial statements (last 3 years)
[ ] General ledger and sub-ledgers
[ ] Trial balances
[ ] Bank statements and reconciliations
[ ] Accounts receivable aging report
[ ] Accounts payable aging report
[ ] Journal entry listing (with explanations)
[ ] Revenue recognition documentation
[ ] Expense supporting documentation
[ ] Tax returns (last 3 years)
[ ] Audit reports (previous years)
```

### 2.3 Internal Controls Documentation

```
[ ] Internal control framework (COSO)
[ ] Control descriptions and objectives
[ ] Control testing results
[ ] Segregation of duties matrix
[ ] Approval workflows documentation
[ ] Change management procedures
[ ] Access control policies
[ ] Control deficiency log and remediation
[ ] Management representation letter
```

### 2.4 IT General Controls (ITGC)

```
[ ] IT policies and procedures
[ ] Change management logs (last year)
[ ] Change approval records
[ ] User access reviews (quarterly)
[ ] Privileged account list
[ ] Password policy
[ ] Backup and recovery procedures
[ ] Disaster recovery plan
[ ] DR test results (last year)
[ ] System architecture diagram
[ ] Network diagram
[ ] Database schema documentation
```

### 2.5 Information Security

```
PCI-DSS:
[ ] SAQ A completion
[ ] Attestation of Compliance
[ ] Quarterly vulnerability scans (last 4)
[ ] Penetration test report (annual)
[ ] Stripe PCI compliance certificate
[ ] Network segmentation documentation
[ ] Cardholder data flow diagram
[ ] Security incident log
[ ] Security awareness training records

GENERAL SECURITY:
[ ] Information security policy
[ ] Risk assessment (annual)
[ ] Security incident response plan
[ ] Business continuity plan
[ ] Vendor security assessments
[ ] Third-party DPAs
```

### 2.6 Data Privacy (GDPR/Privacy)

```
[ ] Privacy policy (current version)
[ ] Cookie policy
[ ] Data Processing Agreements (all processors)
[ ] Data Protection Impact Assessments
[ ] Records of processing activities
[ ] Data subject request log (access, deletion, etc.)
[ ] Data breach register
[ ] Consent management records
[ ] International data transfer documentation (SCCs)
[ ] Data retention policy
[ ] Employee privacy training records
```

### 2.7 AML/KYC Compliance

```
[ ] AML program document
[ ] AML Compliance Officer designation
[ ] Customer identification procedures (CIP)
[ ] Customer due diligence (CDD) procedures
[ ] Enhanced due diligence (EDD) procedures
[ ] Beneficial ownership records
[ ] PEP screening results
[ ] Sanctions screening procedures
[ ] Sanctions screening logs
[ ] Transaction monitoring procedures
[ ] SAR filing records (sanitized)
[ ] AML training materials
[ ] AML training attendance records
[ ] Independent AML testing report (annual)
[ ] Risk assessment (annual)
```

### 2.8 Payment Processing (PSD2)

```
[ ] Strong Customer Authentication (SCA) procedures
[ ] SCA implementation documentation
[ ] 3D Secure compliance evidence
[ ] Exemption management procedures
[ ] Transaction monitoring for SCA compliance
[ ] Stripe integration documentation
[ ] Payment flow diagrams
```

### 2.9 HR and Personnel

```
[ ] Employee handbook
[ ] Code of conduct
[ ] Whistleblower policy
[ ] Background check procedures
[ ] Employee training records:
    [ ] Security awareness training
    [ ] AML training
    [ ] GDPR training
    [ ] Code of conduct acknowledgment
[ ] Confidentiality agreements
[ ] Access termination procedures
```

### 2.10 Vendor Management

```
[ ] Vendor list (all vendors)
[ ] Critical vendor identification
[ ] Vendor risk assessments
[ ] Vendor due diligence documentation
[ ] Vendor contracts
[ ] Data Processing Agreements
[ ] Vendor security certifications (SOC 2, ISO 27001)
[ ] Vendor monitoring procedures
[ ] Vendor performance reviews
```

### 2.11 Operational Procedures

```
[ ] Standard Operating Procedures (SOPs):
    [ ] Customer onboarding
    [ ] Payment processing
    [ ] Refund processing
    [ ] Account closure
    [ ] Incident response
    [ ] Change management
    [ ] Backup and recovery
[ ] Key process flowcharts
```

## 3. System Access Preparation

### 3.1 Read-Only Access Setup

```
[ ] Create read-only audit user accounts:
    [ ] Production database
    [ ] Application logs
    [ ] Audit logs
    [ ] Source code repository
    [ ] Cloud infrastructure (AWS/Vercel)
    [ ] Monitoring tools (Sentry, DataDog)

[ ] Document access credentials (secure)
[ ] Verify read-only permissions
[ ] Test access before audit
[ ] Prepare access revocation procedure
```

### 3.2 Demo Environment

```
[ ] Prepare demo environment (non-prod)
[ ] Load sample data (anonymized)
[ ] Test all features auditors will review
[ ] Document differences from production
```

## 4. Evidence Preparation

### 4.1 Sample Selections

Prepare samples for auditor testing:

```
FINANCIAL:
[ ] 25 random transactions (sales)
[ ] 25 random transactions (purchases)
[ ] 25 journal entries
[ ] All manual journal entries (if < 25)
[ ] 12 months of reconciliations

ACCESS CONTROLS:
[ ] User access review (quarterly - last 4)
[ ] New user access requests (25 samples)
[ ] Terminated user access removal (all)
[ ] Privileged access review (all accounts)

CHANGE MANAGEMENT:
[ ] 25 production changes (with approvals)
[ ] Emergency changes (all)
[ ] Financial system changes (all)

AML/KYC:
[ ] 25 new customer onboardings
[ ] 10 enhanced due diligence cases
[ ] All SAR filings
[ ] Sanctions screening samples (25 days)
```

### 4.2 Evidence Organization

```
[ ] Create folder structure per PBC list
[ ] Ensure consistent naming convention
[ ] Ensure documents are current versions
[ ] Redact confidential information (if needed)
[ ] Create evidence index/tracker
[ ] Number all documents
[ ] Prepare evidence upload portal access
```

## 5. Pre-Audit Testing

### 5.1 Internal Control Testing

```
[ ] Execute control testing (before auditor)
[ ] Identify any control gaps
[ ] Remediate issues found
[ ] Document remediation
[ ] Retest controls
```

### 5.2 Mock Audit

```
[ ] Conduct internal mock audit (if time permits)
[ ] Test PBC list completeness
[ ] Practice audit interviews
[ ] Identify knowledge gaps
[ ] Address findings before actual audit
```

## 6. Personnel Preparation

### 6.1 Key Personnel Briefing

```
[ ] Brief all personnel who will be interviewed
[ ] Provide audit overview and objectives
[ ] Explain do's and don'ts:
    ✓ DO: Be honest and direct
    ✓ DO: Say "I don't know" if you don't know
    ✓ DO: Take notes during interviews
    ✗ DON'T: Speculate or guess
    ✗ DON'T: Volunteer information not asked
    ✗ DON'T: Be defensive

[ ] Provide contact protocol (all through audit lead)
[ ] Ensure availability during audit period
```

### 6.2 Interview Schedule

```
[ ] Prepare interview list:
    [ ] CEO (overall business, strategy)
    [ ] CFO (financial controls, reporting)
    [ ] CTO (IT controls, security)
    [ ] Compliance Officer (AML, GDPR, policies)
    [ ] Controller (accounting procedures)
    [ ] IT Manager (infrastructure, access)
    [ ] HR Manager (personnel, training)

[ ] Coordinate schedules
[ ] Book conference rooms
[ ] Prepare interview guides
```

## 7. Specific Audit Areas

### 7.1 SOX Compliance Audit

```
[ ] Financial statement accuracy evidence
[ ] Control documentation (all controls)
[ ] Control testing evidence (quarterly)
[ ] Segregation of duties matrix
[ ] IT general controls evidence
[ ] Management representation letter
[ ] Significant deficiency log and remediation
[ ] Section 302 certifications (quarterly)
[ ] Section 404 management assessment (annual)
```

### 7.2 PCI-DSS Audit

```
[ ] SAQ A completion
[ ] Network diagram (showing cardholder data flow)
[ ] Stripe compliance certificate
[ ] Quarterly vulnerability scans (last 4)
[ ] Penetration test (annual)
[ ] Security policies
[ ] Incident response plan
[ ] Security awareness training evidence
[ ] No cardholder data stored evidence
```

### 7.3 GDPR Audit

```
[ ] Privacy policy
[ ] All DPAs (Data Processing Agreements)
[ ] Records of processing activities
[ ] Data subject request handling (samples)
[ ] Breach notification procedures
[ ] DPIA (Data Protection Impact Assessment)
[ ] Consent management system evidence
[ ] International transfer mechanisms (SCCs)
[ ] Data retention policy and enforcement
[ ] Employee training records
```

### 7.4 AML Audit

```
[ ] AML program document
[ ] CIP/CDD/EDD procedures
[ ] Customer risk ratings
[ ] Beneficial ownership documentation
[ ] Transaction monitoring alerts and investigations
[ ] SAR filings (sanitized)
[ ] Sanctions screening evidence
[ ] Training records
[ ] Independent testing report
```

## 8. Audit Execution Phase

### 8.1 During Audit

```
[ ] Daily coordination meeting with audit team
[ ] Log all requests and responses
[ ] Track status of all deliverables
[ ] Maintain response timeline
[ ] Escalate blockers immediately
[ ] Document all verbal responses in writing
[ ] Prepare management responses to findings
```

### 8.2 Request Tracking

```
Maintain tracker with columns:
- Request #
- Date received
- Description
- Assigned to
- Due date
- Status (Pending / In Progress / Submitted)
- Date submitted
- Auditor feedback
- Follow-up required
```

## 9. Post-Audit

### 9.1 Findings Review

```
[ ] Review preliminary findings
[ ] Prepare management responses
[ ] Provide additional evidence if needed
[ ] Request clarification on unclear findings
[ ] Negotiate findings (if appropriate)
```

### 9.2 Remediation Planning

```
For each finding:
[ ] Assess severity
[ ] Determine root cause
[ ] Develop remediation plan
[ ] Assign ownership
[ ] Set deadlines (30/60/90 day)
[ ] Obtain senior management approval
[ ] Communicate plan to auditor
```

### 9.3 Final Report

```
[ ] Review draft audit report
[ ] Verify factual accuracy
[ ] Review management responses
[ ] Obtain sign-off from management
[ ] Distribute final report to stakeholders
```

### 9.4 Lessons Learned

```
[ ] Conduct internal post-audit review
[ ] Document what went well
[ ] Document areas for improvement
[ ] Update procedures for next audit
[ ] Archive audit materials
```

## 10. Continuous Audit Readiness

### 10.1 Ongoing Maintenance

```
MONTHLY:
[ ] Review control testing results
[ ] Update documentation for changes
[ ] File new contracts and agreements
[ ] Update vendor list

QUARTERLY:
[ ] Review and test key controls
[ ] Update risk assessment (if changes)
[ ] Review compliance with policies
[ ] Update audit readiness tracker

ANNUALLY:
[ ] Update all policies
[ ] Conduct risk assessment
[ ] Refresh documentation
[ ] Conduct internal audit
[ ] Training renewal
```

### 10.2 Document Control

```
[ ] Version control for all policies
[ ] Approval workflow for policy changes
[ ] Centralized document repository
[ ] Access controls on sensitive documents
[ ] Regular document review schedule
[ ] Archival process for old versions
```

## 11. Common Auditor Questions

Be prepared to answer:

### 11.1 General Business

```
- What does your company do?
- Who are your customers?
- What is your revenue model?
- What are your growth plans?
- What are your main business risks?
```

### 11.2 Financial Controls

```
- How do you ensure accurate financial reporting?
- Who can approve transactions and at what levels?
- How do you prevent unauthorized transactions?
- How do you ensure segregation of duties?
- How do you detect errors in financial reporting?
```

### 11.3 IT Security

```
- How do you protect customer data?
- Who has access to production systems?
- How do you manage privileged accounts?
- How do you ensure secure software development?
- How do you respond to security incidents?
```

### 11.4 Data Privacy

```
- How do you obtain user consent?
- How do you handle data subject requests?
- How do you protect personal data?
- Who are your data processors?
- How do you handle data breaches?
```

### 11.5 AML Compliance

```
- How do you verify customer identity?
- How do you identify beneficial owners?
- How do you detect suspicious activity?
- How do you handle high-risk customers?
- How do you screen for sanctions?
```

## 12. Red Flags to Avoid

Auditors will look for these issues:

```
✗ Missing documentation
✗ Incomplete documentation
✗ Outdated policies
✗ Controls not operating as designed
✗ Lack of segregation of duties
✗ Excessive administrative access
✗ Unapproved changes to production
✗ Missing approvals
✗ Lack of monitoring/review
✗ Gaps in audit trails
✗ Inconsistent data between systems
✗ Missing training records
✗ Unresolved prior audit findings
```

## 13. Audit Survival Tips

```
✓ Be organized - have documents ready
✓ Be responsive - meet all deadlines
✓ Be honest - don't hide problems
✓ Be professional - treat auditors as partners
✓ Be prepared - anticipate questions
✓ Keep good records throughout the year
✓ Communicate proactively
✓ Don't take findings personally
✓ Use findings to improve
✓ Start preparing early (not just before audit)
```

## 14. Quick Reference Contacts

| Area | Contact | Email | Phone |
|------|---------|-------|-------|
| Financial | CFO/Controller | [Email] | [Phone] |
| IT/Security | CTO/CISO | [Email] | [Phone] |
| Compliance | Compliance Officer | [Email] | [Phone] |
| Legal | General Counsel | [Email] | [Phone] |
| HR | HR Manager | [Email] | [Phone] |
| Audit Coordinator | [Name] | [Email] | [Phone] |

---

**Document Owner:** Compliance Officer
**Last Updated:** 2025-11-05
**Next Update:** Before next audit

## Appendix: PBC List Template

[Standard Provided by Client (PBC) request list template]

## Appendix: Evidence Tracker Template

[Excel template for tracking evidence requests and submissions]
