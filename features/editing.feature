Feature: Shape architecture through shared editing operations
  Scenario: Plan a relationship between existing components
    Given two observed sibling components
    When an architect drags a connection between them and saves its meaning
    Then core stores a draft relationship independently of its endpoints
    And selection and flow motion preserve its draft identity
    And only explicit acceptance makes the relationship current

  Scenario: Create software in context
    When an architect drops a component creation control onto a container
    Then saving creates a draft component owned by that container
    And core chooses its position

  Scenario: Name a group by enclosing its members
    When an architect draws around sibling components and saves a group name
    Then core groups those components and calculates the boundary
    And no gesture coordinates are stored

  Scenario: Edit saved meaning
    Given an architect opens Edit in the details pane
    When they cancel or submit invalid values
    Then saved architecture is unchanged
    When they save valid values
    Then the map and CLI read the same updated meaning
