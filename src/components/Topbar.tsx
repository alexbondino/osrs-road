'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import AuthModal from './AuthModal';

type ModalTab = 'signin' | 'signup';

export default function Topbar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalTab, setModalTab] = useState<ModalTab | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    router.push('/');
  };

  return (
    <>
      <nav className="w-full flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-700 shadow-sm">
        <Link href="/">
          <span className="text-lg font-bold tracking-tight text-white cursor-pointer hover:text-amber-400 transition-colors">
            OSRS Road
          </span>
        </Link>

        <div className="flex gap-3 items-center">
          {!loading && (
            <>
              {user ? (
                <>
                  {/* Nav links — only for logged in users */}
                  <Link href="/list_roadmap">
                    <button className="px-4 py-2 rounded-md border border-zinc-500 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors">
                      My List
                    </button>
                  </Link>
                  <Link href="/create_roadmap">
                    <button className="px-4 py-2 rounded-md bg-amber-500 text-zinc-900 text-sm font-semibold hover:bg-amber-400 transition-colors">
                      Create Roadmap
                    </button>
                  </Link>

                  {/* Profile icon + dropdown */}
                  <div ref={dropdownRef} className="relative ml-1">
                    <button
                      onClick={() => setDropdownOpen(o => !o)}
                      title={user.email ?? 'Profile'}
                      className="w-9 h-9 rounded-full bg-zinc-700 border-2 border-zinc-600 hover:border-amber-500 transition-colors flex items-center justify-center"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="w-5 h-5 text-zinc-300"
                      >
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </button>

                    {dropdownOpen && (
                      <div className="absolute right-0 top-11 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl w-52 py-1 z-50">
                        <div className="px-4 py-2.5 border-b border-zinc-700">
                          <p className="text-zinc-400 text-xs">Signed in as</p>
                          <p className="text-white text-xs font-medium mt-0.5 truncate">
                            {user.email}
                          </p>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setModalTab('signin')}
                    className="px-4 py-2 rounded-md border border-zinc-500 text-zinc-200 text-sm font-medium hover:bg-zinc-700 transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setModalTab('signup')}
                    className="px-4 py-2 rounded-md bg-amber-500 text-zinc-900 text-sm font-semibold hover:bg-amber-400 transition-colors"
                  >
                    Register
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </nav>
      {modalTab && (
        <AuthModal initialTab={modalTab} onClose={() => setModalTab(null)} />
      )}
    </>
  );
}
