export const MAX_DIRECT_PLACEMENT_CHILDREN = 4;
export const MAX_TREE_SIZE = 250;

export type TreeStatus = "ACTIVE" | "FULL" | "INACTIVE";
export type MemberStatus = "ACTIVE" | "PENDING" | "SUSPENDED";
export type CommissionStatus = "PENDING" | "AVAILABLE" | "PAID" | "VOID";
export type CommissionType =
  | "DIRECT_REFERRAL"
  | "LEVEL"
  | "TEAM"
  | "MATCHING"
  | "RESIDUAL"
  | "PRODUCT";

export type ProductConfig = {
  id: string;
  name: string;
  level: number;
  price: number;
  commissionAmount: number;
  potentialAffiliates: number;
  status: "ACTIVE" | "INACTIVE";
};

export type ReferralMember = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  sponsorId: string | null;
  placementParentId: string | null;
  placementPosition: number | null;
  treeId: string;
  treeLevel: number;
  productLevel: number;
  qualificationStatus: "QUALIFIED" | "PENDING";
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReferralTreeRecord = {
  id: string;
  rootUserId: string;
  memberCount: number;
  maxMembers: number;
  status: TreeStatus;
  createdAt: string;
  updatedAt: string;
};

export type TreePlacementRecord = {
  id: string;
  treeId: string;
  userId: string;
  parentId: string | null;
  position: number | null;
  level: number;
  createdAt: string;
};

export type CommissionTransaction = {
  id: string;
  recipientId: string;
  sourceUserId: string;
  sponsorId: string | null;
  productId: string;
  productLevel: number;
  commissionType: CommissionType;
  amount: number;
  currency: string;
  status: CommissionStatus;
  referenceId: string;
  createdAt: string;
};

export type PointTransaction = {
  id: string;
  userId: string;
  points: number;
  type: "REFERRAL" | "PURCHASE" | "TEAM_ACTIVITY" | "QUALIFICATION";
  source: string;
  description: string;
  referenceId: string;
  createdAt: string;
};

export type ReferralSystemState = {
  users: ReferralMember[];
  trees: ReferralTreeRecord[];
  placements: TreePlacementRecord[];
  products: ProductConfig[];
  commissions: CommissionTransaction[];
  points: PointTransaction[];
};

export type ReferralNodeData = ReferralMember & {
  children: ReferralNodeData[];
};

export const productConfigs: ProductConfig[] = [
  {
    id: "product-level-1",
    name: "Angel Foods Level 1",
    level: 1,
    price: 10,
    commissionAmount: 4,
    potentialAffiliates: 4,
    status: "ACTIVE",
  },
  {
    id: "product-level-2",
    name: "Angel Foods Level 2",
    level: 2,
    price: 10,
    commissionAmount: 4,
    potentialAffiliates: 16,
    status: "ACTIVE",
  },
  {
    id: "product-level-3",
    name: "Angel Foods Level 3",
    level: 3,
    price: 25,
    commissionAmount: 10,
    potentialAffiliates: 64,
    status: "ACTIVE",
  },
  {
    id: "product-level-4",
    name: "Angel Foods Level 4",
    level: 4,
    price: 60,
    commissionAmount: 24,
    potentialAffiliates: 256,
    status: "ACTIVE",
  },
  {
    id: "product-level-5",
    name: "Angel Foods Level 5",
    level: 5,
    price: 150,
    commissionAmount: 120,
    potentialAffiliates: 1024,
    status: "ACTIVE",
  },
  {
    id: "product-level-6",
    name: "Angel Foods Level 6",
    level: 6,
    price: 300,
    commissionAmount: 120,
    potentialAffiliates: 4096,
    status: "ACTIVE",
  },
];

const now = "2026-09-14T12:00:00.000Z";

const createCode = (name: string, index: number) =>
  `${name.replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase()}${String(index).padStart(3, "0")}`;

const getChildren = (state: ReferralSystemState, parentId: string) =>
  state.users
    .filter((user) => user.placementParentId === parentId)
    .sort((a, b) => (a.placementPosition ?? 0) - (b.placementPosition ?? 0));

const hasPlacementCycle = (state: ReferralSystemState, userId: string) => {
  const visited = new Set<string>();
  let current = state.users.find((user) => user.id === userId);

  while (current?.placementParentId) {
    if (visited.has(current.placementParentId)) {
      return true;
    }

    visited.add(current.placementParentId);
    current = state.users.find((user) => user.id === current?.placementParentId);
  }

  return false;
};

