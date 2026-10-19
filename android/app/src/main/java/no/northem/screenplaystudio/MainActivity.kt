package no.northem.screenplaystudio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.ui.graphics.toArgb
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.ui.AppRoot
import no.northem.screenplaystudio.ui.theme.SS

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        // The app is dark by design (as on iOS and the website), so the system
        // bars always use light icons.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(SS.background.toArgb()),
            navigationBarStyle = SystemBarStyle.dark(SS.background.toArgb()),
        )
        super.onCreate(savedInstanceState)
        Supabase.init(applicationContext, demoMode = intent.getBooleanExtra("ss-demo", false))
        val initialRoute = if (BuildConfig.DEBUG) intent.getStringExtra("ss-route") else null
        setContent { AppRoot(initialRoute) }
    }
}
