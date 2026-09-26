package md.groma.scanner

import scala.meta.*

object Stats {
  def packageLeaf(stats: List[Stat]): Option[String] =
    stats.collectFirst { case pkg: Pkg => pkg.name.value.split('.').lastOption }.flatten

  def givenName(stat: Stat): Option[String] = stat match {
    case ga: Defn.GivenAlias if ga.name.value.nonEmpty && ga.name.value != "_" => Some(ga.name.value)
    case g: Defn.Given if g.name.value.nonEmpty && g.name.value != "_"         => Some(g.name.value)
    case _                                                                       => None
  }

  def functionValueRhs(rhs: Tree): Boolean = rhs match {
    case _: Term.AnonymousFunction => true
    case _: Term.Function            => true
    case _                           => false
  }
}
