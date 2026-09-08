Feature: Change the blueprint editor presentation without changing architecture
  Scenario: Inspect one unsaved placement in three views
    Given a blueprint has been bound to the current project
    And its placement is previewed without being saved
    When the person switches from Isometric to 2D to Layers
    Then the same new parts and planned relationships remain in the preview
    And the current project and unsaved bindings remain unchanged
    And the inspector keeps its state

  Scenario: Return from Layers to the editing plane
    Given the person is looking at 2D with a chosen camera position
    When they press F2 twice
    Then Layers is shown between the two presses
    And the 2D camera position is restored

  Scenario: Continue navigating in each view
    Given a current element is selected
    When the person pans in Isometric or 2D
    Or orbits Layers and uses Shift-drag to pan it
    Then navigation changes only the presentation
    And a drag does not select a different element
