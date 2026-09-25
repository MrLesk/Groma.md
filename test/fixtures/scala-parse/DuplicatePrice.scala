object Dup:
  def price(): Int = 1
  def price(x: Int): Int = x
  def run(): Unit = price()
