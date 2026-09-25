package md.groma.scanner

import sbt.*
import sbt.Keys.*

object GromaPlugin extends AutoPlugin {
  override def trigger = allRequirements
  override def requires = plugins.JvmPlugin

  override def globalSettings: Seq[Setting[?]] = Seq(
    commands += gromaModelCommand,
  )

  private def gromaModelCommand: Command = Command.command("gromaModel") { state =>
    val extracted = Project.extract(state)
    val structure = extracted.structure
    val buildRoot = extracted.get(sbt.ThisBuild / Keys.baseDirectory).getAbsolutePath
    val projects = structure.allProjectRefs.map { reference =>
      val id = reference.project
      val name = extracted.get(reference / Keys.name)
      val base = extracted.get(reference / Keys.baseDirectory).getAbsolutePath
      val scalaVersion = extracted.get(reference / Keys.scalaVersion)
      val unmanaged = extracted.get(reference / Compile / Keys.unmanagedSourceDirectories).map(_.getAbsolutePath)
      val managed = extracted.get(reference / Compile / Keys.managedSourceDirectories)
      Map(
        "id" -> Json.string(id),
        "name" -> Json.string(name),
        "base" -> Json.string(base),
        "scalaVersion" -> Json.string(scalaVersion),
        "unmanagedSourceDirectories" -> Json.array(unmanaged.map(Json.string)),
        "hasManagedSources" -> (if (managed.nonEmpty) "true" else "false"),
      )
    }
    val document = Map(
      "buildRoot" -> Json.string(buildRoot),
      "projects" -> Json.array(projects.map(Json.`object`)),
    )
    println(Json.`object`(document))
    state
  }
}
