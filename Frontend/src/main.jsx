import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
// Initialises i18next and sets <html lang/dir> before the first render,
// so the very first paint is already in the right language and direction
// rather than flashing English/LTR and correcting itself.
import "./i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
