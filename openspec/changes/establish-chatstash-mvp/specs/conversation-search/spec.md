# Conversation Search Delta

## ADDED Requirements

### Requirement: Owned content search

The Dashboard SHALL search the authenticated user's conversation titles and stored message Markdown without returning another user's content.

#### Scenario: Title matches

- **WHEN** a non-empty query matches words or a meaningful substring in an owned conversation title
- **THEN** that conversation SHALL be eligible for the result set

#### Scenario: Message body matches

- **WHEN** a non-empty query matches words or a meaningful substring in either stored message of an owned conversation
- **THEN** that conversation SHALL be eligible for the result set only once

#### Scenario: Another user's content matches

- **WHEN** matching content exists only in another user's records
- **THEN** the query SHALL return no evidence of those records

### Requirement: Multilingual and literal query handling

Search SHALL produce useful matches for common English and Chinese text and SHALL safely handle punctuation and query syntax characters as user input.

#### Scenario: English keyword query

- **WHEN** the user enters one or more English terms
- **THEN** matching title and body tokens SHALL be returned without requiring exact case

#### Scenario: Chinese substring query

- **WHEN** the user enters a meaningful Chinese fragment present in a title or message
- **THEN** matching owned conversations SHALL be returned without requiring whitespace token boundaries

#### Scenario: Query contains quotes or operators

- **WHEN** the user enters punctuation or characters that could be interpreted as database query syntax
- **THEN** the search SHALL treat them through a bounded documented search parser
- **AND** SHALL not produce a database injection or unhandled server error

### Requirement: Query normalization

The client and database boundary SHALL trim a query, enforce its maximum length, and define empty-query behavior.

#### Scenario: Query is blank after trimming

- **WHEN** the search field is empty or whitespace-only
- **THEN** the Dashboard SHALL leave search mode and show the normal filtered conversation list

#### Scenario: Query exceeds the maximum

- **WHEN** a query is longer than the shared contract permits
- **THEN** it SHALL be rejected or truncated before database execution according to one consistent policy
- **AND** the UI SHALL communicate the limit

### Requirement: Search ranking and pagination

Search results SHALL use deterministic relevance ordering and cursor-compatible pagination.

#### Scenario: Title and body matches compete

- **WHEN** one result matches the title and another otherwise equivalent result matches only a message body
- **THEN** the title match SHALL rank higher

#### Scenario: Relevance is equal

- **WHEN** results have equal computed relevance
- **THEN** more recently saved results SHALL rank first
- **AND** a stable ID SHALL break any remaining tie

#### Scenario: Additional result pages are requested

- **GIVEN** the matching result set is not mutated between page requests
- **WHEN** more search results exist than fit on one page
- **THEN** requesting subsequent pages SHALL not duplicate or skip results for the unchanged query and filters

### Requirement: Search respects active organization filters

Search SHALL be combinable with the current owned folder and tag filters.

#### Scenario: Search within a folder and tag

- **WHEN** a query, folder, and tag filter are active
- **THEN** every result SHALL match the query, be directly assigned to that folder, and carry that tag

### Requirement: Search failure state

A failed search SHALL be distinguishable from a successful search with zero matches.

#### Scenario: No match exists

- **WHEN** search completes successfully with no owned matches
- **THEN** the Dashboard SHALL show a no-results state for the current query

#### Scenario: Search request fails

- **WHEN** search cannot complete due to a service or network error
- **THEN** the Dashboard SHALL show a retryable error
- **AND** SHALL not claim that there are no matches
