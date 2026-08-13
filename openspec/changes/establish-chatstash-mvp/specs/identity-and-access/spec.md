# Identity and Access Delta

## ADDED Requirements

### Requirement: Shared account identity

ChatStash SHALL use one Supabase Auth user identity across the Web Dashboard and Chrome Extension while maintaining a separate session in each client.

#### Scenario: Same account used in both clients

- **GIVEN** a user has a confirmed ChatStash account
- **WHEN** the user signs in with the same credentials on the Web Dashboard and the Extension
- **THEN** both clients SHALL operate on data owned by the same user ID
- **AND** neither client SHALL copy or read the other client's session storage

#### Scenario: Logging out one client

- **GIVEN** the user is signed in on both clients
- **WHEN** the user logs out from the Extension
- **THEN** the Extension session SHALL be removed
- **AND** the existing Web session SHALL remain usable until it independently expires or is logged out

### Requirement: MVP authentication methods

The Web Dashboard SHALL support email/password registration, sign-in, sign-out, email confirmation handling, and password recovery; the Extension SHALL support email/password sign-in and sign-out only.

#### Scenario: Confirmed user signs in from the Extension

- **GIVEN** an account whose email is confirmed
- **WHEN** valid email/password credentials are submitted in the Extension popup
- **THEN** the Extension SHALL establish and persist its own authenticated session
- **AND** SHALL never persist the submitted password

#### Scenario: Unconfirmed or invalid credentials

- **WHEN** Extension sign-in cannot establish an authenticated session
- **THEN** the popup SHALL show a non-sensitive actionable error
- **AND** no authenticated save request SHALL be possible

#### Scenario: Registration requested from the Extension

- **WHEN** a user without an account opens the Extension popup
- **THEN** the popup SHALL direct the user to the Web registration flow
- **AND** SHALL NOT implement a second registration or password recovery flow inside the Extension

### Requirement: Session persistence and expiry

Each client SHALL restore and refresh its own valid session and SHALL transition to an unauthenticated state when refresh or identity verification fails.

#### Scenario: Extension background restarts

- **GIVEN** a valid persisted Extension session
- **WHEN** the Manifest V3 background worker is stopped and later restarted
- **THEN** authenticated operations SHALL resume after the session is restored or refreshed
- **AND** the page content script SHALL not receive access or refresh tokens

#### Scenario: Session expires during an operation

- **WHEN** an authenticated operation fails because the session can no longer be refreshed
- **THEN** the client SHALL clear stale authentication state
- **AND** SHALL ask the user to sign in again without losing or logging the submitted conversation content

### Requirement: Protected Web access

The Dashboard SHALL prevent unauthenticated access to collection pages and SHALL not render another user's data during redirects or session refresh.

#### Scenario: Unauthenticated Dashboard request

- **WHEN** an unauthenticated browser requests a protected Dashboard route
- **THEN** the user SHALL be redirected to sign in
- **AND** no protected conversation, message, folder, or tag data SHALL be included in the response

### Requirement: Row-level user isolation

Every operation on profiles, folders, conversations, messages, tags, and conversation-tag relationships SHALL be authorized against the authenticated user at the database boundary.

#### Scenario: User reads owned data

- **GIVEN** user A is authenticated
- **WHEN** user A queries records owned by user A
- **THEN** allowed records SHALL be returned according to the requested operation

#### Scenario: User targets another user's record

- **GIVEN** user A is authenticated and a record is owned by user B
- **WHEN** user A attempts to select, insert a relationship to, update, or delete that record
- **THEN** the database SHALL reveal no protected data and SHALL reject any mutation

#### Scenario: Unauthenticated database request

- **WHEN** a request without an authenticated user targets user data or a protected RPC
- **THEN** the database SHALL return no user data
- **AND** SHALL perform no mutation

### Requirement: Browser credential boundary

Browser bundles SHALL contain only public Supabase connection configuration and SHALL not expose privileged secrets or user tokens to supported AI pages.

#### Scenario: Production bundle inspection

- **WHEN** a built Web or Extension bundle is inspected
- **THEN** it MAY contain the configured Supabase URL and publishable key or legacy anon key
- **AND** it SHALL NOT contain a Supabase secret key, service-role key, database password, or test user credential

#### Scenario: Content-script message is forged

- **WHEN** the Extension background receives a save or auth-related message originating from a content-script boundary
- **THEN** it SHALL validate the message against the allowed operation contract
- **AND** SHALL reject unknown operations, malformed fields, or unbounded payloads before a privileged request is made
