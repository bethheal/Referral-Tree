# Welcome to your Expo app 👋

AngelFoods is an Expo SDK 54 mobile app with a Node.js/Prisma backend for Angelic Mkt members, referrals, products, and administration.

> Development only: the app is **not production-ready**. Production startup and unapproved payment, commission, and withdrawal operations are deliberately blocked.

## Project guidance

- [Readiness audit](APP_READINESS_AUDIT.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Business-rules approval document](BUSINESS_RULES_APPROVAL.md)
- [Pending owner decisions](PENDING_BUSINESS_DECISIONS.md)
- [Database and migration guide](DATABASE_AND_MIGRATION_GUIDE.md)
- [Payment and financial flow](PAYMENT_AND_FINANCIAL_FLOW.md)
- [Admin permission matrix](ADMIN_PERMISSION_MATRIX.md)
- [Testing and release checklist](TESTING_AND_RELEASE_CHECKLIST.md)

Use Node.js 22+ and install Expo-compatible packages with `npx expo install`.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the backend, then the app

   ```bash
   npm run backend:dev
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

For PostgreSQL development, create `backend/.env.development.local` using approved non-production values only. Do not commit or print it; see [backend/README.md](backend/README.md) and [DATABASE_AND_MIGRATION_GUIDE.md](DATABASE_AND_MIGRATION_GUIDE.md).

## Verification

```powershell
npm run backend:typecheck
npm run backend:test
npm run prisma:validate --prefix backend
npm run lint
```

Never run a production migration, reset, import, payment, or payout operation without explicit approval. Use reviewed Prisma migrations; do not use `prisma db push`. JSON storage is not a production datastore.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
