-- Additive admin-console support. Existing records are preserved.
CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'EXPIRED');

ALTER TABLE "AuditLog" ADD COLUMN "ipAddress" TEXT;

CREATE TABLE "AdminActionApproval" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(40) NOT NULL,
    "targetId" VARCHAR(120) NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "requestIpAddress" TEXT,
    "approvalIpAddress" TEXT,
    "requestId" TEXT,
    "requestedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMPTZ(6),
    CONSTRAINT "AdminActionApproval_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AdminActionApproval_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 8 AND 500),
    CONSTRAINT "AdminActionApproval_distinct_approver_check" CHECK ("approvedByUserId" IS NULL OR "approvedByUserId" <> "requestedByUserId"),
    CONSTRAINT "AdminActionApproval_decision_fields_check" CHECK (
      ("status" = 'PENDING' AND "approvedByUserId" IS NULL AND "decidedAt" IS NULL)
      OR ("status" <> 'PENDING' AND "approvedByUserId" IS NOT NULL AND "decidedAt" IS NOT NULL)
    )
);

CREATE INDEX "AdminActionApproval_status_requestedAt_idx" ON "AdminActionApproval"("status", "requestedAt");
CREATE INDEX "AdminActionApproval_action_status_requestedAt_idx" ON "AdminActionApproval"("action", "status", "requestedAt");
CREATE INDEX "AdminActionApproval_targetType_targetId_requestedAt_idx" ON "AdminActionApproval"("targetType", "targetId", "requestedAt");

ALTER TABLE "AdminActionApproval" ADD CONSTRAINT "AdminActionApproval_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminActionApproval" ADD CONSTRAINT "AdminActionApproval_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-level append-only enforcement also prevents application paths from editing old audit evidence.
