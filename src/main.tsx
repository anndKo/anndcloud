import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 1. XÓA dòng import HashRouter (vì không dùng ở đây nữa)
// import { HashRouter } from "react-router-dom"; 

createRoot(document.getElementById("root")!).render(
  // 2. XÓA thẻ <HashRouter> bao quanh, CHỈ ĐỂ LẠI <App />
  <App />
);