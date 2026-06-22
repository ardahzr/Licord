import { useState } from "react";
import { Navigate, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { ChatArea } from "@/components/chat/ChatArea";
import { Avatar } from "@/components/ui/avatar";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { initials } from "@/lib/utils";

/** Discord-like private group DM with a collapsible member list and voice call. */
export function GroupChatPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { groupChats } = useOutletContext<AppOutletContext>();
  const [membersOpen, setMembersOpen] = useState(true);

  if (groupChats.loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface text-on-surface-variant">
        <Loader2 className="mr-sm h-5 w-5 animate-spin" /> Loading group…
      </div>
    );
  }

  const group = groupChats.groupChats.find((item) => item.id === groupId);
  if (!groupId || !group) return <Navigate to="/friends" replace />;

  return (
    <>
      <ChatArea
        channelId={group.id}
        channelName={group.displayName}
        targetType="group"
        group
        membersOpen={membersOpen}
        onToggleMembers={() => setMembersOpen((current) => !current)}
        onStartCall={() =>
          navigate(
            `/call/group-${group.id}?name=${encodeURIComponent(group.displayName)}`,
          )
        }
      />
      {membersOpen && (
        <aside className="hidden h-full w-60 shrink-0 border-l border-outline-variant bg-surface-container-low lg:flex lg:flex-col">
          <div className="flex h-16 shrink-0 items-center border-b border-outline-variant px-md">
            <Users className="mr-sm h-5 w-5 text-on-surface-variant" />
            <strong className="text-on-surface">
              Members — {group.members.length}
            </strong>
          </div>
          <div className="flex-1 overflow-y-auto p-sm">
            {group.members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-sm rounded px-sm py-sm hover:bg-surface-container-high"
              >
                <Avatar
                  src={member.user.avatar_url}
                  fallback={initials(member.user.username)}
                  status={member.user.status}
                  sizeClassName="w-9 h-9"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-on-surface">
                    {member.user.username}
                  </div>
                  <div className="truncate text-[11px] capitalize text-on-surface-variant">
                    {member.user.status}
                    {member.user_id === group.owner_id ? " · owner" : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
