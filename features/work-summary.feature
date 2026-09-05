Feature: Follow work from the collapsed Backlog panel

  Scenario: Count the tasks currently shown on the map
    Given an architect has collapsed the Backlog panel
    And a mapped task has several assignees
    When the architect changes the task status filters
    Then the badge counts each matching mapped task once
    And the collapsed panel keeps its compact size

  Scenario: Notice changes without opening the panel
    Given the collapsed panel has loaded its initial work snapshot
    When a shown task changes
    Then the badge briefly signals the change and returns to its task count
    And hovering reveals the status breakdown and latest observed change
    When a shown task completes
    Then the badge briefly shows completion before returning to the filtered count
    And unchanged snapshots do not repeat the feedback
    And reduced motion keeps the current information without animation
