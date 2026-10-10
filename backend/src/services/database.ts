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

    return JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Database;
  }
}

export const db = new JsonDatabase();
