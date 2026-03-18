export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl select-none">📡</div>
        <h1 className="text-2xl font-bold tracking-tight">You&apos;re offline</h1>
        <p className="text-muted-foreground">
          Check your internet connection and try again. Your work is saved locally and will sync
          when you&apos;re back online.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
