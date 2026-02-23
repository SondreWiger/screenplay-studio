export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-950">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-surface-700 border-t-brand-500" />
        <p className="mt-4 text-sm text-surface-400">Loading...</p>
      </div>
    </div>
  );
}
