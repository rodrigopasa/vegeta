import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Link to font-awesome for icons
const fontAwesomeLink = document.createElement('link');
fontAwesomeLink.rel = 'stylesheet';
fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
document.head.appendChild(fontAwesomeLink);

// Set title
document.title = "WhatsApp Scheduler";

createRoot(document.getElementById("root")!).render(<App />);
