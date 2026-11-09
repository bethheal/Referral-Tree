import { env } from "../config/env.ts";
import { HttpError } from "../utils/http.ts";

export type SmsMessage = {
  to: string;
  content: string;
};

export interface SmsProvider {
  assertAvailable(): void;
  send(message: SmsMessage): Promise<void>;
}

export type HubtelSmsConfig = {
  liveDeliveryEnabled: boolean;
  clientId: string;
  clientSecret: string;
  senderId: string;
  apiBaseUrl: string;
  timeoutMs?: number;
};

export class SmsProviderError extends Error {
  readonly code: "SMS_DISABLED" | "SMS_REJECTED" | "SMS_TIMEOUT" | "SMS_INVALID_RESPONSE" | "SMS_UNAVAILABLE";

  constructor(code: SmsProviderError["code"]) {
    super("SMS delivery is unavailable.");
    this.name = "SmsProviderError";
    this.code = code;
  }
}

const isSafeHubtelBaseUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      (parsed.hostname === "hubtel.com" || parsed.hostname.endsWith(".hubtel.com")) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
      (parsed.pathname === "/" || parsed.pathname === "");
  } catch {
    return false;
  }
};

/** The local default deliberately accepts and discards messages without network or logging. */
export class MockSmsProvider implements SmsProvider {
  assertAvailable() {}

  async send(_message: SmsMessage) {}
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class HubtelSmsProvider implements SmsProvider {
  private readonly config: HubtelSmsConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HubtelSmsConfig, fetchImpl: typeof fetch = fetch) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    if (!isSafeHubtelBaseUrl(config.apiBaseUrl)) {
      throw new Error("HUBTEL_API_BASE_URL must be an HTTPS Hubtel host without a path or credentials.");
    }
    if (!/^[A-Za-z0-9]{1,11}$/.test(config.senderId)) {
      throw new Error("HUBTEL_SENDER_ID must be 1 to 11 letters or digits.");
    }
  }

  assertAvailable() {
    if (!this.config.liveDeliveryEnabled) throw new SmsProviderError("SMS_DISABLED");
    if (!this.config.clientId || !this.config.clientSecret || !this.config.senderId) {
      throw new SmsProviderError("SMS_UNAVAILABLE");
    }
  }

  async send(message: SmsMessage) {
    this.assertAvailable();
    const endpoint = new URL("/v1/messages/send", this.config.apiBaseUrl);
    const authorization = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64");

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 8_000),
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ from: this.config.senderId, to: message.to, content: message.content }),
      });
    } catch (error) {
      if (error instanceof SmsProviderError) throw error;
      if (isRecord(error) && (error.name === "TimeoutError" || error.name === "AbortError")) {
        throw new SmsProviderError("SMS_TIMEOUT");
      }
      throw new SmsProviderError("SMS_UNAVAILABLE");
    }

    if (!response.ok) throw new SmsProviderError("SMS_REJECTED");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SmsProviderError("SMS_INVALID_RESPONSE");
    }
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
    if (!data || typeof data.messageId !== "string" || !data.messageId || typeof data.status !== "string" || !data.status) {
      throw new SmsProviderError("SMS_INVALID_RESPONSE");
    }
  }
}

export const createSmsProvider = (
  config: {
    provider: string;
    liveDeliveryEnabled: boolean;
    clientId: string;
    clientSecret: string;
    senderId: string;
    apiBaseUrl: string;
  },
  fetchImpl: typeof fetch = fetch,
): SmsProvider => {
  if (config.provider === "mock") return new MockSmsProvider();
  if (config.provider === "hubtel") {
    return new HubtelSmsProvider({
      liveDeliveryEnabled: config.liveDeliveryEnabled,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      senderId: config.senderId,
      apiBaseUrl: config.apiBaseUrl,
    }, fetchImpl);
  }
  throw new Error("SMS_PROVIDER must be mock or hubtel.");
};

let activeProvider: SmsProvider = createSmsProvider({
  provider: env.smsProvider,
  liveDeliveryEnabled: env.smsLiveDeliveryEnabled,
  clientId: env.hubtelClientId,
  clientSecret: env.hubtelClientSecret,
  senderId: env.hubtelSenderId,
  apiBaseUrl: env.hubtelApiBaseUrl,
});

export const getSmsProvider = () => activeProvider;

/** Dependency injection is intentionally unavailable outside isolated tests. */
export const setSmsProviderForTests = (provider: SmsProvider) => {
  if (env.environment !== "test") throw new Error("SMS provider overrides are test-only.");
  activeProvider = provider;
};

export const assertSmsDeliveryAvailable = (provider: SmsProvider = activeProvider) => {
  try {
    provider.assertAvailable();
  } catch {
    throw new HttpError("OTP delivery is temporarily unavailable.", 503, "OTP_DELIVERY_FAILED");
  }
};

export const deliverRegistrationOtp = async (
  provider: SmsProvider,
  phoneNumber: string,
  otp: string,
  ttlSeconds: number,
) => {
  assertSmsDeliveryAvailable(provider);
  const minutes = Math.max(1, Math.ceil(ttlSeconds / 60));
  try {
    await provider.send({
      to: phoneNumber,
      content: `AngelFoods verification code: ${otp}. It expires in ${minutes} minutes.`,
    });
  } catch {
    throw new HttpError("OTP delivery is temporarily unavailable.", 503, "OTP_DELIVERY_FAILED");
  }
};
