package shop

class Orders:
  def place(): Unit = ()
  private def audit(): Unit = ()
  protected def first(): Unit = ()
  private[shop] def count(): Unit = ()
  class Nested:
    class Inner

case class Receipt(label: String):
  def this() = this("default")
  def this(name: String, extra: Int) = this(name)

enum Status:
  case Open
  def label: String = "open"

def ship(): Unit = ()

type Alias = Int

val total: Int = 1
