package md.groma.scanner

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path}
import scala.jdk.CollectionConverters.*

object Main {
  def main(args: Array[String]): Unit =
    try {
      if (args.length == 2 && args(0) == "outline") {
        val root = Path.of(args(1)).toRealPath()
        val relatives = stdinLines()
        println(Json.encode(Scan.outlineRoot(root, relatives)))
        return
      }
      if (args.length == 2 && args(0) == "scan") {
        val root = Path.of(args(1)).toRealPath()
        val relatives = stdinLines()
        println(Json.encode(Scan.scanRoot(root, relatives)))
        return
      }
      throw new IllegalArgumentException("Expected scan <root> or outline <root>")
    } catch {
      case error: Exception =>
        System.err.println(s"SCALA_SCAN_FAILED: ${error.getMessage}")
        sys.exit(2)
    }

  private def stdinLines(): List[String] =
    scala.io.Source.fromInputStream(System.in, StandardCharsets.UTF_8.name()).getLines().toList.filter(_.nonEmpty)
}
