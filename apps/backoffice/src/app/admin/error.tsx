"use client";

export default function ErreurAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 py-16">
      <h1 className="text-lg font-bold text-red-700">Une erreur est survenue</h1>
      <p className="text-sm text-gray-600">{error.message}</p>
      <button
        onClick={reset}
        className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white"
      >
        Reessayer
      </button>
    </div>
  );
}
