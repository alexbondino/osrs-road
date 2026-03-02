'use client';

import { useSearchParams } from 'next/navigation';
import AuthForm from '@/components/AuthForm';

export default function AuthPageClient() {
  const params = useSearchParams();
  const tab = params.get('tab') === 'signup' ? 'signup' : 'signin';
  const redirectTo = params.get('redirect') ?? '/';

  return <AuthForm initialTab={tab} redirectTo={redirectTo} />;
}
