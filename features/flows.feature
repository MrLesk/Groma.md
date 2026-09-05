Feature: Read an authored architecture flow
  An architect follows a named scenario through its explicit connections.

  Scenario: Read and step through a flow in either viewer
    Given a flow with ordered steps over existing directed relationships
    And a component on the flow has other outgoing relationships
    When the architect opens the flow
    Then the viewer shows its purpose and ordered actions
    And only the authored connections belong to the flow
    When the architect selects a step
    Then its relationship and endpoints are emphasized
    And the map geometry remains unchanged
    When the architect inspects a component and returns to the flow
    Then the same flow and step remain selected

  Scenario: Resolve the flow in the current architecture revision
    Given a flow uses inline or reference-style Markdown endpoint links
    When core loads the architecture
    Then each step resolves exactly one existing directed relationship
    And missing or ambiguous relationships are rejected
    And the flow creates no C4 element or map route
