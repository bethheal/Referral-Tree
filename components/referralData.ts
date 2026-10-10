import {
  getLevelRows,
  referralSystem as currentReferralSystem,
} from "./referralSystem";
import type { ReferralNodeData } from "./referralSystem";

export {
  buildReferralTree,
  findPlacementPosition,
  getAdminSummary,
  getMemberDashboardSummary,
  getMemberDirectReferrals,
  getMemberEarnings,
  getMemberPoints,
  getPlacementChildren,
  getReferralInitials,
  getTreeMembers,
  MAX_DIRECT_PLACEMENT_CHILDREN,
  MAX_TREE_SIZE,
  mockReferralLink,
  mockReferralTree,
  productConfigs,
  referralSystem,
  registerMember,
  updateCommissionStatus,
  updateMemberStatus,
  updateProductCommission,
  validateReferralIntegrity,
} from "./referralSystem";

export type {
  CommissionTransaction,
  CommissionType,
  PointTransaction,
  ProductConfig,
  ReferralMember,
  ReferralNodeData,
  ReferralSystemState,
  ReferralTreeRecord,
  TreePlacementRecord,
  TreeStatus,
} from "./referralSystem";

export const getReferralTotal = (tree: ReferralNodeData) => {
  const walk = (node: ReferralNodeData): number =>
    node.children.reduce((total, child) => total + 1 + walk(child), 0);

  return walk(tree);
};

export const getReferralLevelRows = (
  tree: ReferralNodeData,
  maxLevel = 6
) => getLevelRows(currentReferralSystem, tree.treeId, maxLevel);
