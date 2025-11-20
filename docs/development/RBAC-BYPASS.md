# RBAC Development Bypass

## Quick Start

To **disable RBAC checks** during development and speed up the application:

### Option 1: Environment Variable (Recommended)
Add to your `.env` file:
```bash
DISABLE_RBAC_CHECKS=true
```

### Option 2: Inline Export
```bash
export DISABLE_RBAC_CHECKS=true && npm run dev
```

## What This Does

When `DISABLE_RBAC_CHECKS=true`:
- ✅ **All users have full permissions** - No permission checks
- ✅ **Faster startup** - Skips RBAC seeding (saves ~5-10 seconds)
- ✅ **No database queries** - RBAC tables not queried
- ✅ **AI Copilot works instantly** - All functions available to all users

## When to Use

**Use bypass mode (`true`) when:**
- Rapid prototyping and feature development
- Testing UI/UX without permission barriers
- Debugging non-security features
- Building new accounting modules

**Disable bypass (`false` or unset) when:**
- Testing role-based access control
- Preparing for production deployment
- Testing multi-tenant isolation
- Security testing and validation

## How It Works

The bypass is implemented at the lowest level:
- `RBACService.hasPermission()` returns `true` immediately
- Permission seeding is skipped entirely
- All AI Copilot functions are accessible
- Database remains unchanged (RBAC tables still exist)

## Production Safety

⚠️ **Production behavior**: The bypass flag is **NEVER enabled** in production environments. The flag only works when explicitly set by developers.

Default behavior (production):
```bash
# No env var = RBAC enabled
DISABLE_RBAC_CHECKS=false  # Explicitly disabled
```

## Example Usage

### Development (Fast)
```bash
# In .env
DISABLE_RBAC_CHECKS=true

# Server starts in ~2 seconds
# All users can do everything
```

### Testing RBAC (Secure)
```bash
# In .env
DISABLE_RBAC_CHECKS=false

# Server starts in ~8 seconds (seeds 191 permissions × 47 tenants)
# Users restricted by their roles
```

## Visual Indicators

When bypass is enabled, you'll see:
```
⚠️  ═══════════════════════════════════════════════════════════
⚠️  RBAC CHECKS DISABLED FOR DEVELOPMENT
⚠️  All users have full permissions
⚠️  Set DISABLE_RBAC_CHECKS=false to enable security
⚠️  ═══════════════════════════════════════════════════════════

[RBAC] Skipping permissions seeding (bypass mode)
```

When bypass is disabled (normal):
```
[RBAC] ✓ Security enabled - all permissions will be checked
[RBAC Seed] Seeding permissions...
[RBAC Init] Processing 47 tenants...
```

## Technical Details

### Files Modified
- `server/rbac/dev-bypass.ts` - Bypass logic
- `server/rbac/service.ts` - Permission checking with bypass
- `server/index.ts` - Conditional RBAC initialization

### Performance Impact
- **With bypass**: Server start ~2-3 seconds
- **Without bypass**: Server start ~7-10 seconds
- Difference: ~5-7 seconds saved per restart

### Database Impact
- Bypass does NOT modify database
- RBAC tables remain intact
- Switch between modes without data loss
- Safe for development databases
