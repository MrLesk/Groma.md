package md.groma.scanner

import scala.collection.mutable
import scala.meta.*

case class InvocationDecl(source: String, targets: List[String], line: Int, unresolved: Boolean, member: Option[String])

object Calls {
  def fromSource(source: Source, operations: List[OperationDecl]): List[InvocationDecl] = {
    val simpleCounts = mutable.Map.empty[String, Int].withDefaultValue(0)
    operations.foreach(operation => simpleCounts.update(operation.name.split('.').last, simpleCounts(operation.name.split('.').last) + 1))
    val bySimple = operations.groupBy(_.name.split('.').last)
    val calls = mutable.ListBuffer.empty[(Term.Apply, String)]
    collectCalls(source, calls)
    calls.toList.flatMap { case (apply, name) =>
      operations.find(operation => apply.pos.start >= operation.position && apply.pos.end <= operation.body.pos.end).toList.flatMap { caller =>
        val line = apply.pos.startLine + 1
        if (simpleCounts(name) != 1) List(InvocationDecl(caller.id, Nil, line, unresolved = true, member = Some(name)))
        else {
          val targets = bySimple(name).toList.map(_.id)
          List(InvocationDecl(caller.id, targets, line, unresolved = targets.isEmpty, member = Some(name)))
        }
      }
    }
  }

  private def collectCalls(tree: Tree, buffer: mutable.ListBuffer[(Term.Apply, String)]): Unit = tree match {
    case source: Source =>
      source.stats.foreach(collectCalls(_, buffer))
    case apply: Term.Apply if apply.fun.isInstanceOf[Term.Name] =>
      buffer += ((apply, apply.fun.asInstanceOf[Term.Name].value))
      collectCalls(apply.fun, buffer)
      apply.args.foreach(collectCalls(_, buffer))
    case other =>
      other.children.foreach(collectCalls(_, buffer))
  }
}
