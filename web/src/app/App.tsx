import { RouterProvider } from 'react-router/dom';
import { AppProviders } from './providers';
import { getRouter } from './router';

/** The whole app: system start-up around the router. `main.tsx` mounts this. */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={getRouter()} />
    </AppProviders>
  );
}
