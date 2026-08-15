Feature: Scan this repository once

  Scenario: Scan runs once and prints ok
    When someone runs groma scan
    Then the command prints ok and a short summary
    And the command exits
    And the output does not include elements, IDs, or a machine-readable architecture

  Scenario: Observed match refreshes only code
    Given an observed component with a matching code reference
    When Groma folds that candidate
    Then only the code frontmatter is refreshed
    And the body is unchanged

  Scenario: Ghost match stays planned
    Given a planned component whose kebab-case name matches a candidate
    When Groma folds that candidate
    Then the planned document gains code
    And the ghost stays planned

  Scenario: Unknown candidate becomes observed
    Given a candidate that is not in the world
    When Groma folds that candidate
    Then Groma writes a new observed file
    And the file id is the kebab-case of the recognizable name
