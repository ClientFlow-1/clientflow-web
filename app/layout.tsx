import "./globals.css";

export const metadata = {
  title: "ClientFlow — CRM",
  description: "Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'history.scrollRestoration = "manual"; window.scrollTo(0,0);' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}