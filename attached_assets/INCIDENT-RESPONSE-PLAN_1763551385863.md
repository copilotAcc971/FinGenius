# Incident Response Plan

**Version:** 1.0 | **Date:** 2025-11-05 | **Review:** Quarterly

## 1. Incident Classification

### 1.1 Severity Levels

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P1 - Critical** | Data breach, payment compromise, system down | Immediate | Database breach, ransomware |
| **P2 - High** | Security vulnerability exploited, major outage | 1 hour | SQL injection, DDoS attack |
| **P3 - Medium** | Suspicious activity, minor outage | 4 hours | Failed login attempts, malware |
| **P4 - Low** | Policy violation, no immediate risk | 24 hours | Unauthorized access attempt |

## 2. Incident Response Team

| Role | Name | Primary Phone | Email | Backup Contact |
|------|------|--------------|-------|----------------|
| **Incident Commander** | CTO | [Phone] | cto@company.com | Lead Engineer |
| **Security Lead** | CISO | [Phone] | security@company.com | Security Engineer |
| **Communications** | CMO | [Phone] | communications@company.com | CEO |
| **Legal** | General Counsel | [Phone] | legal@company.com | External Counsel |
| **Technical Lead** | Lead DevOps | [Phone] | devops@company.com | Senior Engineer |
| **Compliance** | Compliance Officer | [Phone] | compliance@company.com | CFO |

**24/7 Hotline:** [Emergency Phone Number]

## 3. Response Process

### 3.1 Phase 1: Detection & Reporting (0-15 minutes)

**Detection Sources:**
- Automated security alerts (Sentry, monitoring)
- User reports
- Third-party notifications
- Security scans

**Immediate Actions:**
1. Confirm incident is real (not false positive)
2. Document time of detection
3. Notify Incident Commander
4. Create incident ticket
5. Activate response team

**Initial Documentation:**
```
INCIDENT REPORT

Incident ID: INC-YYYY-MM-DD-####
Detection Time: [Timestamp]
Detected By: [Name/System]
Severity: [P1/P2/P3/P4]
Type: [Data Breach / System Outage / Security / Other]
Description: [Brief description]
Affected Systems: [List]
Estimated Impact: [Number of users/systems]
Status: ACTIVE
```

### 3.2 Phase 2: Classification & Containment (15-30 minutes)

**Classify Incident:**
- Determine severity (P1-P4)
- Identify incident type
- Assess scope and impact
- Determine if reportable (GDPR, PCI-DSS, etc.)

**Containment Actions:**

| Incident Type | Immediate Containment |
|--------------|---------------------|
| **Data Breach** | Isolate affected systems, revoke credentials, block IPs |
| **Malware/Ransomware** | Disconnect infected systems, block network propagation |
| **DDoS Attack** | Enable DDoS protection, rate limiting |
| **Compromised Account** | Force password reset, revoke sessions, enable MFA |
| **SQL Injection** | Disable affected endpoint, apply firewall rules |
| **System Outage** | Failover to backup, investigate root cause |

**P1 Critical Containment (Within 15 minutes):**
```bash
# Example: Data breach containment
1. Isolate affected database
   $ aws rds modify-db-instance --db-instance-identifier prod-db --no-publicly-accessible

2. Revoke all API keys
   $ ./scripts/revoke-all-keys.sh

3. Force all users to re-authenticate
   $ ./scripts/invalidate-sessions.sh

4. Block suspicious IP addresses
   $ ./scripts/block-ips.sh --ips-file malicious-ips.txt

5. Enable read-only mode (prevent further damage)
   $ ./scripts/enable-readonly-mode.sh
```

### 3.3 Phase 3: Investigation (30 minutes - 4 hours)

**Investigation Steps:**
1. **Timeline Reconstruction:**
   - When did breach occur?
   - How did attacker gain access?
   - What actions did attacker take?
   - What data was accessed/exfiltrated?

2. **Evidence Collection:**
   - System logs
   - Access logs
   - Network traffic logs
   - Database query logs
   - File system snapshots
   - Memory dumps (if malware)

3. **Impact Assessment:**
   - How many users affected?
   - What data was compromised?
   - What is the severity of exposure?
   - Are there ongoing threats?

4. **Root Cause Analysis:**
   - What vulnerability was exploited?
   - How could this have been prevented?
   - Are there similar vulnerabilities?

