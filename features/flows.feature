Feature: Read an authored architecture flow
  An architect follows a named scenario through its explicit connections.

  Scenario: Fit selected Web flows into the camera
    Given an architect has panned or zoomed the Web map
    When the architect selects a flow
    Then the camera centers and fits every component and route in that flow
    When the architect adds another flow to the selection
    Then every component and route of both flows fits together
    When the architect removes one selected flow
    Then the camera fits the remaining flow
    And the architecture geometry remains unchanged

  Scenario: Focus an architecture item in the Web map
    Given an architect is viewing the nested or separated architecture layers
    When the architect selects an architecture item
    Then the camera centers and adjusts zoom to fit its complete displayed body
    And selecting a system or container includes its contained architecture
    And the fitted content stays clear of the hierarchy and details panes

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

  Scenario: Return to a component while keeping the whole Web flow visible
    Given an architect is reading a component in the Web details pane
    When the architect opens one of its authored flows
    Then the flow reader offers a return to that component
    When the architect focuses a step
    Then every connection and endpoint in the flow stays highlighted
    And only the focused connection pulses continuously
    And the reader clearly marks the focused action
    And reduced motion keeps a static focus mark
    When the architect inspects an endpoint and returns to the flow
    Then the same step and original component return action remain available
    When the architect returns to the original component
    Then its details appear with the flow still highlighted
