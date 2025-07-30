import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import SubscriptionClient from './SubscriptionClient';

function SubscriptionLoading() {
  return (
    <div className="flex justify-center items-center h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<SubscriptionLoading />}>
      <SubscriptionClient />
    </Suspense>
  );
}