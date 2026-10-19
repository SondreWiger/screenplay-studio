package no.northem.screenplaystudio.ui.projects

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import no.northem.screenplaystudio.data.Project
import no.northem.screenplaystudio.data.ProjectFormat
import no.northem.screenplaystudio.ui.components.FilterPill
import no.northem.screenplaystudio.ui.components.PrimaryButton
import no.northem.screenplaystudio.ui.friendly
import no.northem.screenplaystudio.ui.theme.SS

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewProjectSheet(onDismiss: () -> Unit, onCreate: suspend (String, ProjectFormat, String?) -> Project?) {
    var title by remember { mutableStateOf("") }
    var logline by remember { mutableStateOf("") }
    var format by remember { mutableStateOf(ProjectFormat.FEATURE) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    SSSheet("New project", onDismiss) {
        SheetField("Title", title, { title = it }, placeholder = "Untitled")
        Text("Format", style = MaterialTheme.typography.labelSmall, color = SS.textTertiary)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ProjectFormat.entries.forEach { f -> FilterPill(f.label, format == f, SS.accent) { format = f } }
        }
        SheetField("Logline", logline, { logline = it }, placeholder = "One sentence: who wants what, and what's in the way", singleLine = false)
        error?.let { Text(it, color = SS.danger, style = MaterialTheme.typography.bodySmall) }
        PrimaryButton("Create project", {
            busy = true
            scope.launch {
                try {
                    if (onCreate(title.trim(), format, logline) != null) onDismiss() else error = "Couldn't create the project."
                } catch (e: Exception) {
                    error = friendly(e)
                } finally { busy = false }
            }
        }, enabled = title.isNotBlank(), loading = busy)
    }
}

/** The app's standard bottom sheet: title, padded column, keyboard-aware. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SSSheet(title: String, onDismiss: () -> Unit, content: @Composable () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = SS.S900,
    ) {
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 28.dp).imePadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = SS.textPrimary)
            content()
        }
    }
}

@Composable
fun SheetField(label: String, value: String, onChange: (String) -> Unit, placeholder: String = "", singleLine: Boolean = true) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        placeholder = { Text(placeholder, color = SS.textTertiary) },
        singleLine = singleLine,
        minLines = if (singleLine) 1 else 2,
        shape = RoundedCornerShape(SS.radius),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = SS.elevated, unfocusedContainerColor = SS.elevated,
            focusedBorderColor = SS.accent, unfocusedBorderColor = SS.border, focusedLabelColor = SS.accent,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}
