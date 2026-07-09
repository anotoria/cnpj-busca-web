import "./globals.css";
import CookieBanner from "../components/CookieBanner";

export const metadata = {
  title: "Prospect AI — Seu futuro cliente está aqui",
  description:
    "Busque por empresas Brasileiras. Filtre por nicho, região e porte, e exporte o resultado em CSV.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Instrument+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
