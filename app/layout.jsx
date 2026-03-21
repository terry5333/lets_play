import './globals.css';

export const metadata = {
  title: '我的遊戲吧',
  description: '專屬的線上桌遊 Vibe 空間',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      {/* 加上 bg-slate-900 確保整個網站底色是深色系 */}
      <body className="bg-slate-900 antialiased text-white">
        {children}
      </body>
    </html>
  );
}
