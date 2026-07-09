import "./globals.css";

export const metadata = {
  title: "FinCopilot — AI Stock Research",
  description: "AI-powered equity research for Indian investors",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
