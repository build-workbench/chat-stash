# Conversation Capture Delta

## ADDED Requirements

### Requirement: Explicit single-exchange capture

ChatStash SHALL save content only after an explicit user action, and one save action SHALL create an immutable snapshot containing exactly the selected completed assistant response and its corresponding preceding user prompt.

#### Scenario: User saves a completed response

- **GIVEN** a supported page contains a user prompt followed by a completed assistant response
- **WHEN** the user clicks the ChatStash save control attached to that response
- **THEN** one conversation snapshot SHALL be created with two ordered messages
- **AND** message position 0 SHALL have role `user`
- **AND** message position 1 SHALL have role `assistant`

#### Scenario: Page is merely viewed

- **WHEN** a user opens or navigates within a supported AI page without clicking Save
- **THEN** ChatStash SHALL NOT upload or persist prompt or response content

#### Scenario: Earlier response is selected in a multi-turn chat

- **GIVEN** a source conversation contains multiple user/assistant turns
- **WHEN** the user saves an earlier assistant response
- **THEN** the snapshot SHALL contain the user prompt paired with that particular response
- **AND** SHALL NOT silently include later or unrelated turns

### Requirement: Completed-response gate

The save action SHALL be unavailable while the target response is streaming or otherwise incomplete.

#### Scenario: Response is streaming

- **WHEN** the selected assistant response is still being generated
- **THEN** the save control SHALL be disabled or SHALL reject the action before extraction
- **AND** no save request SHALL reach the database

#### Scenario: Streaming finishes

- **WHEN** the adapter confirms that the response is complete
- **THEN** the save control SHALL become available without requiring a full page reload

### Requirement: Markdown-first capture payload

Every captured message SHALL be persisted as non-empty Markdown, preserving meaningful headings, emphasis, lists, blockquotes, links, tables, inline code, fenced code blocks, and formula source when the supported page exposes sufficient semantics.

#### Scenario: Rich response is captured

- **GIVEN** a response contains supported rich-text structures
- **WHEN** the response is saved
- **THEN** the stored Markdown SHALL preserve their textual meaning and ordering
- **AND** copied site controls, scripts, styles, hidden labels, and save/copy buttons SHALL not appear in the stored content

#### Scenario: Platform-specific rich structure cannot be converted

- **WHEN** a platform exposes content that cannot be safely converted with known rules
- **THEN** ChatStash SHALL preserve readable text rather than save executable or raw untrusted HTML
- **AND** SHALL report a development diagnostic without logging the full conversation content

#### Scenario: Extracted link uses an unsafe protocol

- **WHEN** extracted content contains a link using an executable, local-file, or otherwise unsupported URL protocol
- **THEN** the stored Markdown SHALL preserve readable link text without preserving an actionable unsafe destination

### Requirement: Canonical source metadata

Each snapshot SHALL store the source platform, a canonical source URL, a title, and available source conversation/message identifiers.

#### Scenario: URL contains query parameters or a fragment

- **WHEN** source metadata is prepared for saving
- **THEN** the stored URL SHALL use an allowed HTTPS host and retain only the platform-approved path and explicitly allowlisted query parameters needed to return to the conversation
- **AND** embedded credentials, fragments, tracking parameters, and all other query parameters SHALL be removed

#### Scenario: Optional source identifier is unavailable

- **WHEN** the adapter cannot obtain a stable source conversation or message identifier from visible page semantics
- **THEN** saving SHALL still be possible using the content-derived deduplication fallback
- **AND** the unavailable identifier SHALL remain absent rather than be fabricated

### Requirement: Atomic save

A valid capture SHALL persist its conversation row and both message rows in one database transaction.

#### Scenario: All writes succeed

- **WHEN** the database accepts a valid capture
- **THEN** the result SHALL identify the saved conversation
- **AND** subsequent reads SHALL return the conversation with both ordered messages

#### Scenario: Any write fails

- **WHEN** the conversation or either message cannot be persisted
- **THEN** the transaction SHALL leave no partial conversation or partial message set
- **AND** the Extension SHALL show a retryable error

### Requirement: Idempotent save

Saving the same source response more than once for the same user SHALL resolve to one conversation snapshot.

#### Scenario: Repeated click or retry

- **GIVEN** a capture was already saved for the authenticated user
- **WHEN** the identical capture is submitted again, sequentially or concurrently
- **THEN** the database SHALL retain exactly one matching conversation and one pair of messages
- **AND** the response SHALL return the existing conversation ID with a duplicate outcome

#### Scenario: Same source response saved by different users

- **WHEN** two users independently save the same public source response
- **THEN** each user SHALL receive a separately owned snapshot

#### Scenario: Distinct response in the same source conversation

- **WHEN** the user saves two distinct assistant responses from one source conversation
- **THEN** each response SHALL produce its own snapshot and deduplication identity

### Requirement: Capture validation limits

The trusted save boundary SHALL reject malformed, unsupported, empty, or unreasonably large captures before persistence.

#### Scenario: Malformed role or message count

- **WHEN** a capture does not contain exactly one user message followed by exactly one assistant message
- **THEN** it SHALL be rejected without creating data

#### Scenario: Unsupported platform or source host

- **WHEN** the declared platform and canonical source host do not match an enabled adapter
- **THEN** the capture SHALL be rejected without making a database mutation

#### Scenario: Oversized content

- **WHEN** a title, URL, identifier, message, or total payload exceeds the documented contract limit
- **THEN** the capture SHALL be rejected with a bounded validation error

### Requirement: Save interaction states

The injected save control SHALL expose mutually exclusive idle, saving, saved, duplicate, unavailable, and error states and SHALL prevent multiple in-flight requests for the same target.

#### Scenario: Save succeeds

- **WHEN** a new capture is saved
- **THEN** the target control SHALL show a success state
- **AND** SHALL not immediately submit the same target again

#### Scenario: Duplicate is detected

- **WHEN** the database reports that the capture already exists
- **THEN** the target control SHALL show an already-saved state rather than an error

#### Scenario: Retryable failure

- **WHEN** extraction, authentication, network access, or persistence fails without creating data
- **THEN** the user SHALL receive a concise reason and a retry action where retry is safe
- **AND** logs SHALL omit full prompt and response bodies
