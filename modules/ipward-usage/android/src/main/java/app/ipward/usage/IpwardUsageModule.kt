package app.ipward.usage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class IpwardUsageModule : Module() {
  private val context: Context get() = requireNotNull(appContext.reactContext)

  private fun hasAccess(): Boolean {
    val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  }

  override fun definition() = ModuleDefinition {
    Name("IpwardUsage")

    Function("hasUsageAccess") { hasAccess() }

    Function("openUsageAccessSettings") {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("queryDailyUsage") { startMillis: Double, endMillis: Double ->
      val start = startMillis.toLong()
      val end = endMillis.toLong()
      require(start >= 0 && end > start && end <= System.currentTimeMillis() + 60_000 && end - start <= 31L * 86_400_000) { "Invalid usage range" }
      check(hasAccess()) { "Usage Access has not been granted" }
      val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end) ?: emptyList()
      stats.filter { it.totalTimeInForeground > 0L && it.packageName.isNotBlank() }
        .map { item ->
          val label = try {
            context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(item.packageName, 0)).toString()
          } catch (_: Exception) {
            item.packageName.substringAfterLast('.')
          }
          mapOf(
            "packageName" to item.packageName,
            "label" to label,
            "bucketStart" to item.firstTimeStamp.toDouble(),
            "bucketEnd" to item.lastTimeStamp.toDouble(),
            "foregroundMs" to item.totalTimeInForeground.toDouble(),
            "lastTimeUsed" to item.lastTimeUsed.toDouble()
          )
        }
    }
  }
}
