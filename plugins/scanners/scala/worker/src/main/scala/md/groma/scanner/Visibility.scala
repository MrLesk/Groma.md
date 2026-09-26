package md.groma.scanner

import scala.meta.*

object Visibility {
  def outline(mods: List[Mod]): String = {
    if (mods.exists { case Mod.Protected(_) => true; case _ => false }) "protected"
    else if (mods.exists {
      case mod: Mod.Private => mod.syntax.contains("[") && !mod.syntax.contains("this")
      case _                  => false
    }) "internal"
    else if (mods.exists { case Mod.Private(_) => true; case _ => false }) "private"
    else "public"
  }

}
