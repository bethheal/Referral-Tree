-- Free trial is a real, server-timestamped membership. The fixed plan ID makes
-- this seed idempotent and gives registration a stable foreign-key target.
INSERT INTO "MembershipPlan" (
  "id", "code", "version", "displayName", "priceMinor", "currency",
  "durationDays", "benefits", "status", "effectiveFrom", "createdAt", "updatedAt"
)
VALUES (
  'system-plan-free-v1', 'FREE', 1, 'Free introductory access', 0, 'GHS',
  7, '{"viewOnly":true}', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("code", "version") DO NOTHING;

-- Preserve existing accounts. Members without an active membership receive the
-- same seven-day trial calculated from their original registration time; old
-- accounts therefore become FREE_EXPIRED rather than gaining a new trial.
INSERT INTO "Membership" (
  "id", "userId", "planId", "status", "startsAt", "expiresAt", "createdAt", "updatedAt"
)
SELECT
  'legacy-free-' || u."id", u."id", 'system-plan-free-v1', 'ACTIVE',
  u."createdAt", u."createdAt" + INTERVAL '7 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "Membership" m
  WHERE m."userId" = u."id"
    AND m."status" = 'ACTIVE'
    AND (m."expiresAt" IS NULL OR m."expiresAt" > CURRENT_TIMESTAMP)
)
ON CONFLICT ("id") DO NOTHING;
