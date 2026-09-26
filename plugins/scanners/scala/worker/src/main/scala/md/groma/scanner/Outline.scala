package md.groma.scanner

import scala.collection.mutable
import scala.meta.*

case class OutlineMember(name: String, line: Int, visibility: String)

case class OutlineDecl(kind: String, name: String, line: Int, visibility: String, members: List[OutlineMember])

object Outline {
  def fromSource(source: Source): List[OutlineDecl] = {
    val buffer = mutable.ListBuffer.empty[OutlineDecl]
    val packageLeaf = Stats.packageLeaf(source.stats)
    walkStats(source.stats, packageLevel = true, packageLeaf, buffer)
    buffer.toList
  }

  private def walkStats(stats: List[Stat], packageLevel: Boolean, packageLeaf: Option[String], buffer: mutable.ListBuffer[OutlineDecl]): Unit =
    stats.foreach(stat => walkStat(stat, packageLevel, packageLeaf, buffer))

  private def walkStat(stat: Stat, packageLevel: Boolean, packageLeaf: Option[String], buffer: mutable.ListBuffer[OutlineDecl]): Unit = stat match {
    case pkg: Pkg =>
      val leaf = pkg.name.value.split('.').lastOption.orElse(packageLeaf)
      walkStats(pkg.body.stats, packageLevel = true, packageLeaf = leaf, buffer)
    case pkgObj: Pkg.Object if packageLevel && packageLeaf.contains(pkgObj.name.value) =>
      walkStats(pkgObj.templ.stats, packageLevel = true, packageLeaf, buffer)
    case pkgObj: Pkg.Object if packageLevel =>
      buffer += OutlineDecl("type", pkgObj.name.value, nameLine(pkgObj.name), Visibility.outline(pkgObj.mods), typeMembers(pkgObj.name.value, pkgObj.name, pkgObj.mods, pkgObj.templ.stats))
    case obj: Defn.Object if packageLevel && packageLeaf.contains(obj.name.value) =>
      walkStats(obj.templ.stats, packageLevel = true, packageLeaf, buffer)
    case obj: Defn.Object if packageLevel =>
      buffer += OutlineDecl("type", obj.name.value, nameLine(obj.name), Visibility.outline(obj.mods), typeMembers(obj.name.value, obj.name, obj.mods, obj.templ.stats))
    case cls: Defn.Class if packageLevel =>
      buffer += OutlineDecl("type", cls.name.value, nameLine(cls.name), Visibility.outline(cls.mods), typeMembers(cls.name.value, cls.name, cls.mods, cls.templ.stats))
    case trt: Defn.Trait if packageLevel =>
      buffer += OutlineDecl("type", trt.name.value, nameLine(trt.name), Visibility.outline(trt.mods), typeMembers(trt.name.value, trt.name, trt.mods, trt.templ.stats))
    case enm: Defn.Enum if packageLevel =>
      buffer += OutlineDecl("type", enm.name.value, nameLine(enm.name), Visibility.outline(enm.mods), typeMembers(enm.name.value, enm.name, enm.mods, enm.templ.stats))
    case defn: Defn.Def if packageLevel =>
      buffer += OutlineDecl("function", defn.name.value, nameLine(defn.name), Visibility.outline(defn.mods), Nil)
    case ga: Defn.GivenAlias if packageLevel =>
      Stats.givenName(ga).foreach { name =>
        buffer += OutlineDecl("function", name, nameLine(ga.name), Visibility.outline(ga.mods), Nil)
      }
    case g: Defn.Given if packageLevel =>
      Stats.givenName(g).foreach { name =>
        buffer += OutlineDecl("function", name, nameLine(Term.Name(name)), Visibility.outline(g.mods), Nil)
      }
    case valDefn: Defn.Val if packageLevel && Stats.functionValueRhs(valDefn.rhs) =>
      valDefn.pats.collectFirst { case term: Term.Name => term }.foreach { name =>
        buffer += OutlineDecl("function", name.value, nameLine(name), Visibility.outline(valDefn.mods), Nil)
      }
    case _ => ()
  }

  private def typeMembers(typeName: String, nameTree: Tree, mods: List[Mod], stats: List[Stat]): List[OutlineMember] = {
    val primary =
      if (mods.exists(_.isInstanceOf[Mod.Case]))
        List(OutlineMember(typeName, nameLine(nameTree), Visibility.outline(mods)))
      else Nil
    primary ++ stats.flatMap(memberStat)
  }

  private def memberStat(stat: Stat): List[OutlineMember] = stat match {
    case defn: Defn.Def =>
      List(OutlineMember(defn.name.value, nameLine(defn.name), Visibility.outline(defn.mods)))
    case ctor: Ctor.Secondary =>
      List(OutlineMember("this", nameLine(ctor), Visibility.outline(ctor.mods)))
    case ga: Defn.GivenAlias =>
      Stats.givenName(ga).toList.map(name => OutlineMember(name, nameLine(ga.name), Visibility.outline(ga.mods)))
    case g: Defn.Given =>
      Stats.givenName(g).toList.map(name => OutlineMember(name, nameLine(Term.Name(name)), Visibility.outline(g.mods)))
    case _ => Nil
  }

  private def nameLine(name: Tree): Int = name.pos.startLine + 1
}
