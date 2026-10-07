"use client";

import { ErrorBoundaryView } from "@/components/error-boundary-view";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorBoundaryView retry={retry} />;
}
