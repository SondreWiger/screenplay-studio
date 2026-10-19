package no.northem.screenplaystudio.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Whether the device has a usable network — the Android twin of
 * NetworkMonitor.swift. Coming back online drains the offline write queue and
 * lets the realtime socket reconnect straight away instead of on its backoff.
 */
object Connectivity {

    private val _online = MutableStateFlow(true)
    val online: StateFlow<Boolean> = _online.asStateFlow()

    private var registered = false

    fun init(context: Context) {
        if (registered) return
        val manager = context.getSystemService(ConnectivityManager::class.java) ?: return
        _online.value = manager.activeNetwork?.let(manager::getNetworkCapabilities)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) ?: true
        runCatching {
            manager.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) = changed(true)
                override fun onLost(network: Network) = changed(false)
            })
            registered = true
        }
    }

    private fun changed(online: Boolean) {
        val was = _online.value
        _online.value = online
        if (online && !was) {
            SyncQueue.drainSoon()
            Realtime.reconnectNow()
        }
    }
}
