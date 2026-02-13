import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getExtractions } from '@/lib/supabase';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const extractions = await getExtractions();

  return (
    <div className="min-h-screen bg-background">
      <Header userEmail={user.email} />
      
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-7xl mx-auto">
          <Dashboard initialExtractions={extractions} />
        </div>
      </main>
    </div>
  );
}
