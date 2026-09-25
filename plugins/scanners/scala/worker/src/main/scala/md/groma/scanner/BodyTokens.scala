package md.groma.scanner

import scala.collection.mutable
import scala.meta.*

object BodyTokens {
  def fromDeclaration(tree: Tree, body: Tree): Option[List[String]] = {
    val bindings = mutable.ArrayBuffer.empty[String]
    val output = mutable.ArrayBuffer.empty[String]
    tree match {
      case defn: Defn.Def =>
        bind(defn.paramss.flatten.map(_.name.value), bindings)
      case valDefn: Defn.Val =>
        valDefn.rhs match {
          case function: Term.Function =>
            bind(function.params.map(_.name.value), bindings)
          case _ => ()
        }
      case ctor: Ctor.Secondary =>
        bind(ctor.children.collect { case param: Term.Param => param.name.value }, bindings)
      case ga: Defn.GivenAlias =>
        ga.body match {
          case function: Term.Function =>
            bind(function.params.map(_.name.value), bindings)
          case _ => ()
        }
      case _ => ()
    }
    emit(body, bindings, output)
    Some(output.toList)
  }

  private def emit(tree: Tree, bindings: mutable.ArrayBuffer[String], output: mutable.ArrayBuffer[String]): Unit =
    tree match {
      case name: Term.Name =>
        output += slot(name.value, bindings)
      case select: Term.Select =>
        emit(select.qual, bindings, output)
        output += select.name.value
      case apply: Term.Apply =>
        emit(apply.fun, bindings, output)
        apply.args.foreach(emit(_, bindings, output))
      case infix: Term.ApplyInfix =>
        emit(infix.lhs, bindings, output)
        output += infix.op.value
        infix.args.foreach(emit(_, bindings, output))
      case block: Term.Block =>
        block.stats.foreach(stat => emit(stat, bindings, output))
      case function: Term.AnonymousFunction =>
        emit(function.body, bindings, output)
      case lit: Lit =>
        output += lit.syntax
      case other =>
        other.children.foreach(child => emit(child, bindings, output))
    }

  private def bind(names: List[String], bindings: mutable.ArrayBuffer[String]): Unit = bindings ++= names

  private def slot(name: String, bindings: mutable.ArrayBuffer[String]): String = {
    val index = bindings.indexOf(name)
    if (index >= 0) s"$$${index + 1}" else name
  }
}
