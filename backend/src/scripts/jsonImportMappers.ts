type LegacyRow = Record<string, unknown>;

export type AuditImportRow = {
  id: string;
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  oldValue?: object;
  newValue?: object;
  reason?: string;
  requestId?: string;
  ipAddress?: string;
  targetType?: string;
  targetId?: string;
  createdAt: Date;
};

export type IndexedImportError = { sourceIndex: number; reason: string };

const SKIPPED_ADMINISTRATOR_ROLES = new Set([
  "ADMIN",
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "PRODUCT_MANAGER",
  "ORDER_MANAGER",
  "SUPPORT_ADMIN",
  "AUDITOR",
]);

const requiredString = (row: LegacyRow, field: string) => {
  const value = row[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}_required`);
  return value;
};

const optionalText = (row: LegacyRow, field: string, maxLength?: number) => {
  const value = row[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${field}_must_be_text`);
  if (maxLength !== undefined && value.length > maxLength) {
    throw new Error(`${field}_exceeds_${maxLength}_characters`);
  }
  return value;
};

const jsonValue = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as object;
};

const dateValue = (value: unknown) => {
  const date = new Date(typeof value === "string" || value instanceof Date ? value : NaN);
  if (Number.isNaN(date.getTime())) throw new Error("createdAt_invalid_date");
  return date;
};

export const isImportableLegacyRole = (role: unknown): role is "USER" => role === "USER";
export const isSkippedAdministratorRole = (role: unknown) =>
  typeof role === "string" && SKIPPED_ADMINISTRATOR_ROLES.has(role);

export const mapAuditLogs = (
  rows: unknown[],
  importableUserIds: Set<string>,
  skippedAdministratorIds: Set<string> = new Set(),
) => {
  const mapped: AuditImportRow[] = [];
  const invalidRows: IndexedImportError[] = [];
  const missingActorReferenceRows: number[] = [];
  const missingTargetReferenceRows: number[] = [];
  const historicalAdministratorTargetRows: number[] = [];

  rows.forEach((row, offset) => {
    const sourceIndex = offset + 1;
    try {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("record_must_be_object");
      }
      const record = row as LegacyRow;
      const sourceActorId = optionalText(record, "actorUserId");
      const sourceTargetUserId = optionalText(record, "targetUserId");
      const actorUserId = sourceActorId && importableUserIds.has(sourceActorId) ? sourceActorId : null;
      const targetUserId = sourceTargetUserId && importableUserIds.has(sourceTargetUserId) ? sourceTargetUserId : null;
      const isSkippedAdministratorTarget = Boolean(
        sourceTargetUserId && !targetUserId && skippedAdministratorIds.has(sourceTargetUserId),
      );
      if (sourceActorId && !actorUserId) missingActorReferenceRows.push(sourceIndex);
      if (sourceTargetUserId && !targetUserId && !isSkippedAdministratorTarget) missingTargetReferenceRows.push(sourceIndex);

      const oldValue = jsonValue(record.oldValue);
      const newValue = jsonValue(record.newValue);
      const action = requiredString(record, "action");
      if (action.length > 80) throw new Error("action_exceeds_80_characters");
      const targetType = optionalText(record, "targetType", 40);
      const sourceTargetId = optionalText(record, "targetId", 120);
      const targetId = sourceTargetId ?? (isSkippedAdministratorTarget
        ? optionalText({ targetId: sourceTargetUserId }, "targetId", 120)
        : undefined);
      mapped.push({
        id: requiredString(record, "id"),
        actorUserId,
        targetUserId,
        action,
        ...(oldValue ? { oldValue } : {}),
        ...(newValue ? { newValue } : {}),
        ...(optionalText(record, "reason") !== undefined ? { reason: record.reason as string } : {}),
        ...(optionalText(record, "requestId") !== undefined ? { requestId: record.requestId as string } : {}),
        ...(optionalText(record, "ipAddress") !== undefined ? { ipAddress: record.ipAddress as string } : {}),
        // These are VARCHAR(40) and VARCHAR(120) in schema.prisma. The other
        // metadata fields are Prisma String/TEXT and have no schema length cap.
        ...(targetType !== undefined ? { targetType } : isSkippedAdministratorTarget ? { targetType: "USER" } : {}),
        ...(targetId !== undefined ? { targetId } : {}),
        createdAt: dateValue(record.createdAt),
      });
      if (isSkippedAdministratorTarget) historicalAdministratorTargetRows.push(sourceIndex);
    } catch (error) {
      invalidRows.push({
        sourceIndex,
        reason: error instanceof Error ? error.message : "invalid_audit_row",
      });
    }
  });

  return {
    rows: mapped,
    invalidRows,
    missingActorReferenceRows,
    missingTargetReferenceRows,
    historicalAdministratorTargetRows,
  };
};

export type RevokedTokenImportRow = { tokenHash: string; revokedAt: Date | null; sourceIndex: number };

export const mapRevokedSessions = (values: unknown[]) => {
  const rows: RevokedTokenImportRow[] = [];
  const invalidRows: IndexedImportError[] = [];
  values.forEach((value, offset) => {
    const sourceIndex = offset + 1;
    try {
      const row = typeof value === "string" ? { tokenHash: value } : value;
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("record_must_be_hash_or_object");
      const record = row as LegacyRow;
      const tokenHash = requiredString(record, "tokenHash");
      const timestamp = record.revokedAt;
      const revokedAt = timestamp === undefined || timestamp === null ? null : dateValue(timestamp);
      rows.push({ tokenHash, revokedAt, sourceIndex });
    } catch (error) {
      invalidRows.push({
        sourceIndex,
        reason: error instanceof Error ? error.message : "invalid_revoked_session",
      });
    }
  });
  return { rows, invalidRows };
};

export const applyRevokedSessionMigrationTimestamp = (
  rows: RevokedTokenImportRow[],
  migrationTimestamp: Date,
) => {
  const missingTimestampCount = rows.filter((row) => row.revokedAt === null).length;
  return {
    rows: rows.map(({ tokenHash, revokedAt }) => ({
      tokenHash,
      revokedAt: revokedAt ?? migrationTimestamp,
    })),
    missingTimestampCount,
  };
};
