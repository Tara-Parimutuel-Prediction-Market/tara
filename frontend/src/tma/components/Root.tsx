import { TonConnectUIProvider } from '@tonconnect/ui-react';

import { App } from '@/tma/components/App.tsx';
import { ErrorBoundary } from '@/tma/components/ErrorBoundary.tsx';
import { publicUrl } from '@/helpers/publicUrl.ts';
import { ThemeProvider } from '@/contexts/ThemeContext';

function ErrorBoundaryError({ error }: { error: unknown }) {
  return (
    <div>
      <p>An unhandled error occurred:</p>
      <blockquote>
        <code>
          {error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : JSON.stringify(error)}
        </code>
      </blockquote>
    </div>
  );
}

export function Root() {
  return (
    <ErrorBoundary fallback={ErrorBoundaryError}>
      <ThemeProvider>
        <TonConnectUIProvider
          manifestUrl={publicUrl('tonconnect-manifest.json')}
        >
          <App/>
        </TonConnectUIProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
