import { Dashboard } from './Dashboard';

/**
 * /app — the dashboard. The bento grid itself lives in Dashboard.tsx (client) because
 * every slot reads shared hook state. Layout map is documented at the top of that file.
 */
export default function DashboardPage() {
  return <Dashboard />;
}
