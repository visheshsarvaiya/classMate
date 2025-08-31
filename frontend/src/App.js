import "./App.css";
import Homepage from "./Pages/Homepage";
import { Routes, Route } from "react-router-dom"; // 👈 Routes भी import कर
import Chatpage from "./Pages/Chatpage";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Homepage />} /> {/* 👈 element={} use कर */}
        <Route path="/chats" element={<Chatpage />} />
      </Routes>
    </div>
  );
}

export default App;
