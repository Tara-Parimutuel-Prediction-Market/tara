import { Navigate, Route, Routes, HashRouter } from 'react-router-dom';
import { useLaunchParams } from '@tma.js/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { routes } from '@/tma/navigation/routes.tsx';

export function App() {
  const lp = useLaunchParams();

  return (
    <AppRoot
      appearance='light'
      platform={['macos', 'ios'].includes(lp.tgWebAppPlatform) ? 'ios' : 'base'}
    >
      <HashRouter>
        <Routes>
          {routes.map((route) => <Route key={route.path} {...route} />)}
          <Route path="*" element={<Navigate to="/"/>}/>
        </Routes>
      </HashRouter>
    </AppRoot>
  );
}
