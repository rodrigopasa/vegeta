import { createRoot } from "react-dom/client";
import "./index.css";

// Link to font-awesome for icons
const fontAwesomeLink = document.createElement('link');
fontAwesomeLink.rel = 'stylesheet';
fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
document.head.appendChild(fontAwesomeLink);

// Set title
document.title = "PaZap - Disparador de Mensagens para WhatsApp";

try {
  const App = require("./App").default;
  const root = createRoot(document.getElementById("root")!);
  
  // Wrap in a try/catch to see if there are any render errors
  try {
    root.render(<App />);
  } catch (error) {
    console.error("Erro ao renderizar o aplicativo:", error);
    root.render(
      <div style={{ 
        maxWidth: "800px", 
        margin: "2rem auto", 
        padding: "1rem", 
        backgroundColor: "#f8f9fa", 
        border: "1px solid #ddd", 
        borderRadius: "8px" 
      }}>
        <h1 style={{ color: "#dc3545" }}>Erro ao carregar o aplicativo</h1>
        <p>Ocorreu um erro ao carregar o aplicativo. Por favor, recarregue a página ou contate o suporte se o problema persistir.</p>
        <pre style={{ 
          backgroundColor: "#f1f1f1", 
          padding: "1rem", 
          overflow: "auto", 
          borderRadius: "4px"
        }}>
          {error instanceof Error ? error.message : String(error)}
        </pre>
        <button onClick={() => window.location.reload()} style={{
          backgroundColor: "#28a745",
          color: "white",
          border: "none",
          padding: "0.5rem 1rem",
          borderRadius: "4px",
          cursor: "pointer"
        }}>
          Recarregar Página
        </button>
      </div>
    );
  }
} catch (error) {
  console.error("Erro ao importar o aplicativo:", error);
  createRoot(document.getElementById("root")!).render(
    <div style={{ 
      maxWidth: "800px", 
      margin: "2rem auto", 
      padding: "1rem", 
      backgroundColor: "#f8f9fa", 
      border: "1px solid #ddd", 
      borderRadius: "8px" 
    }}>
      <h1 style={{ color: "#dc3545" }}>Erro ao importar o aplicativo</h1>
      <p>Ocorreu um erro ao importar o aplicativo. Por favor, recarregue a página ou contate o suporte se o problema persistir.</p>
      <pre style={{ 
        backgroundColor: "#f1f1f1", 
        padding: "1rem", 
        overflow: "auto", 
        borderRadius: "4px"
      }}>
        {error instanceof Error ? error.message : String(error)}
      </pre>
      <button onClick={() => window.location.reload()} style={{
        backgroundColor: "#28a745",
        color: "white",
        border: "none",
        padding: "0.5rem 1rem",
        borderRadius: "4px",
        cursor: "pointer"
      }}>
        Recarregar Página
      </button>
    </div>
  );
}
