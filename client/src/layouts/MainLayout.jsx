import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

const MainLayout = () => (
  <div className="min-h-screen flex">
    <Sidebar />
    <div className="flex-1">
      <TopBar />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  </div>
);

export default MainLayout;
