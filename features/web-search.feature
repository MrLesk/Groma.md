Feature: Find architecture and optional work from the Web header

  Scenario: Find and open a task from the work-source plugin
    Given an architect is viewing the current architecture
    And a work-source plugin supplies tasks in different statuses
    When the architect searches for a task ID or title
    Then matching tasks appear alongside matching architecture
    And tasks remain searchable regardless of their status or map pins
    When the architect chooses a task
    Then the existing details pane shows that task
    And its mapped architecture is highlighted when available
    And choosing the same task again keeps it open

  Scenario: Typing keeps the map still
    Given an architect is searching the Web view
    When the architect types or changes the query
    Then the result list has no selected row
    And the map camera does not move
    When the architect presses Down
    Then the first result is selected and previewed

  Scenario: Cancel a temporary search preview
    Given an architect has an architecture selection or task open
    When the architect previews search results and cancels search
    Then the previous selection, details, and camera are restored
    And active tasks and flows are unchanged

  Scenario: Search architecture without a work-source plugin
    Given no work-source plugin supplies tasks
    When an architect searches the Web view
    Then architecture search remains available
    And there are no task results
