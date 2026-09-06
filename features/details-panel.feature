Feature: Read in the shared Web details panel

  Scenario: Expand the reader without losing architecture context
    Given an architect is reading an element, relationship, flow or task
    When they expand the details panel
    Then the same content has more reading space
    And the selection, hierarchy and map camera stay unchanged
    And the hierarchy remains available when there is enough screen space
    When they collapse the panel
    Then the reader returns to its compact width without losing its place

  Scenario: Use one width choice across details and code
    Given an architect has chosen a width for the details panel
    When they inspect a source file or task diff and return
    Then the panel keeps their width choice
    And the existing return navigation preserves the reading flow
    When they select another element, relationship, flow or task
    Then the same panel width choice still applies

  Scenario: Open code before choosing a panel width
    Given an architect has not chosen a panel width
    When they inspect a source file or task diff
    Then the shared panel expands for code reading
    When they return to the preceding details
    Then the panel returns to its compact width
