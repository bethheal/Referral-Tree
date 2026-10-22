-- Explicit least-privilege grants. SUPER_ADMIN is the only role with ROLE_MANAGE.
INSERT INTO "RolePermission" ("id", "role", "permission", "createdAt")
SELECT
  'seed-role-permission-' || lower(grant_row.role::text) || '-' || lower(grant_row.permission::text),
  grant_row.role::"Role",
  grant_row.permission::"AdminPermission",
  now()
FROM (VALUES
  ('SUPER_ADMIN', 'USER_READ'), ('SUPER_ADMIN', 'USER_MANAGE'), ('SUPER_ADMIN', 'ROLE_MANAGE'),
  ('SUPER_ADMIN', 'PRODUCT_READ'), ('SUPER_ADMIN', 'PRODUCT_MANAGE'), ('SUPER_ADMIN', 'ORDER_READ'),
  ('SUPER_ADMIN', 'ORDER_MANAGE'), ('SUPER_ADMIN', 'PAYMENT_READ'), ('SUPER_ADMIN', 'PAYMENT_RECONCILE'),
  ('SUPER_ADMIN', 'WITHDRAWAL_REVIEW'), ('SUPER_ADMIN', 'AUDIT_READ'), ('SUPER_ADMIN', 'SYSTEM_CONFIGURE'),
  ('ADMIN', 'USER_READ'), ('ADMIN', 'USER_MANAGE'), ('ADMIN', 'PRODUCT_READ'), ('ADMIN', 'ORDER_READ'), ('ADMIN', 'PAYMENT_READ'),
  ('FINANCE_ADMIN', 'PAYMENT_READ'), ('FINANCE_ADMIN', 'PAYMENT_RECONCILE'), ('FINANCE_ADMIN', 'WITHDRAWAL_REVIEW'), ('FINANCE_ADMIN', 'AUDIT_READ'),
  ('PRODUCT_MANAGER', 'PRODUCT_READ'), ('PRODUCT_MANAGER', 'PRODUCT_MANAGE'),
  ('ORDER_MANAGER', 'ORDER_READ'), ('ORDER_MANAGER', 'ORDER_MANAGE'),
  ('SUPPORT_ADMIN', 'USER_READ'), ('SUPPORT_ADMIN', 'ORDER_READ'),
  ('AUDITOR', 'USER_READ'), ('AUDITOR', 'PRODUCT_READ'), ('AUDITOR', 'ORDER_READ'), ('AUDITOR', 'PAYMENT_READ'), ('AUDITOR', 'AUDIT_READ')
) AS grant_row(role, permission)
ON CONFLICT ("role", "permission") DO NOTHING;
