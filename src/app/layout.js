import "./globals.css";

export const metadata = {
  title: "Metric Lookup",
  description:
    "Ask what a leasing metric means, how it is calculated and why it matters.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
