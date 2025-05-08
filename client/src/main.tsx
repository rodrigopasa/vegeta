import { createRoot } from "react-dom/client";
import "./index.css";
import MinimalApp from "./MinimalApp";

// Link to font-awesome for icons
const fontAwesomeLink = document.createElement('link');
fontAwesomeLink.rel = 'stylesheet';
fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
document.head.appendChild(fontAwesomeLink);

// Set title
document.title = "PaZap - Disparador de Mensagens para WhatsApp";

// Usar a versão simplificada do aplicativo para diagnosticar problemas
const root = createRoot(document.getElementById("root")!);
root.render(<MinimalApp />);