export const findPlacementPosition = (
  state: ReferralSystemState,
  sponsorId: string
) => {
  const sponsor = state.users.find((user) => user.id === sponsorId);

  if (!sponsor) {
    throw new Error("Sponsor referral code was not found.");
  }

  const tree = state.trees.find((item) => item.id === sponsor.treeId);

  if (!tree || tree.memberCount >= tree.maxMembers || tree.status === "FULL") {
    throw new Error("Referral tree is full.");
  }

  const queue: ReferralMember[] = [sponsor];

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const children = getChildren(state, current.id);

    if (children.length < MAX_DIRECT_PLACEMENT_CHILDREN) {
      const usedPositions = new Set(
        children.map((child) => child.placementPosition).filter(Boolean)
      );
      const nextPosition = Array.from(
        { length: MAX_DIRECT_PLACEMENT_CHILDREN },
        (_, index) => index + 1
      ).find((position) => !usedPositions.has(position));

      if (!nextPosition) {
        throw new Error("No available placement position was found.");
      }

      return {
        parentId: current.id,
        position: nextPosition,
        level: current.treeLevel + 1,
        treeId: current.treeId,
      };
    }

    queue.push(...children);
  }

  throw new Error("Referral tree is full.");
};

export const registerMember = (
  state: ReferralSystemState,
  input: {
    name: string;
    email: string;
    sponsorReferralCode: string;
    productLevel?: number;
  }
) => {
  const sponsor = state.users.find(
    (user) => user.referralCode === input.sponsorReferralCode
  );

  if (!sponsor) {
    throw new Error("Sponsor referral code was not found.");
  }

  if (sponsor.email.toLowerCase() === input.email.toLowerCase()) {
    throw new Error("Self-referrals are not allowed.");
  }

  const existingUser = state.users.find(
    (user) => user.email.toLowerCase() === input.email.toLowerCase()
  );

  if (existingUser) {
    throw new Error("A member with this email already exists.");
  }

  const placement = findPlacementPosition(state, sponsor.id);
  const userIndex = state.users.length + 1;
  const product =
    state.products.find((item) => item.level === (input.productLevel ?? 1)) ??
    state.products[0];
  const newUser: ReferralMember = {
    id: `user-${userIndex}`,
    name: input.name,
    email: input.email,
    referralCode: createCode(input.name, userIndex),
    sponsorId: sponsor.id,
    placementParentId: placement.parentId,
    placementPosition: placement.position,
    treeId: placement.treeId,
    treeLevel: placement.level,
    productLevel: product.level,
    qualificationStatus: "QUALIFIED",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  const duplicatePosition = state.users.some(
    (user) =>
      user.treeId === placement.treeId &&
      user.placementParentId === placement.parentId &&
      user.placementPosition === placement.position
  );

  if (duplicatePosition) {
    throw new Error("Placement position is already occupied.");
  }

  state.users.push(newUser);
  state.placements.push({
    id: `placement-${state.placements.length + 1}`,
    treeId: placement.treeId,
    userId: newUser.id,
    parentId: placement.parentId,
    position: placement.position,
    level: placement.level,
    createdAt: now,
  });

  const tree = state.trees.find((item) => item.id === placement.treeId);

  if (tree) {
    tree.memberCount += 1;
    tree.status = tree.memberCount >= tree.maxMembers ? "FULL" : "ACTIVE";
    tree.updatedAt = now;
  }

  state.commissions.push({
    id: `commission-${state.commissions.length + 1}`,
    recipientId: sponsor.id,
    sourceUserId: newUser.id,
    sponsorId: sponsor.id,
    productId: product.id,
    productLevel: product.level,
    commissionType: "DIRECT_REFERRAL",
    amount: product.commissionAmount,
    currency: "USD",
    status: "AVAILABLE",
    referenceId: `registration:${newUser.id}`,
    createdAt: now,
  });

  state.points.push({
    id: `points-${state.points.length + 1}`,
    userId: sponsor.id,
    points: 50,
    type: "REFERRAL",
    source: "member_registration",
    description: `${input.name} joined with ${sponsor.referralCode}`,
    referenceId: `registration:${newUser.id}`,
    createdAt: now,
  });

  return newUser;
};

export const validateReferralIntegrity = (state: ReferralSystemState) => {
  const issues: string[] = [];

  state.trees.forEach((tree) => {
    const members = getTreeMembers(state, tree.id);

    if (members.length !== tree.memberCount) {
      issues.push(
        `${tree.id} member count is ${tree.memberCount}, but ${members.length} users are assigned.`
      );
    }

    if (tree.memberCount > tree.maxMembers) {
      issues.push(`${tree.id} exceeds the ${tree.maxMembers} member capacity.`);
    }
  });

  state.users.forEach((user) => {
    if (user.sponsorId === user.id) {
      issues.push(`${user.name} is sponsoring themselves.`);
    }

    if (hasPlacementCycle(state, user.id)) {
      issues.push(`${user.name} has a circular placement chain.`);
    }

    const children = getChildren(state, user.id);

    if (children.length > MAX_DIRECT_PLACEMENT_CHILDREN) {
      issues.push(`${user.name} has more than four placement children.`);
    }

    const usedPositions = new Set<number>();

    children.forEach((child) => {
      if (!child.placementPosition) {
        return;
      }

      if (usedPositions.has(child.placementPosition)) {
        issues.push(
          `${user.name} has a duplicate placement position ${child.placementPosition}.`
        );
      }

      usedPositions.add(child.placementPosition);
    });
  });

  const duplicateCommissionRefs = new Set<string>();
  const seenCommissionRefs = new Set<string>();

  state.commissions.forEach((commission) => {
    if (seenCommissionRefs.has(commission.referenceId)) {
      duplicateCommissionRefs.add(commission.referenceId);
    }

    seenCommissionRefs.add(commission.referenceId);
  });

  duplicateCommissionRefs.forEach((referenceId) => {
    issues.push(`Duplicate commission payout reference: ${referenceId}.`);
  });

  return {
    passed: issues.length === 0,
    issues,
  };
};

export const updateMemberStatus = (
  state: ReferralSystemState,
  memberId: string,
  status: MemberStatus
) => {
  const member = state.users.find((user) => user.id === memberId);

  if (!member) {
    throw new Error("Member not found.");
  }

  member.status = status;
  member.updatedAt = now;

  return member;
};

export const updateCommissionStatus = (
  state: ReferralSystemState,
  transactionId: string,
  status: CommissionStatus
) => {
  const transaction = state.commissions.find(
    (commission) => commission.id === transactionId
  );

  if (!transaction) {
    throw new Error("Commission transaction not found.");
  }

  transaction.status = status;

  return transaction;
};

export const updateProductCommission = (
  state: ReferralSystemState,
  productId: string,
  commissionAmount: number
) => {
  const product = state.products.find((item) => item.id === productId);

  if (!product) {
    throw new Error("Product level not found.");
  }

  product.commissionAmount = commissionAmount;

  return product;
};

export const createInitialReferralSystem = () => {
  const root: ReferralMember = {
    id: "user-1",
    name: "Jennifer",
    email: "jennifer@angelfoods.com",
    referralCode: "ANGEL001",
    sponsorId: null,
    placementParentId: null,
    placementPosition: null,
    treeId: "tree-1",
    treeLevel: 0,
    productLevel: 3,
    qualificationStatus: "QUALIFIED",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };

  const state: ReferralSystemState = {
    users: [root],
    trees: [
      {
        id: "tree-1",
        rootUserId: root.id,
        memberCount: 1,
        maxMembers: MAX_TREE_SIZE,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
      },
    ],
    placements: [
      {
        id: "placement-1",
        treeId: "tree-1",
        userId: root.id,
        parentId: null,
        position: null,
        level: 0,
        createdAt: now,
      },
    ],
    products: productConfigs,
    commissions: [],
    points: [],
  };

  [
    "Aisha Mensah",
    "Kofi Badu",
    "Ama Owusu",
    "Kwame Boateng",
    "Efua Sarpong",
    "Michael Osei",
    "Elizabeth Cole",
    "John Abbey",
    "Mary Addo",
    "Sarah Smith",
    "Rupali Das",
    "Sandy Moore",
    "Kimbo Prince",
    "Amiya Equal",
    "Romneya Fif",
    "Noshing Sour",
    "Nana Yeboah",
    "Grace Taylor",
    "Samuel White",
    "Akua Nelson",
    "Daniel King",
    "Linda Brown",
    "Peter Young",
    "Mabel Stone",
    "Isaac Ford",
    "Rose Grant",
    "Tina Green",
    "David Hill",
  ].forEach((name, index) => {
    registerMember(state, {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      sponsorReferralCode: root.referralCode,
      productLevel: (index % 6) + 1,
    });
  });

  return state;
};

export const referralSystem = createInitialReferralSystem();

export const buildReferralTree = (
  state: ReferralSystemState,
  rootUserId: string
): ReferralNodeData => {
  const user = state.users.find((item) => item.id === rootUserId);

  if (!user) {
    throw new Error("Tree root not found.");
  }

  const children = getChildren(state, rootUserId).map((child) =>
    buildReferralTree(state, child.id)
  );

  return {
    ...user,
    children,
  };
};

export const getReferralInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const getMemberDirectReferrals = (
  state: ReferralSystemState,
  memberId: string
) => state.users.filter((user) => user.sponsorId === memberId);

export const getPlacementChildren = getChildren;

export const getTreeMembers = (state: ReferralSystemState, treeId: string) =>
  state.users.filter((user) => user.treeId === treeId);

export const getLevelCounts = (state: ReferralSystemState, treeId: string) =>
  getTreeMembers(state, treeId).reduce<Record<number, number>>((counts, user) => {
    if (user.treeLevel > 0) {
      counts[user.treeLevel] = (counts[user.treeLevel] ?? 0) + 1;
    }

    return counts;
  }, {});

export const getLevelRows = (
  state: ReferralSystemState,
  treeId: string,
  maxLevel = 6
) => {
  const counts = getLevelCounts(state, treeId);

  return Array.from({ length: maxLevel }, (_, index) => {
    const level = index + 1;

    return {
      level,
      label: `Level ${level}`,
      people: counts[level] ?? 0,
      theoreticalCapacity: 4 ** level,
    };
  });
};

export const getMemberEarnings = (
  state: ReferralSystemState,
  memberId: string
) => {
  const memberCommissions = state.commissions.filter(
    (commission) => commission.recipientId === memberId
  );

  return {
    total: memberCommissions
      .filter((commission) => commission.status !== "VOID")
      .reduce((sum, commission) => sum + commission.amount, 0),
    available: memberCommissions
      .filter((commission) => commission.status === "AVAILABLE")
      .reduce((sum, commission) => sum + commission.amount, 0),
    pending: memberCommissions
      .filter((commission) => commission.status === "PENDING")
      .reduce((sum, commission) => sum + commission.amount, 0),
    paid: memberCommissions
      .filter((commission) => commission.status === "PAID")
      .reduce((sum, commission) => sum + commission.amount, 0),
    directReferral: memberCommissions
      .filter((commission) => commission.commissionType === "DIRECT_REFERRAL")
      .reduce((sum, commission) => sum + commission.amount, 0),
  };
};

export const getMemberPoints = (
  state: ReferralSystemState,
  memberId: string
) =>
  state.points
    .filter((transaction) => transaction.userId === memberId)
    .reduce((sum, transaction) => sum + transaction.points, 0);

export const getMemberDashboardSummary = (
  state: ReferralSystemState,
  memberId: string
) => {
  const member = state.users.find((user) => user.id === memberId);

  if (!member) {
    throw new Error("Member not found.");
  }

  const tree = state.trees.find((item) => item.id === member.treeId);
  const treeMembers = getTreeMembers(state, member.treeId);
  const directPlacements = getPlacementChildren(state, member.id).length;
  const directReferrals = getMemberDirectReferrals(state, member.id).length;
  const earnings = getMemberEarnings(state, member.id);

  return {
    member,
    tree,
    totalTeamMembers: Math.max(treeMembers.length - 1, 0),
    directReferrals,
    directPlacements,
    treeSize: tree?.memberCount ?? treeMembers.length,
    treeCapacity: tree?.maxMembers ?? MAX_TREE_SIZE,
    availableTreeSpaces:
      (tree?.maxMembers ?? MAX_TREE_SIZE) - (tree?.memberCount ?? treeMembers.length),
    treeStatus: tree?.status ?? "INACTIVE",
    currentLevel: member.treeLevel,
    totalPoints: getMemberPoints(state, memberId),
    earnings,
  };
};

export const getAdminSummary = (state: ReferralSystemState) => ({
  totalMembers: state.users.length,
  totalReferralTrees: state.trees.length,
  activeTrees: state.trees.filter((tree) => tree.status === "ACTIVE").length,
  fullTrees: state.trees.filter((tree) => tree.status === "FULL").length,
  totalReferrals: state.users.filter((user) => user.sponsorId).length,
  totalCommissions: state.commissions.reduce(
    (sum, commission) => sum + commission.amount,
    0
  ),
  pendingCommissions: state.commissions
    .filter((commission) => commission.status === "PENDING")
    .reduce((sum, commission) => sum + commission.amount, 0),
  paidCommissions: state.commissions
    .filter((commission) => commission.status === "PAID")
    .reduce((sum, commission) => sum + commission.amount, 0),
  productSales: state.users.filter((user) => user.productLevel > 0).length,
  totalPoints: state.points.reduce(
    (sum, transaction) => sum + transaction.points,
    0
  ),
});

export const mockReferralTree = buildReferralTree(referralSystem, "user-1");
export const mockReferralLink = `angelfoods.com/register?ref=${referralSystem.users[0].referralCode}`;
