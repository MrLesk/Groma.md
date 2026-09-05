Feature: Open Groma in a new project
  Scenario: Open an initialized project while its map is preparing
    Given a repository already has Groma project records
    When a developer opens the Web viewer before startup finishes
    Then Groma shows that the architecture is loading
    And opens the map automatically when preparation completes
    But a failed startup shows its reported error instead

  Scenario: Initialize before viewing architecture
    Given a repository has no Groma project records
    When a developer opens the Web or terminal viewer
    Then Groma offers project setup in that viewer's interface
    When the developer saves the project name and storage location
    Then Groma initializes the project through the shared initialization operation
    And scans the repository automatically before showing architecture

  Scenario: An existing folder is not proof of initialization
    Given a repository has a Groma folder without its required project records
    When a developer opens a viewer
    Then Groma offers setup instead of throwing a missing-file stack trace
    And setup keeps the existing storage location

  Scenario: A successful scan finds no components
    Given the automatic scan completes without finding components
    When the viewer opens
    Then it explains that no components were found and how to create architecture
    And any existing drafted architecture remains accessible
    When supported source is added
    Then the live map shows the scanned architecture

  Scenario: A scan fails
    When a scan prevents a viewer from starting
    Then Groma presents the failure in readable form
    And does not describe the project as empty
