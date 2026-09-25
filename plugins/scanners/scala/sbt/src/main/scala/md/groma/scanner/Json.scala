package md.groma.scanner

object Json {
  def string(text: String): String = encode(text)

  def array(values: Iterable[String]): String = values.mkString("[", ",", "]")

  def `object`(fields: Map[String, String]): String =
    fields.map { case (key, value) => s"${encode(key)}:$value" }.mkString("{", ",", "}")

  private def encode(text: String): String = {
    val output = new StringBuilder("\"")
    text.foreach { char =>
      if (char == '\\' || char == '"') output.append('\\').append(char)
      else if (char < ' ') output.append(f"\\u${char.toInt}%04x")
      else output.append(char)
    }
    output.append('"').toString
  }
}
