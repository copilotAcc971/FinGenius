# How to Run Migrations

After deploying schema changes with `npm run db:push`, run these SQL migrations:

## Customer Zoho Backfill (001)

### Using psql (Production)
```bash
psql $DATABASE_URL -f migrations/001_customer_zoho_backfill.sql
```

### Using Replit execute_sql_tool (Development)
Execute the SQL statements from `migrations/001_customer_zoho_backfill.sql` using the execute_sql_tool in the Replit environment.

## Migration Workflow

1. **Update Schema**: Make changes to `shared/schema.ts`
2. **Push Schema**: Run `npm run db:push` to apply schema changes
3. **Run Data Migration**: Execute the SQL migration file to backfill existing data
4. **Verify**: Check that existing rows have proper defaults

## Notes

- Always test migrations in development before running in production
- Migrations should be idempotent (safe to run multiple times)
- Document all migrations in `DATABASE_MIGRATIONS.md`
