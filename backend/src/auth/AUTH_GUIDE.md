# Authentication & Authorization Guide

This module implements JWT-based authentication and role-based access control (RBAC)
for the Monte backend, protecting API endpoints and user accounts.

## Endpoints

All routes are prefixed with `/api/auth` (the app has a global `api` prefix).

| Method | Path                    | Auth required | Description                                   |
| ------ | ----------------------- | -------------- | ---------------------------------------------- |
| POST   | `/auth/register`        | No             | Create an account, returns tokens             |
| POST   | `/auth/login`           | No             | Authenticate, returns tokens                  |
| POST   | `/auth/refresh`         | No             | Exchange a refresh token for a new token pair |
| POST   | `/auth/logout`          | Yes            | Revoke a single refresh token                 |
| POST   | `/auth/logout-all`      | Yes            | Revoke every refresh token for the user       |
| POST   | `/auth/forgot-password` | No             | Request a password reset email                |
| POST   | `/auth/reset-password`  | No             | Reset password using a valid reset token      |
| POST   | `/auth/change-password` | Yes            | Change password while logged in               |
| GET    | `/auth/me`               | Yes            | Get the current user's profile                |

## Token model

- **Access tokens** are short-lived JWTs (default 15 minutes, `JWT_ACCESS_EXPIRES_IN`),
  signed with `JWT_ACCESS_SECRET` (falls back to `JWT_SECRET`), and carry `sub`, `email`,
  and `role` claims. They are sent as `Authorization: Bearer <token>` and validated by
  `JwtStrategy` on every request.
- **Refresh tokens** are opaque, high-entropy random strings (not JWTs). Only their SHA-256
  hash is stored in the `refresh_tokens` table, alongside `expiresAt` and a `revoked` flag,
  so a database compromise does not leak usable tokens. They live 7 days and are rotated on
  every use: calling `/auth/refresh` revokes the presented token and issues a new pair
  (`replacedByTokenHash` links the chain for auditing/replay detection).
- Logging out, changing password, or resetting a password revokes refresh tokens
  (`AuthService.logoutAll`), effectively ending all sessions.
- Expired refresh and password-reset tokens are purged daily by `AuthTokenCleanupService`.

## Protecting endpoints

`JwtAuthGuard` is registered globally (`APP_GUARD` in `app.module.ts`), so **every**
endpoint in the API requires a valid access token by default. Use the `@Public()`
decorator to explicitly opt an endpoint out (used for register/login/refresh/password
reset). `RolesGuard`, also global, enforces `@Roles(Role.ADMIN)`-style decorators when
present; routes without a `@Roles()` decorator are open to any authenticated user.

```ts
@Roles(Role.ADMIN)
@Get('admin/reports')
getReports() { ... }
```

Use `@CurrentUser()` to access the authenticated principal (`{ userId, email, role }`) in
a handler.

## Password storage

Passwords are hashed with `bcrypt` (cost factor 12) before being persisted; the hash
column is excluded from default `SELECT`s (`select: false`) and only pulled in explicitly
during login/password-change flows.

## Rate limiting

`@nestjs/throttler` is registered globally with a default limit (100 req/min per client).
The auth endpoints most attractive to brute-force/credential-stuffing attacks
(`register`, `login`, `refresh`, `forgot-password`, `reset-password`) carry stricter,
per-route `@Throttle()` overrides.

## Password reset flow

1. `POST /auth/forgot-password` always returns `204` regardless of whether the email
   exists, to avoid account enumeration. If the account exists, a random reset token is
   generated, its hash stored with a 1-hour expiry, and an email is sent via
   `AuthMailService`.
2. `POST /auth/reset-password` validates the token (unused, unexpired), updates the
   password, marks the token used, and revokes all of the user's refresh tokens.
3. If SMTP is not configured (`SMTP_HOST` unset), `AuthMailService` logs the reset link
   instead of sending an email — useful for local development.

## RBAC

`Role` (`user`, `merchant`, `admin`) is stored on the `User` entity. New accounts default
to `user`. Promote a user to another role directly in the database or via an internal
admin tool; there is intentionally no public endpoint for self-assigning roles.

## Security considerations

- **CSRF**: the API is stateless and authenticated via a `Bearer` header rather than
  cookies, which is inherently immune to CSRF (browsers do not attach `Authorization`
  headers automatically). If a future web client moves refresh tokens into an `HttpOnly`
  cookie, pair it with the double-submit-cookie pattern or a `SameSite=Strict` cookie.
- **OAuth2/OIDC**: out of scope for this change. `AuthModule` exports `AuthService`
  cleanly so a future `OAuthModule` can issue the same token pair after a successful
  third-party handshake.
- **Enumeration**: login and forgot-password responses are deliberately generic
  (`Invalid email or password`, always-204) to avoid revealing which emails are
  registered.

## Environment variables

```
JWT_SECRET=...                # fallback signing secret
JWT_ACCESS_SECRET=...         # preferred signing secret for access tokens
JWT_ACCESS_EXPIRES_IN=15m
SMTP_HOST=...                 # optional; omit to log reset links instead of emailing
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=noreply@monte.io
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # used to build the reset-password link
```
