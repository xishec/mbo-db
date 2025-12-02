import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { SignalSlashIcon } from "@heroicons/react/24/solid";

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
      <SignalSlashIcon className="w-5 h-5" />
      <span className="font-medium">Offline Mode</span>
      <span className="text-amber-100 text-sm">Using cached data</span>
    </div>
  );
}
