Feature: Publish the Web view without a Groma server

  Scenario: Export the current architecture as a read-only static site
    Given a repository with architecture, mapped Backlog work, and architecture-owned source files
    When someone runs groma export with an output directory
    Then the directory contains the current interactive Web view
    And architecture, task details, task diffs, and owned source files remain readable
    And the published view cannot edit the repository
    And the published view does not require a running Groma server
