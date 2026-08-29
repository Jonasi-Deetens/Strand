import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles.css";
import "./i18n";
import App from "./App";
import { useProjectStore } from "./store/useProjectStore";
import { useEditorStore } from "./store/useEditorStore";
import { currentStage } from "./features/export/png";

if (import.meta.env.DEV) {
  // Canvas state is hard to inspect from the DOM, so expose the stores and the
  // Konva stage while developing: `__strand.project.getState().doc`.
  Object.assign(window, {
    __strand: {
      project: useProjectStore,
      editor: useEditorStore,
      stage: currentStage,
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
