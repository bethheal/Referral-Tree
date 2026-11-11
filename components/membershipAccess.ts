import { getMembershipState } from "@/components/backendApi";
import { useEffect, useState } from "react";

/** Returns paid-member access; loading and failed requests stay locked safely. */
export const usePaidMembership = () => {
  const [isPaidMember, setIsPaidMember] = useState(false);

  useEffect(() => {
    let active = true;

    void getMembershipState()
      .then((state) => {
        if (!active) return;
        setIsPaidMember(
          state.membership?.status === "ACTIVE" &&
            state.membership.plan !== "free",
        );
      })
      .catch(() => {
        if (active) setIsPaidMember(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { isPaidMember };
};
