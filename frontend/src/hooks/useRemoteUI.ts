import { useEffect, useState } from "react";
import { RemoteUIEngine } from "../services/remoteUIEngine";

export const useRemoteUI = () => {
  const [screen, setScreen] = useState(RemoteUIEngine.getScreen());

  useEffect(() => {
    const update = () => {
      setScreen({ ...RemoteUIEngine.getScreen() });
    };

    window.addEventListener("REMOTE_UI_UPDATE", update);

    return () => {
      window.removeEventListener("REMOTE_UI_UPDATE", update);
    };
  }, []);

  return screen;
};