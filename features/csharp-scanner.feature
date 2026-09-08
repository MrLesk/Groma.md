Feature: Prepare and scan a supported C# project

  Scenario: Explicitly prepare a scanner for a globally installed Groma
    Given a developer has enabled the C# scanner package
    When the developer requests scanner setup
    Then setup checks the required .NET SDK and the prebuilt worker
    And downloading an SDK or restoring project packages requires explicit options
    And subsequent scans do not build the scanner or invoke package restore

  Scenario: Select a nested project without losing sibling sources
    Given a repository config selects a nested SDK-style C# project
    And that project references another project inside the repository
    When the developer scans the repository
    Then the observation retains the referenced project's physical C# files
    And all source paths are relative to the repository rather than the selected project

  Scenario: A failed or ambiguous compilation does not erase architecture
    Given the repository already has an architecture
    When a C# input is ambiguous, exceeds the declared limits, or fails compilation
    Then no complete C# observation is published
    And Groma does not reconcile an incomplete scanner result

  Scenario: Source targets do not masquerade as runtime dispatch
    Given C# code calls an implementation directly and through an interface
    When the developer scans it
    Then supported direct calls identify canonical executable declarations
    And unknown runtime dispatch remains unresolved
    And ordinary direct calls do not become architecture rows merely by existing
