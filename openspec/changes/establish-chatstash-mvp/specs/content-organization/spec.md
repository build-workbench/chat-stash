# Content Organization Delta

## ADDED Requirements

### Requirement: Nested folder management

An authenticated user SHALL be able to create, rename, reparent, and delete folders at arbitrary valid nesting depth.

#### Scenario: Root folder is created

- **WHEN** the user creates a folder without a parent using a valid name
- **THEN** the folder SHALL appear at the root of that user's folder tree

#### Scenario: Child folder is created

- **WHEN** the user selects an owned folder as parent
- **THEN** the new folder SHALL appear directly below that parent

#### Scenario: Duplicate sibling name

- **WHEN** the user creates or renames a folder to the same normalized name as an existing sibling
- **THEN** the operation SHALL be rejected with a validation error

### Requirement: Folder hierarchy integrity

Folder parent relationships SHALL always remain within one user and SHALL never form a cycle.

#### Scenario: Folder is moved below its descendant

- **GIVEN** folder B is a descendant of folder A
- **WHEN** the user attempts to set B or any of B's descendants as A's parent
- **THEN** the database SHALL reject the operation
- **AND** the existing hierarchy SHALL remain unchanged

#### Scenario: Folder is its own parent

- **WHEN** a folder ID is submitted as its own parent ID
- **THEN** the database SHALL reject the operation

#### Scenario: Foreign parent is submitted

- **WHEN** a user submits a parent folder owned by another user
- **THEN** the relationship SHALL be rejected without revealing the foreign folder's metadata

### Requirement: Non-destructive folder deletion

Deleting a folder SHALL not delete conversations or descendant folders.

#### Scenario: Nested folder is deleted

- **GIVEN** a folder has a parent, direct child folders, and assigned conversations
- **WHEN** its owner deletes it
- **THEN** its direct child folders SHALL be reparented to the deleted folder's parent
- **AND** its directly assigned conversations SHALL move to All Saves with no folder
- **AND** the folder row SHALL be removed in the same transaction

#### Scenario: Root folder is deleted

- **WHEN** an owned root folder is deleted
- **THEN** its direct children SHALL become root folders
- **AND** its directly assigned conversations SHALL move to All Saves

#### Scenario: Promoting children would create a sibling-name conflict

- **GIVEN** deleting a folder would promote a child beside an existing folder with the same normalized name
- **WHEN** the owner requests deletion
- **THEN** the complete delete operation SHALL be rejected with a conflict outcome
- **AND** the folder hierarchy and conversation assignments SHALL remain unchanged

### Requirement: Conversation folder assignment

A snapshot SHALL belong to zero or one folder owned by the same user, and the user SHALL be able to move it or remove its folder assignment.

#### Scenario: Conversation is moved

- **WHEN** the owner selects a different owned folder
- **THEN** the snapshot SHALL appear in the destination folder and no longer in the previous folder view

#### Scenario: All Saves is selected

- **WHEN** the owner clears a snapshot's folder
- **THEN** the snapshot SHALL have no folder assignment but SHALL remain visible in All Saves

### Requirement: Tag management

An authenticated user SHALL be able to create, rename, and delete reusable tags whose normalized names are unique for that user.

#### Scenario: Tag is created

- **WHEN** the user submits a non-empty valid tag name not already used by that user
- **THEN** one owned tag SHALL be created

#### Scenario: Case or surrounding-space duplicate

- **WHEN** the submitted name differs from an existing owned tag only by supported case normalization or surrounding whitespace
- **THEN** a second tag SHALL not be created

#### Scenario: Tag is deleted

- **WHEN** the owner deletes a tag
- **THEN** the tag and all of its conversation relationships SHALL be removed
- **AND** the conversations themselves SHALL remain

### Requirement: Conversation tagging

The user SHALL be able to attach zero or more owned tags to an owned conversation and remove those relationships without duplicating them.

#### Scenario: Tag is attached twice

- **WHEN** the same owned tag is attached to the same owned snapshot more than once
- **THEN** exactly one relationship SHALL exist

#### Scenario: Cross-user relationship is attempted

- **WHEN** any conversation or tag in the requested relationship belongs to another user
- **THEN** the database SHALL reject the relationship

### Requirement: Folder and tag filtering

The conversation list SHALL support an active folder view and an active tag filter while preserving All Saves as the unfiltered folder view.

#### Scenario: Folder is selected

- **WHEN** an owned folder is selected
- **THEN** the list SHALL show snapshots directly assigned to that folder
- **AND** SHALL not implicitly include descendant folders in the MVP

#### Scenario: Tag is selected

- **WHEN** an owned tag is selected
- **THEN** the list SHALL show only snapshots carrying that tag

#### Scenario: Folder and tag are both selected

- **WHEN** both filters are active
- **THEN** the list SHALL show only snapshots satisfying both filters
