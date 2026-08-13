# Conversation Library Delta

## ADDED Requirements

### Requirement: Owned conversation list

The Dashboard SHALL show the authenticated user's conversation snapshots ordered by most recently saved first, with deterministic pagination.

#### Scenario: User has saved conversations

- **WHEN** the user opens All Saves
- **THEN** the first page SHALL show only that user's snapshots ordered by `saved_at` descending
- **AND** records with equal `saved_at` SHALL use a stable ID tie-breaker

#### Scenario: More records exist

- **WHEN** a page reaches the configured page size and older records exist
- **THEN** the user SHALL be able to request the next cursor page without seeing duplicates or skipping records

#### Scenario: User has no conversations

- **WHEN** the authenticated user owns no snapshots matching the current view
- **THEN** the Dashboard SHALL show an empty state explaining how to save the first conversation

### Requirement: Conversation summary

Each list item SHALL expose enough metadata to identify the snapshot without rendering the complete message bodies.

#### Scenario: Summary is rendered

- **WHEN** a snapshot appears in the list
- **THEN** it SHALL show title, source platform, saved time, and associated folder/tags where present
- **AND** any content preview SHALL be bounded and derived as plain text

### Requirement: Conversation detail

The Dashboard SHALL render an owned snapshot with its metadata and messages in ascending position order.

#### Scenario: Owned detail is opened

- **WHEN** the authenticated user opens a snapshot they own
- **THEN** the title, source, saved time, folder, tags, source link, and all stored messages SHALL be shown
- **AND** each message SHALL be labeled by role and rendered from its Markdown source

#### Scenario: Missing or unowned detail is requested

- **WHEN** a snapshot ID does not exist or is not visible to the authenticated user
- **THEN** the Dashboard SHALL show the same not-found outcome
- **AND** SHALL not reveal whether another user owns that ID

### Requirement: Safe Markdown presentation

Stored Markdown SHALL be rendered without executing embedded HTML, scripts, event handlers, or unsafe URL protocols.

#### Scenario: Markdown contains raw HTML or script-like text

- **WHEN** the detail view renders that message
- **THEN** unsafe raw HTML SHALL be escaped, omitted, or sanitized according to one documented policy
- **AND** no script or event handler SHALL execute

#### Scenario: Markdown contains GFM and code blocks

- **WHEN** a valid owned message is rendered
- **THEN** headings, lists, tables, links, blockquotes, inline code, and fenced code blocks SHALL remain readable
- **AND** syntax highlighting SHALL not require evaluating the content

### Requirement: Source navigation

The detail view SHALL allow the user to open a valid stored source URL while making the destination explicit.

#### Scenario: Valid source URL is present

- **WHEN** the user activates the source link
- **THEN** the canonical HTTPS source page SHALL open in a separate browser context
- **AND** the opener SHALL not gain control of the Dashboard window

### Requirement: Conversation deletion

An authenticated user SHALL be able to permanently delete one owned snapshot after an explicit confirmation.

#### Scenario: Deletion is confirmed

- **WHEN** the owner confirms deletion
- **THEN** the conversation, its messages, and its tag relationships SHALL be removed atomically
- **AND** unrelated folders and tag definitions SHALL remain

#### Scenario: Deletion fails

- **WHEN** the database rejects or cannot complete deletion
- **THEN** the item SHALL remain visible after reconciliation
- **AND** the Dashboard SHALL offer a safe retry

### Requirement: Standard asynchronous states

List and detail operations SHALL distinguish loading, empty, success, not-found, authentication-expired, and retryable-error outcomes.

#### Scenario: Data request fails temporarily

- **WHEN** an authenticated list or detail request fails due to a retryable service or network error
- **THEN** the existing confirmed data SHALL not be replaced by a false empty state
- **AND** the user SHALL receive a retry action
