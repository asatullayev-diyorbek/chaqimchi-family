import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Child, getChildren } from "../api/children";
import { Device, getDevices } from "../api/tracking";

/**
 * Child is the primary entity; a device is one source inside it (a child can
 * own a laptop and a phone at once). `selectedChildId` picks whose data we're
 * looking at; `selectedDeviceId === null` means "all this child's devices".
 *
 * Detail views stay device-scoped on purpose — summing screen time across two
 * devices a child used at the same time would double-count — so "all devices"
 * shows the fleet, never a fabricated total.
 */
type FamilyState = {
  loading: boolean;
  error: Error | null;
  children: Child[];
  devices: Device[];
  linkedDevices: Device[];

  selectedChildId: string | null;
  selectedChild: Child | null;
  /** Every linked device belonging to the selected child. */
  childDevices: Device[];
  selectedDeviceId: string | null;
  /** Explicitly chosen device, or the only one the child has, else null. */
  activeDevice: Device | null;
  /** True when no single device is chosen and the child owns more than one. */
  allDevices: boolean;

  setChild: (id: string) => void;
  setDevice: (id: string | null) => void;
  reload: () => Promise<void>;
};

const Ctx = createContext<FamilyState | null>(null);

export function FamilyProvider({ children: node }: { children: React.ReactNode }) {
  const [children, setChildren] = useState<Child[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [c, d] = await Promise.all([getChildren(), getDevices()]);
      if (!mounted.current) return;
      setChildren(c);
      setDevices(d);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const linkedDevices = useMemo(
    () => devices.filter((d) => d.status === "linked"),
    [devices],
  );

  // Default child: whoever owns the first linked device, else the first child.
  const effectiveChildId = useMemo(() => {
    if (selectedChildId && children.some((c) => c.id === selectedChildId)) return selectedChildId;
    return linkedDevices[0]?.child_id ?? children[0]?.id ?? null;
  }, [selectedChildId, children, linkedDevices]);

  const selectedChild = useMemo(
    () => children.find((c) => c.id === effectiveChildId) ?? null,
    [children, effectiveChildId],
  );

  const childDevices = useMemo(
    () =>
      effectiveChildId
        ? linkedDevices.filter((d) => d.child_id === effectiveChildId)
        : linkedDevices,
    [linkedDevices, effectiveChildId],
  );

  // A device is only "selected" when it belongs to the current child.
  const chosen = childDevices.find((d) => d.id === selectedDeviceId) ?? null;
  const activeDevice = chosen ?? (childDevices.length === 1 ? childDevices[0] : null);
  const allDevices = chosen === null && childDevices.length > 1;

  const setChild = useCallback((id: string) => {
    setSelectedChildId(id);
    setSelectedDeviceId(null); // a new child invalidates the device pick
  }, []);

  const value = useMemo<FamilyState>(
    () => ({
      loading,
      error,
      children,
      devices,
      linkedDevices,
      selectedChildId: effectiveChildId,
      selectedChild,
      childDevices,
      selectedDeviceId: chosen?.id ?? null,
      activeDevice,
      allDevices,
      setChild,
      setDevice: setSelectedDeviceId,
      reload,
    }),
    [
      loading,
      error,
      children,
      devices,
      linkedDevices,
      effectiveChildId,
      selectedChild,
      childDevices,
      chosen,
      activeDevice,
      allDevices,
      setChild,
      reload,
    ],
  );

  return <Ctx.Provider value={value}>{node}</Ctx.Provider>;
}

export function useFamily(): FamilyState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFamily must be used inside <FamilyProvider>");
  return ctx;
}
