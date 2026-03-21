import RoomWaitingArea from '../components/RoomWaitingArea'; 
// 💡 注意：請確認這個 import 路徑有對應到你存放 RoomWaitingArea.jsx 的位置！
// 如果你的 RoomWaitingArea 是放在 app/components/ 裡面，路徑可能要微調。

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900">
      {/* 為了先測試我們的心血結晶，我們直接把房間準備區渲染在首頁 */}
      <RoomWaitingArea roomId="1234" />
    </main>
  );
}
