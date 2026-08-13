# Markdown Export Delta

## ADDED Requirements

### Requirement: Single-conversation export

The Dashboard SHALL allow an authenticated user to download one owned conversation snapshot as a UTF-8 Markdown file without mutating stored data.

#### Scenario: Owned conversation is exported

- **WHEN** the user activates Export on an owned snapshot
- **THEN** one `.md` file SHALL be produced from the currently stored metadata and messages
- **AND** no export artifact SHALL be written back to the database

#### Scenario: Conversation is unavailable

- **WHEN** the requested snapshot is missing or not visible to the user
- **THEN** no file SHALL be produced
- **AND** the outcome SHALL not reveal whether another user owns the ID

### Requirement: Deterministic export document

The exported document SHALL have a deterministic, readable structure containing title, available source metadata, saved time, and every message in position order.

#### Scenario: Two-message MVP snapshot is exported

- **WHEN** the snapshot contains a user prompt and assistant response
- **THEN** the document SHALL begin with the snapshot title as an H1
- **AND** SHALL include source platform, canonical source URL, and saved timestamp
- **AND** SHALL include `## User` followed by the stored user Markdown
- **AND** SHALL include `## Assistant` followed by the stored assistant Markdown

#### Scenario: Optional metadata is absent

- **WHEN** an optional source conversation or message identifier is not stored
- **THEN** the export SHALL omit that metadata line rather than emit `null`, `undefined`, or a fabricated value

### Requirement: Markdown fidelity

Export SHALL preserve stored message Markdown verbatim apart from deterministic surrounding separators and a final newline.

#### Scenario: Message contains fenced code or tables

- **WHEN** the snapshot is exported
- **THEN** code fences, table syntax, links, and other stored Markdown SHALL not be converted through HTML or reformatted destructively

### Requirement: Safe export filename

The downloaded filename SHALL be derived from the title, remain recognizable, and be safe on common desktop filesystems.

#### Scenario: Title contains unsafe filename characters

- **WHEN** a title contains path separators, control characters, reserved names, or excessive length
- **THEN** those parts SHALL be removed or replaced
- **AND** the filename SHALL remain non-empty, bounded, and end in `.md`

#### Scenario: Sanitized title becomes empty

- **WHEN** no usable filename characters remain
- **THEN** a stable generic ChatStash filename SHALL be used

### Requirement: Stable time representation

Exported timestamps SHALL use an unambiguous representation independent of the browser's display locale.

#### Scenario: Saved time is rendered in export

- **WHEN** a valid saved timestamp is exported
- **THEN** it SHALL be represented as ISO 8601 including timezone information
