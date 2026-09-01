export type ReferralNodeData = {
  id: string;
  name: string;
  level: number;
  children: ReferralNodeData[];
};

export const mockReferralLink = "angelfoods.com/r/jennifer";

export const mockReferralTree: ReferralNodeData = {
  id: "A",
  name: "You",
  level: 0,
  children: [
    {
      id: "B",
      name: "Member B",
      level: 1,
      children: [
        {
          id: "E",
          name: "Member E",
          level: 2,
          children: [
            { id: "O", name: "Member O", level: 3, children: [] },
            { id: "P", name: "Member P", level: 3, children: [] },
          ],
        },
        {
          id: "F",
          name: "Member F",
          level: 2,
          children: [{ id: "Q", name: "Member Q", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "C",
      name: "Member C",
      level: 1,
      children: [
        {
          id: "G",
          name: "Member G",
          level: 2,
          children: [{ id: "R", name: "Member R", level: 3, children: [] }],
        },
        {
          id: "H",
          name: "Member H",
          level: 2,
          children: [{ id: "S", name: "Member S", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "D",
      name: "Member D",
      level: 1,
      children: [
        {
          id: "I",
          name: "Member I",
          level: 2,
          children: [{ id: "T", name: "Member T", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "J",
      name: "Member J",
      level: 1,
      children: [
        {
          id: "U",
          name: "Member U",
          level: 2,
          children: [{ id: "Y", name: "Member Y", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "K",
      name: "Member K",
      level: 1,
      children: [
        {
          id: "V",
          name: "Member V",
          level: 2,
          children: [{ id: "Z", name: "Member Z", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "L",
      name: "Member L",
      level: 1,
      children: [
        {
          id: "W",
          name: "Member W",
          level: 2,
          children: [{ id: "AA", name: "Member AA", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "M",
      name: "Member M",
      level: 1,
      children: [
        {
          id: "X",
          name: "Member X",
          level: 2,
          children: [{ id: "AB", name: "Member AB", level: 3, children: [] }],
        },
      ],
    },
    {
      id: "N",
      name: "Member N",
      level: 1,
      children: [{ id: "AE", name: "Member AE", level: 2, children: [] }],
    },
    { id: "AC", name: "Member AC", level: 1, children: [] },
    { id: "AD", name: "Member AD", level: 1, children: [] },
  ],
};

export const getReferralInitials = (name: string) => {
  if (name.toLowerCase() === "you") {
    return "Y";
  }

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export const getReferralLevelCounts = (tree: ReferralNodeData) => {
  const counts: Record<number, number> = {};

  const walk = (node: ReferralNodeData) => {
    if (node.level > 0) {
      counts[node.level] = (counts[node.level] ?? 0) + 1;
    }

    node.children.forEach(walk);
  };

  walk(tree);

  return counts;
};

export const getReferralTotal = (tree: ReferralNodeData) =>
  Object.values(getReferralLevelCounts(tree)).reduce(
    (total, count) => total + count,
    0
  );

export const getReferralLevelRows = (tree: ReferralNodeData, maxLevel = 3) => {
  const counts = getReferralLevelCounts(tree);

  return Array.from({ length: maxLevel }, (_, index) => {
    const level = index + 1;

    return {
      level,
      label: `Level ${level}`,
      people: counts[level] ?? 0,
    };
  });
};
