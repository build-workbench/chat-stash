# Site Adapters Delta

## ADDED Requirements

### Requirement: MVP platform support

The Extension SHALL activate capture behavior only on the explicitly supported ChatGPT and DeepSeek web origins and SHALL select exactly one matching adapter for the current URL.

#### Scenario: Supported ChatGPT page

- **WHEN** the top-level page URL matches the configured `chatgpt.com` conversation origin
- **THEN** the ChatGPT adapter SHALL be selected

#### Scenario: Supported DeepSeek page

- **WHEN** the top-level page URL matches the configured `chat.deepseek.com` conversation origin
- **THEN** the DeepSeek adapter SHALL be selected

#### Scenario: Unsupported page

- **WHEN** no registered adapter matches the current top-level URL
- **THEN** ChatStash SHALL inject no save controls and SHALL perform no page extraction

### Requirement: Response discovery and pairing

Each enabled adapter SHALL discover visible assistant response targets and deterministically pair each target with the user prompt that produced it.

#### Scenario: Normal alternating conversation

- **GIVEN** a supported page exposes an ordered sequence of user and assistant turns
- **WHEN** an assistant target is discovered
- **THEN** the adapter SHALL pair it with the nearest valid preceding user turn in the same conversation branch

#### Scenario: Pair cannot be validated

- **WHEN** an adapter cannot unambiguously locate both a target assistant message and its corresponding user prompt
- **THEN** the target SHALL not be saveable
- **AND** a non-sensitive diagnostic SHALL identify the failed adapter capability

### Requirement: Resilient DOM selection

Adapters SHALL prefer semantic and stable attributes over generated class names and SHALL validate selector results before treating them as messages or mount points.

#### Scenario: Primary selector is present

- **WHEN** a primary semantic selector produces valid message elements
- **THEN** the adapter SHALL use those elements without invoking a weaker fallback

#### Scenario: Primary selector no longer matches

- **WHEN** the primary selector yields no valid targets but a documented fallback can validate the page structure
- **THEN** the adapter SHALL continue operating through that fallback
- **AND** development diagnostics SHALL indicate that fallback behavior was used

#### Scenario: Only ambiguous class matches remain

- **WHEN** candidate elements cannot be validated as user/assistant turns
- **THEN** the adapter SHALL fail closed and inject no misleading save target

### Requirement: Dynamic page lifecycle

Capture controls SHALL remain correct across initial asynchronous rendering, incremental message insertion, DOM replacement, infinite scrolling, and same-document navigation without observer leaks or duplicate controls.

#### Scenario: New response is appended

- **WHEN** a supported SPA appends a new assistant response
- **THEN** exactly one ChatStash control SHALL be attached to that target after bounded processing

#### Scenario: Existing response is re-rendered

- **WHEN** the host application replaces the DOM node for an already observed response
- **THEN** the stale control SHALL not be retained
- **AND** no more than one live control SHALL correspond to the replacement target

#### Scenario: SPA route changes

- **WHEN** navigation changes the source conversation without a full reload
- **THEN** the previous adapter lifecycle SHALL be cleaned up
- **AND** the current URL SHALL be matched and initialized again

#### Scenario: Extension context is disposed

- **WHEN** the content-script lifecycle ends or changes adapter
- **THEN** observers, timers, listeners, and injected roots owned by the previous lifecycle SHALL be released

### Requirement: Streaming detection

Each adapter SHALL report whether a specific assistant response is still changing, using platform signals plus bounded observation rather than a fixed global delay.

#### Scenario: Platform exposes an active generation control

- **WHEN** the adapter validates that the target response belongs to an active generation state
- **THEN** that response SHALL be reported as streaming

#### Scenario: Previously streaming response stabilizes

- **WHEN** platform generation signals clear and the target content reaches the adapter's completion condition
- **THEN** the response SHALL be reported as complete and become eligible for capture

### Requirement: Adapter fixture verification

Every enabled adapter SHALL be verifiable against repository-owned, sanitized DOM fixtures representing primary, fallback, streaming, and structurally invalid cases.

#### Scenario: Adapter contract test runs

- **WHEN** the adapter test suite is executed
- **THEN** it SHALL verify URL matching, target discovery, prompt pairing, extraction, streaming state, metadata, and mount-point behavior
- **AND** fixtures SHALL contain no real access tokens, account identifiers, or private conversations

### Requirement: Safe adapter diagnostics

Adapter failures SHALL identify platform, capability, selector tier, and error category without recording full user content.

#### Scenario: Platform DOM changes

- **WHEN** a required adapter capability fails its validation
- **THEN** development logs SHALL include the `[ChatStash]` prefix and enough structural context to locate the failing adapter
- **AND** production logs SHALL not include complete prompts, responses, HTML snapshots, tokens, or credentials
