// Match sbt 2.0.9 meta-build Scala so global plugins can load the jar.
ThisBuild / scalaVersion := "3.8.4"
ThisBuild / organization := "md.groma"
ThisBuild / version := "0.1.0"

lazy val root = (project in file("."))
  .enablePlugins(SbtPlugin)
  .settings(
    name := "groma-sbt",
    sbtPlugin := true,
    pluginCrossBuild / sbtVersion := "2.0.9",
  )
