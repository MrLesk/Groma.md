Feature: Opt-in Java source evidence
  Scenario: Scan a selected Java compilation source set
    Given a repository declares its Java source roots, release and dependency classpath
    And the Java scanner is explicitly enabled
    When the developer scans the repository
    Then every selected Java file has one placement
    And executable source declarations and supported canonical call targets are reported
    And virtual dispatch without a known implementation remains unresolved
    And the scanner does not run the repository build or annotation processors

  Scenario: Reject an incomplete Java compilation
    Given an enabled Java source set has a missing dependency or invalid source
    When the developer scans the repository
    Then the scan fails before reconciliation
    And existing architecture remains unchanged

  Scenario: Use a self-contained scanner with global Groma
    Given a developer has installed a platform Java scanner package with its runtime
    And no external Java, Node, Bun, Maven or Gradle executable is available
    When the standalone Groma binary scans a configured Java source set
    Then it produces the same Java observation as the source plugin
