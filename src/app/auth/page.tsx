import { Suspense } from 'react';
import AuthPageClient from './AuthPageClient';

export default function AuthPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] bg-zinc-950 flex items-center justify-center px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-white text-xl font-bold">OSRS Road</h1>
          <p className="text-zinc-500 text-xs mt-1">
            Your Old School progression planner
          </p>
        </div>
        <Suspense>
          <AuthPageClient />
        </Suspense>
      </div>
    </div>
  );
}
