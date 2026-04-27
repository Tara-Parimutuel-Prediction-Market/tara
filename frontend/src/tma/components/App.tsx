import { Suspense, useState } from 'react';
import { Navigate, Route, Routes, HashRouter } from 'react-router-dom';
import { useLaunchParams } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { PwaBottomNav } from '@/pwa/components/PwaBottomNav';

import { routes } from '@/tma/navigation/routes.tsx';
import { useTheme } from '@/hooks/useTheme';
import { OnboardingModal, useOnboarding } from './OnboardingModal';

export function App() {
  const lp = useLaunchParams();
  const { theme } = useTheme();
  const shouldOnboard = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(shouldOnboard);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <AppRoot
      appearance={isDark ? 'dark' : 'light'}
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <HashRouter>
        <div style={{ paddingBottom: 80, minHeight: '100vh', position: 'relative' }}>
          <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh", color: "var(--text-muted, #94a3b8)" }}>Loading…</div>}>
            <Routes>
              {routes.map((route) => <Route key={route.path} {...route} />)}
              <Route path="*" element={<Navigate to="/"/>}/>
            </Routes>
          </Suspense>
        </div>
        <PwaBottomNav />
        {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      </HashRouter>
    </AppRoot>
  );
}
