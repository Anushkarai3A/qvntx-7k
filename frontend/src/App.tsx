import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "./components/layout/Layout";
import { AccuracyPage } from "./pages/AccuracyPage";
import { EvolutionPage } from "./pages/EvolutionPage";
import { ExplorerPage } from "./pages/ExplorerPage";
import { HomePage } from "./pages/HomePage";
import { OverviewPage } from "./pages/OverviewPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<OverviewPage />} />
        <Route path="accuracy" element={<AccuracyPage />} />
        <Route path="evolution" element={<EvolutionPage />} />
        <Route path="explorer" element={<ExplorerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
