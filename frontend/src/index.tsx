// Include Telegram UI styles first to allow our code override the package CSS.
import '@telegram-apps/telegram-ui/dist/styles.css';

import ReactDOM from 'react-dom/client';
import { StrictMode } from 'react';
import { retrieveLaunchParams } from '@tma.js/sdk-react';

import { Root } from '@/components/Root.tsx';
import { EnvUnsupported } from '@/components/EnvUnsupported.tsx';
import { init } from '@/init.ts';

import './index.css';

// Mock the environment in case, we are outside Telegram.
import './mockEnv.ts';

const root = ReactDOM.createRoot(document.getElementById('root')!);

try {
  // Try to retrieve launch params, but don't fail if Telegram version is too old
  let launchParams;
  let platform = 'unknown';
  let debug = import.meta.env.DEV;
  
  try {
    launchParams = retrieveLaunchParams();
    platform = launchParams.tgWebAppPlatform;
    debug = (launchParams.tgWebAppStartParam || '').includes('debug') || import.meta.env.DEV;
  } catch (versionError) {
    // If version check fails, use defaults and continue anyway
    console.warn('Telegram version check failed, using defaults:', versionError);
  }

  // Configure all application dependencies.
  await init({
    debug,
    eruda: debug && ['ios', 'android'].includes(platform),
    mockForMacOS: platform === 'macos',
  })
    .then(() => {
      root.render(
        <StrictMode>
          <Root/>
        </StrictMode>,
      );
    });
} catch (e) {
  console.error('Initialization error:', e);
  root.render(<EnvUnsupported/>);
}
