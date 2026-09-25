object ApplyInfix:
  def run(n: Int): Int =
    val boxed = Box(1)
    n + 1

case class Box(value: Int)
