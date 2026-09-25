package md.groma.scanner

/** Output-only JSON for scan and outline responses. */
object Json {
  def encode(value: Any): String = value match {
    case null                     => "null"
    case text: String             => quote(text)
    case number: Int              => number.toString
    case number: Long             => number.toString
    case flag: Boolean            => flag.toString
    case list: List[_]            => list.map(encode).mkString("[", ",", "]")
    case array: Array[_]          => array.map(encode).mkString("[", ",", "]")
    case map: Map[String, ?]      =>
      map.map { case (key, entry) => s"${quote(key)}:${encode(entry)}" }.mkString("{", ",", "}")
    case other                    => throw new IllegalArgumentException(s"Unsupported JSON value: ${other.getClass}")
  }

  private def quote(text: String): String = {
    val output = new StringBuilder("\"")
    text.foreach { char =>
      if (char == '\\' || char == '"') output.append('\\').append(char)
      else if (char < ' ') output.append(f"\\u${char.toInt}%04x")
      else output.append(char)
    }
    output.append('"').toString
  }
}