**Forensic Tools:**
```bash
# Collect logs for forensic analysis
$ ./scripts/collect-incident-logs.sh --incident-id INC-2025-11-05-0001 \
  --start-time "2025-11-05 00:00:00" \
  --end-time "2025-11-05 23:59:59"

# Analyze access patterns
$ ./scripts/analyze-access-logs.sh --suspicious-ips malicious-ips.txt

# Check for data exfiltration
$ ./scripts/check-data-transfer.sh --threshold 100MB
```

### 3.4 Phase 4: Eradication (4-12 hours)

**Remove Threat:**
- Patch vulnerabilities
- Remove malware/backdoors
- Delete unauthorized accounts
- Revoke compromised credentials
- Update firewall rules
- Apply security updates

**Verification:**
- Scan for remaining threats
- Verify patch effectiveness
- Test security controls
- Ensure no persistence mechanisms

### 3.5 Phase 5: Recovery (12-72 hours)

**Restore Normal Operations:**
1. Restore from clean backups (if needed)
2. Verify data integrity
3. Test system functionality
4. Gradually re-enable services
5. Monitor for recurrence
6. Communicate with users

**Recovery Checklist:**
```
[ ] Systems patched and secured
[ ] Backups verified and restored
[ ] All compromised credentials changed
[ ] Security controls tested
[ ] Monitoring enhanced
[ ] User access restored
[ ] Services operating normally
[ ] 24-hour monitoring active
```

### 3.6 Phase 6: Post-Incident Review (Within 7 days)

**Lessons Learned Meeting:**
- What happened?
- What went well?
- What went poorly?
- What should change?

**Deliverables:**
- Incident report (detailed)
- Timeline of events
- Impact assessment
- Root cause analysis
- Remediation actions taken
- Recommendations for improvement
- Policy/procedure updates

**Post-Incident Report Template:**
```
POST-INCIDENT REVIEW REPORT

Incident ID: INC-YYYY-MM-DD-####
Incident Date: [Date]
Review Date: [Date]
Attendees: [List]

EXECUTIVE SUMMARY:
[1-paragraph overview]

INCIDENT DETAILS:
- Type: [Data breach / Outage / etc.]
- Severity: [P1/P2/P3/P4]
- Detection: [How discovered]
- Duration: [Start to resolution]
- Impact: [Users affected, data compromised, downtime]

TIMELINE:
[Detailed timeline of events]

ROOT CAUSE:
[Technical explanation of how incident occurred]

RESPONSE EFFECTIVENESS:
What went well:
- [List positive aspects]

What needs improvement:
- [List areas for improvement]

REMEDIATION ACTIONS TAKEN:
1. [Action 1]
2. [Action 2]

RECOMMENDATIONS:
1. [Recommendation 1]
2. [Recommendation 2]

POLICY UPDATES:
- [Any policy changes needed]

TRAINING NEEDS:
- [Any training identified]

Prepared by: [Name]
Approved by: [Incident Commander]
Date: [Date]
```

## 4. Notification Procedures

### 4.1 Internal Notifications

**Immediate (P1/P2):**
- Incident Commander
- Security Lead
- CTO
- CEO

**Within 1 Hour (P1/P2):**
- Full incident response team
- Department heads
- Board of Directors (P1 only)

**Within 4 Hours (P3/P4):**
- Relevant department heads
- Compliance team

### 4.2 External Notifications

**Regulatory Authorities:**

| Authority | When to Notify | Timeline | Contact |
|-----------|---------------|----------|---------|
| **GDPR - Data Protection Authority** | Personal data breach (high risk) | 72 hours | [DPA contact] |
| **Stripe** | Payment data breach | Immediately | security@stripe.com |
| **Law Enforcement** | Criminal activity | Immediately | [Local contact] |
| **Cyber Insurance** | Covered incident | 24 hours | [Policy number] |

**Customer Notification:**

**When Required:**
- Personal data breached (GDPR)
- Payment data compromised (PCI-DSS)
- High risk to individuals

**Timeline:** Within 72 hours (GDPR requirement)

**Notification Template:**
```
Subject: Important Security Notice About Your [Company Name] Account

Dear [Customer Name],

We are writing to inform you of a security incident that may have
affected your personal information.

WHAT HAPPENED:
[Clear, non-technical explanation]

WHAT INFORMATION WAS INVOLVED:
[Specific data types]

WHAT WE ARE DOING:
[Steps taken to address incident]

WHAT YOU SHOULD DO:
1. Change your password immediately
2. Enable two-factor authentication
3. Monitor your account for suspicious activity
4. [Other specific actions]

We take the security of your information very seriously and
sincerely apologize for this incident.

For questions or assistance, please contact:
- Email: security@company.com
- Phone: [Support Number]

Sincerely,
[Name]
[Title]
[Company Name]

Incident Reference: INC-YYYY-MM-DD-####
```

