import {
  getMemberDashboardSummary,
  getMemberDirectReferrals,
  getPlacementChildren,
  getTreeMembers,
  referralSystem,
} from "@/components/referralData";

export type AccountActivity = {
  id: string;
  title: string;
  detail: string;
  amount?: number;
  status: "Complete" | "Pending" | "Available" | "Paid";
  date: string;
};

export type PaymentRecord = {
  id: string;
  direction: "Received" | "Made";
  title: string;
  amount: number;
  status: "Pending" | "Available" | "Paid" | "Processing";
  reference: string;
  date: string;
};

export type MessageRecord = {
  id: string;
  title: string;
  body: string;
  date: string;
  unread?: boolean;
};

const activeUserId = "user-1";

const currentUser = referralSystem.users.find(
  (user) => user.id === activeUserId,
);
const summary = getMemberDashboardSummary(referralSystem, activeUserId);
const directReferrals = getMemberDirectReferrals(referralSystem, activeUserId);
const networkMembers = getTreeMembers(
  referralSystem,
  summary.member.treeId,
).filter((member) => member.id !== activeUserId);

const availableBalance = summary.earnings.available;
const pendingEarnings = Math.max(summary.directReferrals * 2, 24);
const projectedReferralBonus = Math.max(
  summary.availableTreeSpaces > 0
    ? Math.min(summary.availableTreeSpaces, 12) * 4
    : 0,
  16,
);
const paidOut = summary.earnings.paid;
const projectedCashOut =
  availableBalance + pendingEarnings + projectedReferralBonus;

export const accountDetails = {
  id: activeUserId,
  name: currentUser?.name ?? "Member",
  email: currentUser?.email ?? "member@angelfoods.com",
  referralCode: currentUser?.referralCode ?? "ANGEL001",
  status: currentUser?.status ?? "ACTIVE",
  productLevel: currentUser?.productLevel ?? 1,
  referredBy: currentUser?.sponsorId
    ? (referralSystem.users.find((user) => user.id === currentUser.sponsorId)
        ?.name ?? "Unknown")
    : "Root account",
  directReferralNames: directReferrals.map((member) => member.name),
};

export const financialSummary = {
  currentBalance: availableBalance,
  availableCashOut: availableBalance,
  pendingEarnings,
  projectedReferralBonus,
  projectedCashOut,
  paidOut,
  totalEarnings: summary.earnings.total,
  referralBonuses: summary.earnings.directReferral,
  directReferrals: summary.directReferrals,
  totalNetwork: networkMembers.length,
  pendingPayments: pendingEarnings,
};

export const accountHistory: AccountActivity[] = [
  {
    id: "history-1",
    title: "Referral bonus available",
    detail: `${directReferrals[0]?.name ?? "A direct referral"} qualified through your link.`,
    amount: 4,
    status: "Available",
    date: "2026-09-14",
  },
  {
    id: "history-2",
    title: "Network placement filled",
    detail: "A deeper referral was placed in your level-two network.",
    status: "Complete",
    date: "2026-09-13",
  },
  {
    id: "history-3",
    title: "Projected cash-out updated",
    detail: "Pending earnings and expected referral bonuses were recalculated.",
    amount: projectedCashOut,
    status: "Pending",
    date: "2026-09-12",
  },
  {
    id: "history-4",
    title: "Account qualification confirmed",
    detail: `Product level ${accountDetails.productLevel} is currently qualified.`,
    status: "Complete",
    date: "2026-09-10",
  },
];

export const paymentHistory: PaymentRecord[] = [
  {
    id: "pay-1",
    direction: "Received",
    title: "Direct referral bonus",
    amount: availableBalance,
    status: "Available",
    reference: "registration:user-2",
    date: "2026-09-14",
  },
  {
    id: "pay-2",
    direction: "Received",
    title: "Pending network bonus",
    amount: pendingEarnings,
    status: "Pending",
    reference: "network:level-2",
    date: "2026-09-13",
  },
  {
    id: "pay-3",
    direction: "Made",
    title: "Product level purchase",
    amount: 25,
    status: "Paid",
    reference: "product-level-3",
    date: "2026-09-10",
  },
];

export const notification: MessageRecord[] = [
  {
    id: "msg-1",
    title: "Referral network updated",
    body: "Your referral tree now includes direct and indirect connections across multiple levels.",
    date: "2026-09-14",
    unread: true,
  },
  {
    id: "msg-2",
    title: "Cash-out reminder",
    body: "Projected earnings are estimates until the related bonuses become available.",
    date: "2026-09-13",
  },
  {
    id: "msg-3",
    title: "Payment method saved",
    body: "Your payment details are ready for future purchases and cash-out reviews.",
    date: "2026-09-10",
  },
];

export const getConnectionDetails = (memberId: string) => {
  const member = referralSystem.users.find((user) => user.id === memberId);

  if (!member) {
    return null;
  }

  const sponsor = member.sponsorId
    ? referralSystem.users.find((user) => user.id === member.sponsorId)
    : null;
  const placementParent = member.placementParentId
    ? referralSystem.users.find((user) => user.id === member.placementParentId)
    : null;
  const children = getPlacementChildren(referralSystem, member.id);

  return {
    member,
    sponsor,
    placementParent,
    children,
    commissions: referralSystem.commissions.filter(
      (commission) =>
        commission.sourceUserId === member.id ||
        commission.recipientId === member.id,
    ),
    points: referralSystem.points.filter((point) => point.userId === member.id),
  };
};
