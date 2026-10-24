import { Link } from 'wouter';
import AppShell from '@/components/AppShell';

export default function NotFound() {
  return (
    <AppShell>
      <h1 className="mt-6 text-[28px] font-extrabold tracking-[-0.02em]">Page not found</h1>
      <Link href="/" className="mt-6 flex min-h-[56px] items-center justify-center rounded-2xl bg-ink text-[17px] font-bold text-cream">Go to Bundle</Link>
    </AppShell>
  );
}
