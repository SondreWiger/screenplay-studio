package no.northem.screenplaystudio

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import no.northem.screenplaystudio.data.Supabase
import no.northem.screenplaystudio.ui.AppRoot
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.ParameterizedRobolectricTestRunner

/**
 * Renders every main screen with the demo data, on a phone and on a tablet.
 * Doubles as a smoke test (each screen must compose without crashing) and as
 * the source for store screenshots.
 */
@RunWith(ParameterizedRobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ScreenshotTest(private val route: String) {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun demo() {
        Supabase.init(ApplicationProvider.getApplicationContext(), demoMode = true)
    }

    private fun shoot(device: String) {
        // The slate's timecode redraws every frame, so it never goes idle:
        // drive the clock by hand instead of waiting for idleness.
        compose.mainClock.autoAdvance = false
        compose.setContent { AppRoot(route.takeIf { it != "projects" }) }
        repeat(20) { compose.mainClock.advanceTimeBy(100) }
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/$device-$route.png")
    }

    @Test
    @Config(qualifiers = "w411dp-h822dp-xxhdpi")
    fun phone() = shoot("phone")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = shoot("tablet")

    companion object {
        @JvmStatic
        @ParameterizedRobolectricTestRunner.Parameters(name = "{0}")
        fun routes() = listOf("projects", "hub", "editor", "scenes", "shots", "schedule", "characters", "today", "slate", "settings")
            .map { arrayOf<Any>(it) }
    }
}
