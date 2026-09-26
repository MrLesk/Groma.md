ThisBuild / scalaVersion := "3.9.0"
ThisBuild / organization := "md.groma"
ThisBuild / version := "0.1.0"

lazy val root = (project in file("."))
  .settings(
    name := "groma-scala-scanner-worker",
    libraryDependencies += "org.scalameta" %% "scalameta" % "4.13.4",
    assembly / mainClass := Some("md.groma.scanner.Main"),
    assembly / assemblyJarName := "worker.jar",
    assembly / assemblyMergeStrategy := {
      case PathList("META-INF", "MANIFEST.MF") => MergeStrategy.discard
      case PathList("META-INF", xs @ _*)         => MergeStrategy.discard
      case _                                     => MergeStrategy.first
    },
  )
