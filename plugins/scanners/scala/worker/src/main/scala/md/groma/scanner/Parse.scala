package md.groma.scanner

import scala.meta.*
import scala.meta.dialects.Scala3
import scala.meta.parsers.Parsed

case class ParsedFile(relative: String, source: Source)

case class ParseFailure(relative: String, line: Int, message: String)

object Parse {
  private given dialect: Dialect = Scala3

  def read(relative: String, text: String): Either[ParseFailure, ParsedFile] =
    text.parse[Source] match {
      case Parsed.Success(parsedTree) =>
        Right(ParsedFile(relative, parsedTree))
      case error: Parsed.Error =>
        Left(ParseFailure(relative, error.pos.startLine + 1, error.message))
    }
}
