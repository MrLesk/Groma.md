Feature: Place reusable architecture intent without changing current knowledge
  Scenario: Copy a pattern into a different project
    Given a source fixture has a saved-card-checkout blueprint
    And a receiving fixture has differently named existing components
    When the reader copies the blueprint and pastes it into the receiving project
    And binds each existing role and the new component's parent
    Then preview shows proposed parts and relationships without saving
    When the reader confirms creation
    Then one independent local draft is saved
    And current identities, explanations, relationships and source evidence are unchanged
    And reloading retains that fixture draft

  Scenario: Reject an incomplete placement
    Given a blueprint has an unbound required role
    When the reader requests a preview
    Then the missing binding is explained
    And the project is unchanged

  Scenario: Reuse the same pattern twice
    Given one draft was created from a blueprint
    When the reader places the same blueprint again
    Then the new draft and new parts have distinct local identities
    And an existing component may participate in both without reassignment

  Scenario: A save cannot be persisted
    Given a complete placement has been previewed
    When fixture storage refuses the write
    Then no partial draft becomes visible
    And the pending placement remains available
