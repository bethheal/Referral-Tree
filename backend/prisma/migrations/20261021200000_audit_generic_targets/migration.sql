-- Add generic target references so audit entries can identify products,
-- orders, payments, approvals, and users without weakening User foreign keys.
ALTER TABLE "AuditLog"
  ADD COLUMN "targetType" VARCHAR(40),
  ADD COLUMN "targetId" VARCHAR(120);

CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx"
  ON "AuditLog"("targetType", "targetId", "createdAt");
