package md.groma.scanner

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path}

object Scan {
  private val engineVersion = "4.13.4"

  def scanRoot(root: Path, relatives: List[String]): Map[String, Any] = {
    val files = List.newBuilder[Map[String, Any]]
    val operations = List.newBuilder[Map[String, Any]]
    val invocations = List.newBuilder[Map[String, Any]]
    val diagnostics = List.newBuilder[Map[String, Any]]
    val rootId = "scan"

    for (relative <- relatives if relative.nonEmpty) {
      val path = root.resolve(relative)
      if (!Files.isRegularFile(path)) throw new IllegalArgumentException(s"Missing source file: $relative")
      val text = Files.readString(path, StandardCharsets.UTF_8)
      Parse.read(relative, text) match {
        case Left(failure) =>
          diagnostics += Map(
            "severity" -> "warning",
            "code" -> "SCALA_SOURCE_INVALID",
            "message" -> s"${failure.relative}:${failure.line}: ${failure.message}",
            "file" -> failure.relative,
            "line" -> failure.line,
          )
        case Right(parsed) =>
          val symbols = Symbols.fromSource(relative, parsed.source).map(symbol =>
            Map("id" -> symbol.id, "name" -> symbol.name, "kind" -> symbol.kind),
          )
          files += Map("file" -> relative, "roots" -> List(rootId), "symbols" -> symbols)
          val fileOperations = Operations.fromSource(relative, parsed.source)
          fileOperations.foreach { operation =>
            val entry = Map[String, Any](
              "id" -> operation.id,
              "file" -> operation.file,
              "name" -> operation.name,
              "position" -> operation.position,
              "startLine" -> operation.startLine,
              "endLine" -> operation.endLine,
            )
            operations += operation.tokens.fold(entry)(tokens => entry + ("tokens" -> tokens))
          }
          Calls.fromSource(parsed.source, fileOperations).foreach { call =>
            invocations += Map(
              "source" -> call.source,
              "targets" -> call.targets,
              "line" -> call.line,
              "unresolved" -> call.unresolved,
            ) ++ call.member.map(name => Map("member" -> name)).getOrElse(Map.empty)
          }
      }
    }

    Map(
      "schemaVersion" -> 1,
      "scanner" -> Map(
        "id" -> "scala",
        "technology" -> "scala",
        "engine" -> "scalameta",
        "engineVersion" -> engineVersion,
      ),
      "roots" -> List(Map("id" -> rootId, "kind" -> "sbt-project", "name" -> "scan")),
      "files" -> files.result(),
      "operations" -> operations.result(),
      "invocations" -> invocations.result(),
      "diagnostics" -> diagnostics.result(),
    )
  }

  def outlineRoot(root: Path, relatives: List[String]): List[Map[String, Any]] =
    relatives.filter(_.nonEmpty).flatMap { relative =>
      val path = root.resolve(relative)
      if (!Files.isRegularFile(path)) throw new IllegalArgumentException(s"Missing source file: $relative")
      val text = Files.readString(path, StandardCharsets.UTF_8)
      Parse.read(relative, text).toOption.map { parsed =>
        val declarations = Outline.fromSource(parsed.source).map { decl =>
          Map(
            "kind" -> decl.kind,
            "name" -> decl.name,
            "line" -> decl.line,
            "visibility" -> decl.visibility,
            "members" -> decl.members.map(member => Map("name" -> member.name, "line" -> member.line, "visibility" -> member.visibility)),
          )
        }
        Map("file" -> relative, "declarations" -> declarations)
      }
    }
}
