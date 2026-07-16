import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import App from "./App";
import { AuthProvider } from "./auth";
import { NavigationGuardProvider } from "./navigation-guard";
import "./styles.css";

const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <AuthProvider>
        <NavigationGuardProvider>
          <App />
        </NavigationGuardProvider>
      </AuthProvider>
    ),
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
