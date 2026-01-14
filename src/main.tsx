import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 1. Thêm dòng này để import HashRouter
import { HashRouter } from "react-router-dom"; 

createRoot(document.getElementById("root")!).render(
  // 2. Bọc component App bên trong HashRouter
  <HashRouter>
    <App />
  </HashRouter>
);