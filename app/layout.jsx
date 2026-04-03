import "./globals.css";

export const metadata = {
  title: "codebase.agent",
  description: "Chat with any codebase — explain, document, debug",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
