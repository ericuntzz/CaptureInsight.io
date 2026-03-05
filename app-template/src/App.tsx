import { useAuth } from "./hooks/useAuth";
import { useRouter } from "./hooks/useRouter";
import { Button } from "./components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./components/ui/card";
import { Loader2, LogIn, LogOut } from "lucide-react";

function App() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { pathname, push } = useRouter();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Card className="w-full max-w-md bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-2xl text-center">
              Welcome
            </CardTitle>
            <CardDescription className="text-gray-400 text-center">
              Sign in to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/login">
              <Button className="w-full" size="lg">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My App</h1>
        <div className="flex items-center gap-4">
          {user?.profileImageUrl && (
            <img
              src={user.profileImageUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-400">
            {user?.firstName} {user?.lastName}
          </span>
          <a href="/api/logout">
            <Button variant="ghost" size="sm">
              <LogOut className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <Card className="max-w-2xl mx-auto bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">
              Hello, {user?.firstName || 'there'}!
            </CardTitle>
            <CardDescription className="text-gray-400">
              Your app template is ready. Start building!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-gray-300 text-sm">
              <p>This template includes:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li>Replit Auth (Google, GitHub, etc.)</li>
                <li>PostgreSQL with Drizzle ORM</li>
                <li>React + TypeScript + Vite</li>
                <li>Tailwind CSS + Radix UI components</li>
                <li>TanStack React Query for data fetching</li>
                <li>AES-256-GCM encryption layer</li>
                <li>Client-side SPA routing</li>
              </ul>
              <p className="text-gray-500 mt-4">
                Current route: <code className="text-gray-400">{pathname}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default App;
