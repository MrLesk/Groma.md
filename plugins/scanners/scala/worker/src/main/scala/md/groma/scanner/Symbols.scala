package md.groma.scanner

import scala.collection.mutable
import scala.meta.*

case class FileSymbol(id: String, name: String, kind: String)

object Symbols {
  def fromSource(file: String, source: Source): List[FileSymbol] = {
    val buffer = mutable.ListBuffer.empty[FileSymbol]
    val packageLeaf = Stats.packageLeaf(source.stats)
    walkStats(file, source.stats, packageLevel = true, packageLeaf, buffer)
    buffer.toList
  }

  private def walkStats(
    file: String,
    stats: List[Stat],
    packageLevel: Boolean,
    packageLeaf: Option[String],
    buffer: mutable.ListBuffer[FileSymbol],
  ): Unit = stats.foreach(stat => walkStat(file, stat, packageLevel, packageLeaf, buffer))

  private def walkStat(
    file: String,
    stat: Stat,
    packageLevel: Boolean,
    packageLeaf: Option[String],
    buffer: mutable.ListBuffer[FileSymbol],
  ): Unit = stat match {
    case pkg: Pkg =>
      val leaf = pkg.name.value.split('.').lastOption.orElse(packageLeaf)
      walkStats(file, pkg.body.stats, packageLevel = true, packageLeaf = leaf, buffer)
    case pkgObj: Pkg.Object if packageLevel && packageLeaf.contains(pkgObj.name.value) =>
      walkStats(file, pkgObj.templ.stats, packageLevel = true, packageLeaf, buffer)
    case pkgObj: Pkg.Object if packageLevel =>
      add(file, pkgObj.name.value, "object", buffer)
    case obj: Defn.Object if packageLevel && packageLeaf.contains(obj.name.value) =>
      walkStats(file, obj.templ.stats, packageLevel = true, packageLeaf, buffer)
    case obj: Defn.Object if packageLevel =>
      add(file, obj.name.value, "object", buffer)
    case cls: Defn.Class if packageLevel =>
      add(file, cls.name.value, "class", buffer)
    case trt: Defn.Trait if packageLevel =>
      add(file, trt.name.value, "trait", buffer)
    case enm: Defn.Enum if packageLevel =>
      add(file, enm.name.value, "enum", buffer)
    case defn: Defn.Def if packageLevel =>
      add(file, defn.name.value, "def", buffer)
    case stat if packageLevel =>
      Stats.givenName(stat).foreach(name => add(file, name, "def", buffer))
    case _ => ()
  }

  private def add(file: String, name: String, kind: String, buffer: mutable.ListBuffer[FileSymbol]): Unit =
    buffer += FileSymbol(id = s"$file#$name", name = name, kind = kind)
}
