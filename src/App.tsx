import { Navigate, Route, Routes } from "react-router-dom";
import Join from "./pages/Join";
import Host from "./pages/Host";
import Screen from "./pages/Screen";
import Bank from "./pages/Bank";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/host" element={<Host />} />
      <Route path="/bank" element={<Bank />} />
      <Route path="/d/:roomCode" element={<Screen mode="tv" />} />
      <Route path="/play/:roomCode" element={<Screen mode="phone" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
