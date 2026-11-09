import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./src/generated/prisma/client.ts";
import { validateDatabaseEnvironment } from "./src/utils/databaseSafety.ts";

const database = validateDatabaseEnvironment();

if (database.target !== "angelfoods-dev" || !database.endpointId) {
  throw new Error("Refusing to query anything except the approved development target.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: database.databaseUrl }),
});

try {
  const administrators = await prisma.user.findMany({
    where: {
      role: {
        in: [
          "ADMIN",
          "SUPER_ADMIN",
          "FINANCE_ADMIN",
          "PRODUCT_MANAGER",
          "ORDER_MANAGER",
          "SUPPORT_ADMIN",
          "AUDITOR"
        ]
      }
    },
    select: {
      email: true,
      role: true,
      status: true
    },
    orderBy: { email: "asc" }
  });

  console.log(JSON.stringify({
    target: database.target,
    administrators
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
