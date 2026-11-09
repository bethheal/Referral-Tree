import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.ts";
import type { AuditLog, Database, SecurityEvent } from "../models/types.ts";
import { createId, nowIso } from "../utils/crypto.ts";

const emptyDatabase = (): Database => ({
  auditLogs: [],
  cashOuts: [],
  leads: [],
  ledger: [],
  membershipPayments: [],
  memberships: [],
  revokedSessions: [],
  notification: [],
  registrations: [],
  securityEvents: [],
  users: [],
});

export class JsonDatabase {
  private filePath: string;
  private state: Database;

  constructor(filePath = env.databaseFile) {
    this.filePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    this.state = this.load();
  }

  get data() {
    return this.state;
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  reset() {
    this.state = emptyDatabase();
    this.save();
  }

  audit(entry: Omit<AuditLog, "id" | "createdAt">) {
    this.state.auditLogs.push({
      ...entry,
      id: createId("audit"),
      createdAt: nowIso(),
    });
    this.save();
  }

  securityEvent(entry: Omit<SecurityEvent, "id" | "createdAt">) {
    this.state.securityEvents.push({
      ...entry,
      id: createId("security"),
      createdAt: nowIso(),
    });
    this.save();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) {
      const state = emptyDatabase();
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2));
      return state;
    }

    const loaded = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Partial<Database>;
    return { ...emptyDatabase(), ...loaded };
  }
}

let jsonDatabase: JsonDatabase | undefined;
const getJsonDatabase = () => {
  if (env.storageMode !== "json" || !["development", "test"].includes(env.environment)) {
    throw new Error("JSON storage is only available when explicitly selected in development or test.");
  }
  jsonDatabase ??= new JsonDatabase();
  return jsonDatabase;
};

// Defer file creation until a JSON route actually accesses the store. Importing
// the router in PostgreSQL mode must not create or read a local JSON database.
export const db = new Proxy({} as JsonDatabase, {
  get(_target, property) {
    const database = getJsonDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
