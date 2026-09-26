ThisBuild / scalaVersion := "3.9.0"
lazy val api = (project in file("api")).settings(name := "api")
lazy val worker = (project in file("worker")).settings(name := "worker").dependsOn(api)
