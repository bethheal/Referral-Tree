# Registration SMS configuration

Registration uses the application's six-digit OTP and existing HMAC-hashed challenge lifecycle. It does not use Hubtel's separate four-digit OTP API.

In `development` and `test`, the default is `SMS_PROVIDER=mock` with `SMS_LIVE_DELIVERY_ENABLED=false`. The mock accepts and discards messages without making a network request, storing the OTP, or logging it. Test code can inject a sink to verify delivery behavior without exposing codes through the API.

The optional Hubtel standard SMS adapter sends an authenticated `POST` to `/v1/messages/send`. Its default base URL is `https://smsc.hubtel.com`; any configured base URL must use HTTPS and a Hubtel hostname. Hubtel's current standard SMS documentation describes Basic Authentication and the POST message body; Hubtel's endpoint guidance identifies the `smsc.hubtel.com` host. Sender IDs must be approved by Hubtel.

Environment variables are backend-only:

| Variable | Purpose | Default |
| --- | --- | --- |
| `SMS_PROVIDER` | `mock` or `hubtel` | `mock` in development/test; `hubtel` in production |
| `SMS_LIVE_DELIVERY_ENABLED` | Explicit live-request switch | `false` |
| `HUBTEL_CLIENT_ID` | Hubtel Basic Auth username | Unset |
| `HUBTEL_CLIENT_SECRET` | Hubtel Basic Auth password | Unset |
| `HUBTEL_SENDER_ID` | Approved Hubtel sender name | Unset |
| `HUBTEL_API_BASE_URL` | Hubtel API origin | `https://smsc.hubtel.com` |

Set all three Hubtel credential/sender values together. Credentials are never placed in URLs or returned to the mobile application. With live delivery disabled, the Hubtel adapter fails before `fetch`, even when credentials are present. Live delivery is restricted to development with PostgreSQL storage in this release; production registration remains disabled until a separate production review.

No real credentials have been created or configured, and no SMS request has been sent as part of this change.