## 5. Communication Protocols

### 5.1 Internal Communication

**Communication Channel:**
- Dedicated Slack channel: `#incident-response`
- Secure conference line: [Phone/Zoom]
- Encrypted email: Use PGP if available

**Communication Cadence:**
- P1: Every 30 minutes
- P2: Every 2 hours
- P3: Every 4 hours
- P4: Daily

### 5.2 External Communication

**Media Inquiries:**
- ALL media inquiries directed to CMO or CEO
- NO individual staff comments
- Use pre-approved talking points

**Customer Inquiries:**
- Centralized support response
- Consistent messaging
- No speculation
- Direct to dedicated webpage for updates

## 6. Specific Incident Playbooks

### 6.1 Data Breach Playbook

**Immediate Actions:**
1. Identify compromised systems (within 15 min)
2. Isolate affected systems (within 15 min)
3. Assess data exposure (within 1 hour)
4. Notify Stripe if payment data involved (immediately)
5. Preserve evidence (within 1 hour)
6. Engage forensic firm if needed (within 4 hours)

**Investigation:**
- What data was accessed?
- How many records?
- What individuals affected?
- Was data encrypted?
- Was data exfiltrated?

**Notification:**
- DPA notification if EU data (within 72 hours)
- Customer notification if high risk (within 72 hours)
- State notification if required by law
- Credit monitoring offer (if PII exposed)

### 6.2 Ransomware Playbook

**DO NOT PAY RANSOM (policy decision)**

**Immediate Actions:**
1. Disconnect infected systems from network
2. Identify ransomware variant
3. Assess backup integrity
4. Contact law enforcement (FBI Cyber Division)
5. Engage ransomware recovery firm

**Recovery:**
1. Wipe infected systems
2. Restore from clean backups
3. Patch vulnerabilities
4. Test restored systems
5. Implement additional controls

### 6.3 DDoS Attack Playbook

**Immediate Actions:**
1. Confirm attack (vs. legitimate traffic spike)
2. Enable DDoS mitigation (Cloudflare, AWS Shield)
3. Scale infrastructure (auto-scaling)
4. Rate limiting aggressive
5. Notify hosting provider

**Mitigation:**
- Identify attack vectors
- Block attack traffic
- Maintain service for legitimate users
- Monitor attack patterns

## 7. Tools and Resources

### 7.1 Incident Management Tools

- **Ticketing:** Jira / ServiceNow
- **Communication:** Slack / Microsoft Teams
- **Documentation:** Confluence / Google Docs
- **Forensics:** Log analysis tools
- **Monitoring:** Sentry, Datadog, CloudWatch

### 7.2 Evidence Collection

**Preserve:**
- System logs (before rotation)
- Database logs
- Network captures
- File system snapshots
- Memory dumps
- Cloud provider logs

**Chain of Custody:**
- Document who collected evidence
- When it was collected
- Where it's stored
- Who has accessed it

## 8. Testing and Training

### 8.1 Incident Response Drills

**Schedule:**
- Tabletop exercise: Quarterly
- Full simulation: Annually
- Phishing simulation: Monthly

**Scenarios to Test:**
- Data breach
- Ransomware attack
- DDoS attack
- Insider threat
- Supply chain compromise

### 8.2 Training Requirements

**All Staff:**
- Security awareness: Annual
- Incident reporting: Annual

**Incident Response Team:**
- IR procedures: Annual
- Forensics basics: Annual
- Communication protocols: Annual

## 9. Continuous Improvement

### 9.1 Metrics to Track

- Mean Time to Detect (MTTD)
- Mean Time to Respond (MTTR)
- Mean Time to Recover (MTTR)
- Number of incidents by severity
- False positive rate

### 9.2 Plan Updates

- After each major incident
- Quarterly review
- Annual comprehensive update
- When regulations change
- When infrastructure changes

## 10. Emergency Contacts

### 10.1 Internal Contacts

[See Section 2 - Incident Response Team]

### 10.2 External Contacts

| Organization | Contact | Phone | Email |
|-------------|---------|-------|-------|
| **Cyber Insurance** | [Provider] | [Phone] | [Email] |
| **Forensic Firm** | [Company] | [Phone] | [Email] |
| **Legal Counsel** | [Firm] | [Phone] | [Email] |
| **FBI Cyber Division** | Local field office | [Phone] | ic3.gov |
| **Stripe Security** | 24/7 | Support | security@stripe.com |

---

**Approved by:** [CTO] | [CISO] | [CEO]
**Next Test:** [Date]
**Next Review:** [Date]
