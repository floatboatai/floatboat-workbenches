import { useRef, useState } from "react";
export function useNavigation() {
  const active = useRef(false);
  const [transitioning, setTransitioning] = useState(false);
  async function run(task: () => Promise<boolean>): Promise<boolean> {
    if (active.current) return false;
    active.current = true;
    setTransitioning(true);
    try {
      return await task();
    } finally {
      active.current = false;
      setTransitioning(false);
    }
  }
  return { active, transitioning, run };
}
