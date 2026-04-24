// client/src/hooks/useEditionNumber.ts
import { trpc } from "@/lib/trpc";
import { issueNumber } from "../../../shared/lib/editorial-date";

export function useEditionNumber(): number {
  const { data: user } = trpc.auth.me.useQuery();
  if (!user?.createdAt) return 1;
  return issueNumber(new Date(user.createdAt), new Date());
}
