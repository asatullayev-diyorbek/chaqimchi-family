import { useEffect, useState } from "react";
import { getAlerts } from "../api/alerts";
import { useFamily } from "../state/family";

/**
 * Total unseen alerts across every linked device — for the Alerts tab badge.
 * Polled gently (60s); there is no realtime channel on the free backend.
 */
export function useAlertBadge(): number {
  const { linkedDevices } = useFamily();
  const [count, setCount] = useState(0);
  const ids = linkedDevices.map((d) => d.id).join(",");

  useEffect(() => {
    if (!ids) {
      setCount(0);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const lists = await Promise.all(
          ids.split(",").map((id) => getAlerts(id).catch(() => [])),
        );
        if (alive) setCount(lists.flat().filter((a) => !a.seen).length);
      } catch {
        /* ignore */
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ids]);

  return count;
}
