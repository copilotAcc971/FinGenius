# Data Retention Policy

**Version:** 1.0 | **Date:** 2025-11-05 | **Next Review:** 2026-11-05

## 1. Purpose

This policy establishes standardized procedures for retaining and disposing of company records in compliance with legal, regulatory, and business requirements.

## 2. Retention Schedule

### 2.1 Financial Records (7 Years - SOX/IRS)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| General ledger and journals | 7 years | Secure deletion |
| Financial statements | 7 years | Secure deletion |
| Bank statements | 7 years | Secure deletion |
| Invoices (A/R and A/P) | 7 years | Secure deletion |
| Tax returns and supporting docs | 7 years | Secure deletion |
| Payroll records | 7 years | Secure deletion |
| Audit reports | 7 years | Secure deletion |

### 2.2 Transaction Data (7 Years - SOX)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Payment transactions | 7 years | Secure deletion |
| Refund records | 7 years | Secure deletion |
| Transaction logs | 7 years | Archived, then deleted |
| Audit trails | 7 years | Archived, then deleted |

### 2.3 Customer Data (Account Lifetime + 30 Days)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Account information | Account lifetime + 30 days | Secure deletion |
| Profile data | Account lifetime + 30 days | Secure deletion |
| Preferences | Account lifetime + 30 days | Secure deletion |
| Support tickets | 3 years | Archived, then deleted |

**Exception:** If legal hold or regulatory retention applies, retain longer.

### 2.4 AML/KYC Records (7 Years After Account Closure)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Identity verification docs | 7 years after closure | Secure deletion |
| CDD/EDD documentation | 7 years after closure | Secure deletion |
| SAR records | 7 years after filing | Secure deletion |
| Transaction monitoring alerts | 7 years | Secure deletion |

### 2.5 Payment Data (PCI-DSS Compliant)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Payment tokens | Account lifetime | Immediate deletion on closure |
| Card metadata (last 4 digits) | 7 years | Secure deletion |
| Full card numbers | NEVER STORED | N/A |
| CVV/CVC | NEVER STORED | N/A |

### 2.6 Logs and Monitoring (Varies)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Security logs | 7 years | Archived, then deleted |
| Audit logs | 7 years | Archived, then deleted |
| Application logs | 90 days | Auto-delete |
| Web server logs | 30 days | Auto-delete |
| Error logs | 90 days | Auto-delete |

### 2.7 Employee Records (7 Years After Termination)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Personnel files | 7 years after termination | Secure deletion |
| Training records | 7 years | Secure deletion |
| Performance reviews | 7 years after termination | Secure deletion |
| Payroll records | 7 years | Secure deletion |

### 2.8 Legal and Compliance (Permanent or 7 Years)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Incorporation documents | Permanent | N/A |
| Board meeting minutes | Permanent | N/A |
| Material contracts | 7 years after expiration | Secure deletion |
| Insurance policies | 7 years after expiration | Secure deletion |
| Litigation records | 7 years after resolution | Secure deletion |

### 2.9 Backups (90 Days)

| Record Type | Retention Period | Destruction Method |
|-------------|-----------------|-------------------|
| Database backups | 90 days | Auto-delete |
| System backups | 90 days | Auto-delete |
| Archived data | Per record type | Secure deletion |

## 3. Data Destruction

### 3.1 Secure Deletion Methods

**Digital Data:**
- Cryptographic erasure (delete encryption keys)
- DOD 5220.22-M wiping (7-pass overwrite)
- Physical destruction of storage media (if decommissioning)

**Physical Documents:**
- Cross-cut shredding (minimum)
- Certificate of destruction (for sensitive docs)

### 3.2 Automated Deletion

```javascript
// Daily cron job for automated deletion
async function deleteExpiredData() {
  const now = new Date();

  // Delete expired user data (30 days after account deletion)
  await db.users.destroy({
    where: {
      deleted_at: { $lt: new Date(now - 30 * 24 * 60 * 60 * 1000) }
    }
  });

  // Delete old logs
  await db.application_logs.destroy({
    where: {
      created_at: { $lt: new Date(now - 90 * 24 * 60 * 60 * 1000) }
    }
  });

  // Archive financial records older than 7 years to cold storage
  const sevenYearsAgo = new Date(now - 7 * 365 * 24 * 60 * 60 * 1000);
  await archiveOldFinancialRecords(sevenYearsAgo);
}
```

## 4. Legal Hold

### 4.1 When Legal Hold Applies

- Litigation filed or anticipated
- Government investigation
- Audit or regulatory inquiry
- Subpoena or court order

### 4.2 Legal Hold Process

1. Legal counsel issues hold notice
2. Suspend automated deletion for affected data
3. Preserve all relevant data
4. Notify custodians (data owners)
5. Monitor compliance with hold
6. Release hold only when authorized by legal

## 5. Compliance

### 5.1 Regulatory Requirements Met

- ✓ SOX Section 802: 7-year retention
- ✓ IRS: 7-year retention for tax records
- ✓ GDPR: Delete upon request (with legal hold exception)
- ✓ PCI-DSS: Minimize payment data retention
- ✓ AML: 5-7 year retention for CIP/CDD/SAR

### 5.2 Review Schedule

- Quarterly: Review automated deletion logs
- Annually: Review retention schedule for updates
- As needed: Update for regulatory changes

## 6. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Legal Counsel | Determine retention requirements |
| Compliance Officer | Ensure policy compliance |
| IT Department | Implement automated deletion |
| Records Manager | Coordinate retention/destruction |
| Department Heads | Ensure team compliance |

## 7. Exceptions

Exceptions to this policy require approval from:
- Legal Counsel (for legal reasons)
- Compliance Officer (for regulatory reasons)
- CEO (for business reasons)

All exceptions must be documented.

---

**Approved by:** [Legal Counsel] | [Compliance Officer] | [CEO]
**Date:** _____________

## Appendix: Quick Reference

**Most Common Retention Periods:**
- Financial records: 7 years
- Customer data: Account lifetime + 30 days
- AML/KYC: 7 years after closure
- Logs: 30-90 days
- Audit logs: 7 years
