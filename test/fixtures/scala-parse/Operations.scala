class Worker:
  def run(): Unit = { val n = 1 }
  def this(x: Int) = { this(); val y = x }
  given ord: Ordering[Int] = (a, b) => a - b
  val fn: Int => Int = n => n + 1

object Demo:
  def noop(): Unit = helper(() => 1)
  given Ordering[Int] = Ordering.Int
  val count = 1
  def helper(f: () => Int): Int = f()
