import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.STORAGE_MODE = "json";
for (const name of ["DATABASE_URL", "DIRECT_URL", "DATABASE_TARGET", "NEON_ENDPOINT_ID"]) delete process.env[name];
for (const name of ["SMS_PROVIDER", "SMS_LIVE_DELIVERY_ENABLED", "HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_SENDER_ID", "HUBTEL_API_BASE_URL"]) delete process.env[name];

const { HubtelSmsProvider, MockSmsProvider, SmsProviderError } = await import("../src/services/smsProvider.ts");

const mock = new MockSmsProvider();
mock.assertAvailable();
await mock.send({ to: "+233550000001", content: "test message" });

let outboundCalls = 0;
const disabled = new HubtelSmsProvider({
  liveDeliveryEnabled: false,
  clientId: "test-client",
  clientSecret: "test-secret",
  senderId: "AngelFoods",
  apiBaseUrl: "https://smsc.hubtel.com",
}, async () => {
  outboundCalls += 1;
  throw new Error("the disabled provider must not call fetch");
});
await assert.rejects(disabled.send({ to: "+233550000001", content: "code 123456" }), (error: unknown) =>
  error instanceof SmsProviderError && error.code === "SMS_DISABLED",
);
assert.equal(outboundCalls, 0, "disabled live delivery must make zero provider requests");

let requestDetails: { url: string; init: RequestInit } | undefined;
const enabled = new HubtelSmsProvider({
  liveDeliveryEnabled: true,
  clientId: "test-client",
  clientSecret: "test-secret",
  senderId: "AngelFoods",
  apiBaseUrl: "https://smsc.hubtel.com",
}, async (input, init) => {
  requestDetails = { url: String(input), init: init ?? {} };
  return new Response(JSON.stringify({ responseCode: "0000", data: { messageId: "mock-id", status: "Sent" } }), { status: 201 });
});
await enabled.send({ to: "+233550000001", content: "AngelFoods verification code: 123456." });
assert.equal(requestDetails?.url, "https://smsc.hubtel.com/v1/messages/send");
assert.equal(requestDetails?.init.method, "POST");
assert.equal(requestDetails?.init.redirect, "error");
const headers = new Headers(requestDetails?.init.headers);
assert.equal(headers.get("authorization"), `Basic ${Buffer.from("test-client:test-secret").toString("base64")}`);
assert.equal(new URL(requestDetails!.url).search, "", "credentials must not be sent in query parameters");
assert.deepEqual(JSON.parse(String(requestDetails?.init.body)), {
  from: "AngelFoods", to: "+233550000001", content: "AngelFoods verification code: 123456.",
});

const assertProviderError = async (provider: InstanceType<typeof HubtelSmsProvider>, code: string) => {
  await assert.rejects(provider.send({ to: "+233550000001", content: "code 123456" }), (error: unknown) =>
    error instanceof SmsProviderError && error.code === code &&
      !error.message.includes("test-secret") && !error.message.includes("123456"),
  );
};

await assertProviderError(new HubtelSmsProvider({
  liveDeliveryEnabled: true, clientId: "test-client", clientSecret: "test-secret",
  senderId: "AngelFoods", apiBaseUrl: "https://smsc.hubtel.com",
}, async () => new Response("provider detail containing test-secret", { status: 401 })), "SMS_REJECTED");

await assertProviderError(new HubtelSmsProvider({
  liveDeliveryEnabled: true, clientId: "test-client", clientSecret: "test-secret",
  senderId: "AngelFoods", apiBaseUrl: "https://smsc.hubtel.com",
}, async () => { throw new DOMException("private timeout detail", "TimeoutError"); }), "SMS_TIMEOUT");

await assertProviderError(new HubtelSmsProvider({
  liveDeliveryEnabled: true, clientId: "test-client", clientSecret: "test-secret",
  senderId: "AngelFoods", apiBaseUrl: "https://smsc.hubtel.com",
}, async () => new Response("not json", { status: 201 })), "SMS_INVALID_RESPONSE");

await assertProviderError(new HubtelSmsProvider({
  liveDeliveryEnabled: true, clientId: "test-client", clientSecret: "test-secret",
  senderId: "AngelFoods", apiBaseUrl: "https://smsc.hubtel.com",
}, async () => new Response(JSON.stringify({ message: "ok" }), { status: 201 })), "SMS_INVALID_RESPONSE");

console.log("Mock and Hubtel SMS adapter tests passed without network access.");
