import { useEffect, useState } from "react";
import { UpdateBus } from "../services/updateBus";

export const useHotUpdate = () => {
  const [version, setVersion] = useState("v1");

  useEffect(() => {
    const unsub = UpdateBus.subscribe((data) => {
      if (data.type === "HOT_UPDATE_AVAILABLE") {
        setVersion(data.version);
      }
    });

    return () => unsub();
  }, []);

  return { version };
};