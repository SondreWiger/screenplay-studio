import Foundation
import Security

/// Keychain storage for the auth session.
///
/// Sessions live here rather than in `UserDefaults` because they contain bearer
/// tokens. `kSecAttrAccessibleAfterFirstUnlock` lets a background refresh read
/// them without the device being unlocked at that moment, and keeps them off
/// any backup restored to a different device.
///
/// Every call reports its `OSStatus`. An earlier version discarded it, which
/// meant a failed write looked identical to a successful one — the session
/// simply wasn't there on the next launch, and the app asked for a password
/// again with no indication why.
enum KeychainStore {

    private static let service = "no.northem.screenplaystudio"

    @discardableResult
    static func set(_ data: Data, for account: String) -> OSStatus {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]

        // Update first; most saves are a token refresh replacing an existing item.
        let updateStatus = SecItemUpdate(
            query as CFDictionary,
            [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
            ] as CFDictionary
        )

        if updateStatus == errSecSuccess {
            return errSecSuccess
        }

        // Anything other than "not found" means the existing item is unusable —
        // wrong accessibility class, corrupted, or written by an older build.
        // Clear it rather than leaving the app permanently unable to save.
        if updateStatus != errSecItemNotFound {
            SecItemDelete(query as CFDictionary)
        }

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock

        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
        if addStatus != errSecSuccess {
            Task {
                await Diagnostics.shared.record(
                    "keychain",
                    "could not save \(account): \(describe(addStatus))",
                    isFailure: true
                )
            }
        }
        return addStatus
    }

    static func get(_ account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess else {
            if status != errSecItemNotFound {
                Task {
                    await Diagnostics.shared.record(
                        "keychain",
                        "could not read \(account): \(describe(status))",
                        isFailure: true
                    )
                }
            }
            return nil
        }
        return result as? Data
    }

    static func delete(_ account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }

    /// Readable form of the handful of statuses that actually come up.
    static func describe(_ status: OSStatus) -> String {
        switch status {
        case errSecSuccess:            return "ok"
        case errSecItemNotFound:       return "not found"
        case errSecDuplicateItem:      return "duplicate item"
        case errSecInteractionNotAllowed: return "device locked"
        case errSecAuthFailed:         return "authentication failed"
        case -34018:                   return "missing entitlement (app is not signed with a keychain group)"
        default:
            let message = SecCopyErrorMessageString(status, nil) as String? ?? "unknown"
            return "\(message) (\(status))"
        }
    }

    /// Round-trips a value to prove the keychain is actually usable.
    static func selfTest() -> String {
        let account = "selftest"
        let payload = Data("screenplay-studio".utf8)

        let writeStatus = set(payload, for: account)
        guard writeStatus == errSecSuccess else {
            return "write failed — \(describe(writeStatus))"
        }
        guard let read = get(account) else {
            return "wrote ok but read back nothing"
        }
        delete(account)
        return read == payload ? "ok" : "read back wrong data"
    }
}
