'use client';

import { useAuth } from '@/hooks/useAuth';

export default function CreateRoadmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <>
      {!user && (
        <div className="w-full bg-zinc-800 border-b border-amber-500/30 px-6 py-3">
          <p className="text-zinc-300 text-sm">
            <span className="text-amber-400 font-semibold">
              Log in to save your roadmap.
            </span>{' '}
            You can build freely, but your progress won&apos;t be saved until
            you have an account.
          </p>
        </div>
      )}
      {children}
    </>
  );
}
