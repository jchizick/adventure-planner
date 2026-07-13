import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLoading, SignInScreen, WorkspaceGate } from "./auth-ui";
import { AppShell } from "./components";
import { AdventureProvider } from "./context";
import { IdeasProvider } from "./ideas";
import { AdventureDetail, Calendar, Ideas, Memories, Today } from "./pages";
import { WorkspaceProvider } from "./workspace";

function ProtectedApplication() {
  const { loading, user } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <SignInScreen />;
  return (
    <WorkspaceProvider>
      <WorkspaceGate>
        <AdventureProvider>
          <IdeasProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/today" element={<Today />} />
                <Route path="/ideas" element={<Ideas />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/memories" element={<Memories />} />
                <Route path="/adventures/:id" element={<AdventureDetail />} />
                <Route path="*" element={<Navigate to="/today" replace />} />
              </Route>
            </Routes>
          </IdeasProvider>
        </AdventureProvider>
      </WorkspaceGate>
    </WorkspaceProvider>
  );
}

export default function App() {
  return <ProtectedApplication />;
}
