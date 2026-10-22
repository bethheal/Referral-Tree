-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'PRODUCT_MANAGER', 'ORDER_MANAGER', 'SUPPORT_ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETION_REQUESTED', 'DELETED');

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('USER_READ', 'USER_MANAGE', 'ROLE_MANAGE', 'PRODUCT_READ', 'PRODUCT_MANAGE', 'ORDER_READ', 'ORDER_MANAGE', 'PAYMENT_READ', 'PAYMENT_RECONCILE', 'WITHDRAWAL_REVIEW', 'AUDIT_READ', 'SYSTEM_CONFIGURE');

-- CreateEnum
CREATE TYPE "MfaMethod" AS ENUM ('TOTP', 'PASSKEY');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'SILVER', 'GOLD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('FLUTTERWAVE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PaymentTargetType" AS ENUM ('MEMBERSHIP', 'PRODUCT_ORDER');

-- CreateEnum
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED', 'VERIFIED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTRATION', 'EMAIL_CHANGE', 'PHONE_CHANGE', 'PASSWORD_RESET', 'ADMIN_MFA');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('COMMISSION', 'POINTS', 'WITHDRAWAL_RESERVATION', 'WITHDRAWAL_RELEASE', 'WITHDRAWAL_PAYOUT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerEntryState" AS ENUM ('PENDING', 'AVAILABLE', 'RESERVED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "RewardPolicyStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELLED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('HELD', 'COMMITTED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "phoneVerifiedAt" TIMESTAMPTZ(6),
    "passwordHash" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "sponsorId" TEXT,
    "placementParentId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "profileImageKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "theme" VARCHAR(10) NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "mfaVerifiedAt" TIMESTAMPTZ(6),
    "rotatedFromId" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaFactor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "MfaMethod" NOT NULL,
    "label" TEXT,
    "secretCiphertext" TEXT,
    "credentialId" TEXT,
    "publicKey" TEXT,
    "verifiedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "MfaFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMPTZ(6),

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" "AdminPermission" NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationAttempt" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "referralCode" TEXT,
    "otpHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'REGISTRATION',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "otpExpiresAt" TIMESTAMPTZ(6) NOT NULL,
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "resendAvailableAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMPTZ(6),

    CONSTRAINT "RegistrationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "destination" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPlan" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "displayName" TEXT NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "durationDays" INTEGER,
    "benefits" JSONB NOT NULL DEFAULT '{}',
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMPTZ(6),
    "effectiveUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "membershipPaymentId" TEXT,
    "startsAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "PaymentTargetType" NOT NULL,
    "membershipPaymentId" TEXT,
    "productOrderId" TEXT,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'FLUTTERWAVE',
    "reference" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "amountMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "paidAt" TIMESTAMPTZ(6),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "paymentId" TEXT,
    "eventType" TEXT NOT NULL,
    "transactionId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "processingStatus" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseCode" INTEGER,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPolicy" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "RewardPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMPTZ(6),
    "effectiveFrom" TIMESTAMPTZ(6),
    "effectiveUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "state" "LedgerEntryState" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" VARCHAR(6) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "sourceType" VARCHAR(40),
    "sourceId" TEXT,
    "policyVersion" INTEGER,
    "reversalOfId" TEXT,
    "payoutEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "payoutProvider" TEXT,
    "payoutDestinationRef" TEXT,
    "reservationEntryId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalReview" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "decision" "WithdrawalStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "potentialMinor" BIGINT,
    "currency" CHAR(3),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(6),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" VARCHAR(24) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerRef" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(6),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageKey" TEXT,
    "priceMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "inventoryCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "archivedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" CHAR(3) NOT NULL DEFAULT 'GHS',
    "subtotalMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "shippingMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "skuSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "lineTotalMinor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "oldStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" CHAR(3) NOT NULL,
    "subtotalMinor" BIGINT NOT NULL,
    "taxMinor" BIGINT NOT NULL DEFAULT 0,
    "discountMinor" BIGINT NOT NULL DEFAULT 0,
    "shippingMinor" BIGINT NOT NULL DEFAULT 0,
    "totalMinor" BIGINT NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMPTZ(6),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" VARCHAR(60) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyRevokedToken" (
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegacyRevokedToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_sponsorId_createdAt_idx" ON "User"("sponsorId", "createdAt");

-- CreateIndex
CREATE INDEX "User_placementParentId_createdAt_idx" ON "User"("placementParentId", "createdAt");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserPreferences_language_idx" ON "UserPreferences"("language");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_rotatedFromId_key" ON "Session"("rotatedFromId");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaFactor_credentialId_key" ON "MfaFactor"("credentialId");

-- CreateIndex
CREATE INDEX "MfaFactor_userId_revokedAt_idx" ON "MfaFactor"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");

-- CreateIndex
CREATE INDEX "RolePermission_permission_role_idx" ON "RolePermission"("permission", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE INDEX "RegistrationAttempt_email_status_idx" ON "RegistrationAttempt"("email", "status");

-- CreateIndex
CREATE INDEX "RegistrationAttempt_phoneNumber_status_idx" ON "RegistrationAttempt"("phoneNumber", "status");

-- CreateIndex
CREATE INDEX "RegistrationAttempt_otpExpiresAt_idx" ON "RegistrationAttempt"("otpExpiresAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_destination_purpose_expiresAt_idx" ON "OtpChallenge"("destination", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_userId_purpose_expiresAt_idx" ON "OtpChallenge"("userId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "MembershipPlan_code_status_effectiveFrom_idx" ON "MembershipPlan"("code", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipPlan_code_version_key" ON "MembershipPlan"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_membershipPaymentId_key" ON "Membership"("membershipPaymentId");

-- CreateIndex
CREATE INDEX "Membership_userId_status_expiresAt_idx" ON "Membership"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "Membership_planId_status_idx" ON "Membership"("planId", "status");

-- CreateIndex
CREATE INDEX "MembershipPayment_userId_createdAt_idx" ON "MembershipPayment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_membershipPaymentId_key" ON "Payment"("membershipPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_userId_status_createdAt_idx" ON "Payment"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_targetType_createdAt_idx" ON "Payment"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_productOrderId_idx" ON "Payment"("productOrderId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_receivedAt_idx" ON "PaymentEvent"("paymentId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_processingStatus_receivedAt_idx" ON "PaymentEvent"("processingStatus", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyKey_status_createdAt_idx" ON "IdempotencyKey"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_scope_key_key" ON "IdempotencyKey"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPolicy_version_key" ON "RewardPolicy"("version");

-- CreateIndex
CREATE INDEX "RewardPolicy_status_enabled_effectiveFrom_idx" ON "RewardPolicy"("status", "enabled", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_referenceId_key" ON "LedgerEntry"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reversalOfId_key" ON "LedgerEntry"("reversalOfId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_state_createdAt_idx" ON "LedgerEntry"("userId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_reservationEntryId_key" ON "WithdrawalRequest"("reservationEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_idempotencyKey_key" ON "WithdrawalRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_status_createdAt_idx" ON "WithdrawalRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalReview_withdrawalId_createdAt_idx" ON "WithdrawalReview"("withdrawalId", "createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalReview_reviewerUserId_createdAt_idx" ON "WithdrawalReview"("reviewerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_ownerUserId_status_createdAt_idx" ON "Lead"("ownerUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_status_name_idx" ON "Product"("status", "name");

-- CreateIndex
CREATE INDEX "ProductChange_productId_createdAt_idx" ON "ProductChange"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductChange_actorUserId_createdAt_idx" ON "ProductChange"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_orderNumber_key" ON "ProductOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOrder_idempotencyKey_key" ON "ProductOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProductOrder_userId_status_createdAt_idx" ON "ProductOrder"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrder_status_createdAt_idx" ON "ProductOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductOrderItem_orderId_idx" ON "ProductOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ProductOrderItem_productId_idx" ON "ProductOrderItem"("productId");

-- CreateIndex
CREATE INDEX "StockReservation_status_expiresAt_idx" ON "StockReservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "StockReservation_productId_status_idx" ON "StockReservation"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_orderId_productId_key" ON "StockReservation"("orderId", "productId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_userId_issuedAt_idx" ON "Invoice"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_status_issuedAt_idx" ON "Invoice"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_userId_type_createdAt_idx" ON "SecurityEvent"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_type_createdAt_idx" ON "SecurityEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_placementParentId_fkey" FOREIGN KEY ("placementParentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_rotatedFromId_fkey" FOREIGN KEY ("rotatedFromId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaFactor" ADD CONSTRAINT "MfaFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_membershipPaymentId_fkey" FOREIGN KEY ("membershipPaymentId") REFERENCES "MembershipPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPayment" ADD CONSTRAINT "MembershipPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membershipPaymentId_fkey" FOREIGN KEY ("membershipPaymentId") REFERENCES "MembershipPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_productOrderId_fkey" FOREIGN KEY ("productOrderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPolicy" ADD CONSTRAINT "RewardPolicy_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_reservationEntryId_fkey" FOREIGN KEY ("reservationEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalReview" ADD CONSTRAINT "WithdrawalReview_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalReview" ADD CONSTRAINT "WithdrawalReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChange" ADD CONSTRAINT "ProductChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductChange" ADD CONSTRAINT "ProductChange_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain checks not expressible in the Prisma schema language.
ALTER TABLE "User" ADD CONSTRAINT "User_name_length_check" CHECK (char_length(btrim("fullName")) BETWEEN 2 AND 120);
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check" CHECK ("email" = lower(btrim("email")));
ALTER TABLE "User" ADD CONSTRAINT "User_phone_e164_check" CHECK ("phoneNumber" IS NULL OR "phoneNumber" ~ '^\+[1-9][0-9]{7,14}$');
ALTER TABLE "User" ADD CONSTRAINT "User_sponsor_not_self_check" CHECK ("sponsorId" IS NULL OR "sponsorId" <> "id");
ALTER TABLE "User" ADD CONSTRAINT "User_placement_parent_not_self_check" CHECK ("placementParentId" IS NULL OR "placementParentId" <> "id");
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_language_check" CHECK ("language" IN ('en', 'fr'));
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_theme_check" CHECK ("theme" IN ('light', 'dark', 'system'));
ALTER TABLE "MfaFactor" ADD CONSTRAINT "MfaFactor_material_check" CHECK (
  ("method" = 'TOTP' AND "secretCiphertext" IS NOT NULL AND "credentialId" IS NULL)
  OR ("method" = 'PASSKEY' AND "credentialId" IS NOT NULL AND "publicKey" IS NOT NULL AND "secretCiphertext" IS NULL)
);
ALTER TABLE "RegistrationAttempt" ADD CONSTRAINT "RegistrationAttempt_attempts_check" CHECK ("otpAttempts" BETWEEN 0 AND 5);
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_price_duration_check" CHECK ("priceMinor" >= 0 AND ("durationDays" IS NULL OR "durationDays" > 0));
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_effective_dates_check" CHECK ("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_dates_check" CHECK ("expiresAt" IS NULL OR "startsAt" IS NULL OR "expiresAt" > "startsAt");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive_check" CHECK ("amountMinor" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_target_relation_check" CHECK (
  ("targetType" = 'MEMBERSHIP' AND "membershipPaymentId" IS NOT NULL AND "productOrderId" IS NULL)
  OR ("targetType" = 'PRODUCT_ORDER' AND "membershipPaymentId" IS NULL AND "productOrderId" IS NOT NULL)
);
ALTER TABLE "RewardPolicy" ADD CONSTRAINT "RewardPolicy_enabled_requires_approval_check" CHECK (
  NOT "enabled" OR ("status" = 'ACTIVE' AND "approvedAt" IS NOT NULL AND "approvedByUserId" IS NOT NULL AND "effectiveFrom" IS NOT NULL)
);
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_amount_fee_check" CHECK ("amountMinor" > 0 AND "feeMinor" >= 0);
ALTER TABLE "WithdrawalReview" ADD CONSTRAINT "WithdrawalReview_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 8 AND 500);
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_inventory_check" CHECK ("priceMinor" >= 0 AND "inventoryCount" >= 0);
ALTER TABLE "ProductOrder" ADD CONSTRAINT "ProductOrder_totals_check" CHECK (
  "subtotalMinor" >= 0 AND "taxMinor" >= 0 AND "discountMinor" >= 0 AND "shippingMinor" >= 0
  AND "discountMinor" <= "subtotalMinor"
  AND "totalMinor" = "subtotalMinor" + "taxMinor" - "discountMinor" + "shippingMinor"
);
ALTER TABLE "ProductOrderItem" ADD CONSTRAINT "ProductOrderItem_totals_check" CHECK (
  "quantity" > 0 AND "unitPriceMinor" >= 0 AND "taxMinor" >= 0 AND "discountMinor" >= 0
  AND "discountMinor" <= ("quantity"::BIGINT * "unitPriceMinor")
  AND "lineTotalMinor" = ("quantity"::BIGINT * "unitPriceMinor") + "taxMinor" - "discountMinor"
);
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_totals_check" CHECK (
  "subtotalMinor" >= 0 AND "taxMinor" >= 0 AND "discountMinor" >= 0 AND "shippingMinor" >= 0
  AND "discountMinor" <= "subtotalMinor"
  AND "totalMinor" = "subtotalMinor" + "taxMinor" - "discountMinor" + "shippingMinor"
);
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_attempts_check" CHECK ("attemptCount" >= 0);

-- Composite references prevent related financial and notification rows crossing owners.
CREATE UNIQUE INDEX "MembershipPayment_id_userId_key" ON "MembershipPayment"("id", "userId");
CREATE UNIQUE INDEX "MembershipPayment_id_userId_planId_key" ON "MembershipPayment"("id", "userId", "planId");
CREATE UNIQUE INDEX "ProductOrder_id_userId_key" ON "ProductOrder"("id", "userId");
CREATE UNIQUE INDEX "Notification_id_userId_key" ON "Notification"("id", "userId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_membership_owner_fkey" FOREIGN KEY ("membershipPaymentId", "userId") REFERENCES "MembershipPayment"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_order_owner_fkey" FOREIGN KEY ("productOrderId", "userId") REFERENCES "ProductOrder"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_purchase_owner_plan_fkey" FOREIGN KEY ("membershipPaymentId", "userId", "planId") REFERENCES "MembershipPayment"("id", "userId", "planId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_order_owner_fkey" FOREIGN KEY ("orderId", "userId") REFERENCES "ProductOrder"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notification_owner_fkey" FOREIGN KEY ("notificationId", "userId") REFERENCES "Notification"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep sponsor and placement ancestry acyclic even if a service check is bypassed.
CREATE FUNCTION reject_user_tree_cycles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."sponsorId" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, "sponsorId" FROM "User" WHERE id = NEW."sponsorId"
      UNION
      SELECT u.id, u."sponsorId" FROM "User" u JOIN ancestors a ON u.id = a.parent_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'sponsor relationship would create a cycle' USING ERRCODE = '23514';
  END IF;
  IF NEW."placementParentId" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, "placementParentId" FROM "User" WHERE id = NEW."placementParentId"
      UNION
      SELECT u.id, u."placementParentId" FROM "User" u JOIN ancestors a ON u.id = a.parent_id
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'placement relationship would create a cycle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "User_prevent_tree_cycles"
BEFORE INSERT OR UPDATE OF "sponsorId", "placementParentId" ON "User"
FOR EACH ROW EXECUTE FUNCTION reject_user_tree_cycles();

-- Financial and administrative evidence is append-only; corrections use new rows.
CREATE FUNCTION reject_append_only_mutations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only record cannot be updated or deleted' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER "LedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutations();
CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutations();
CREATE TRIGGER "ProductChange_append_only" BEFORE UPDATE OR DELETE ON "ProductChange" FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutations();
CREATE TRIGGER "WithdrawalReview_append_only" BEFORE UPDATE OR DELETE ON "WithdrawalReview" FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutations();
CREATE TRIGGER "OrderStatusHistory_append_only" BEFORE UPDATE OR DELETE ON "OrderStatusHistory" FOR EACH ROW EXECUTE FUNCTION reject_append_only_mutations();
