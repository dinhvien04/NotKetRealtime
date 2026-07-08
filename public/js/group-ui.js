// group-ui.js - groups, create group UX, members
function renderGroupIconPreview() {
  const el = window.elements && window.elements.groupIconPreview;
  const st = window.state || {};
  if (!el) return;
  el.replaceChildren();
  const iconName = st.selectedGroupIcon && st.selectedGroupIcon.iconName;
  const color = st.selectedGroupIcon && st.selectedGroupIcon.color;
  if (window.createIconElement && window.isSafeIconName && window.isSafeIconName(iconName)) {
    const ic = window.createIconElement(iconName, color, "group-icon");
    if (ic) el.append(ic);
  } else {
    el.textContent = "G";
  }
}

function normalizeHexColorLocal(v) {
  return (window.normalizeHexColor ? window.normalizeHexColor(v) : null);
}

async function openGroupModal() {
  const st = window.state || {};
  const els = window.elements || {};
  if (!els.groupModal) return;
  els.groupError && (els.groupError.textContent = "");
  if (els.groupNameInput) els.groupNameInput.value = "";
  if (els.groupMembersInput) els.groupMembersInput.value = "";
  st.selectedGroupIcon = st.selectedGroupIcon || { iconName: "lucide:users", color: "#22c55e" };
  if (els.groupIconColor) els.groupIconColor.value = st.selectedGroupIcon.color || "#22c55e";
  renderGroupIconPreview();
  els.groupModal.classList.remove("is-hidden");
}

function closeGroupModal() {
  const els = window.elements || {};
  if (els.groupModal) els.groupModal.classList.add("is-hidden");
}

function createGroupItem(group) {
  const els = window.elements || {};
  const st = window.state || {};
  const button = document.createElement("button");
  const avatar = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const preview = document.createElement("span");
  button.type = "button";
  button.className = "user-item";
  if (st.chatMode === "group" && st.selectedConversationId === group.conversationId) {
    button.classList.add("is-active");
  }
  avatar.className = "avatar";
  if (window.renderConversationIcon) {
    window.renderConversationIcon(avatar, group, group.name || "G");
  }
  copy.className = "user-copy";
  name.textContent = group.name || "Nhóm chat";
  const last = group.lastMessage;
  preview.textContent = last
    ? last.type === "image"
      ? "Đã gửi ảnh"
      : last.type === "voice"
        ? "Tin thoại"
        : last.body || "Tin nhắn mới"
    : "Bắt đầu trò chuyện nhóm";
  copy.append(name, preview);
  button.append(avatar, copy);
  if (group.unreadCount > 0) {
    const badge = document.createElement("span");
    badge.className = "unread-badge";
    badge.textContent = group.unreadCount;
    button.append(badge);
  }
  button.addEventListener("click", () => {
    if (typeof window.selectGroup === "function") window.selectGroup(group);
  });
  return button;
}

function selectGroup(group) {
  const st = window.state || {};
  const els = window.elements || {};
  st.chatMode = "group";
  st.selectedUser = null;
  st.activeConversation = group;
  st.selectedConversationId = group.conversationId;
  if (window.clearSelectedFile) window.clearSelectedFile();
  if (window.hideSearchResults) window.hideSearchResults();
  if (window.openChatPanel) window.openChatPanel();
  if (window.renderConversationHeader) window.renderConversationHeader();
  if (window.clearMessages) window.clearMessages();
  if (window.renderSidebar) window.renderSidebar();
  if (window.socket) {
    window.socket.emit("join_conversation", {
      conversationId: st.selectedConversationId
    });
  }
  if (window.loadMessages) window.loadMessages({ reset: true });
}

async function loadGroups() {
  try {
    const apiFn = window.api || (async () => ({}));
    const result = await apiFn("/api/conversations/groups");
    if (window.state) window.state.groups = result.groups || [];
    const els = window.elements || {};
    if (els.groupList) {
      els.groupList.replaceChildren();
      (window.state.groups || []).forEach((g) => {
        if (typeof createGroupItem === "function") {
          els.groupList.append(createGroupItem(g));
        }
      });
    }
  } catch (error) {
    if (typeof window.showToast === "function") window.showToast(error.message, "error");
  }
}

function closeGroupMembersModal() {
  const els = window.elements || {};
  els.groupMembersModal?.classList.add("is-hidden");
}

async function leaveCurrentGroup() {
  const st = window.state || {};
  const els = window.elements || {};
  if (!st.selectedConversationId) return;
  if (!confirm("Rời nhóm này?")) return;
  try {
    const apiFn = window.api || (async () => ({}));
    await apiFn(`/api/conversations/${st.selectedConversationId}/leave`, { method: "POST" });
    st.selectedConversationId = null;
    st.chatMode = "direct";
    if (window.clearMessages) window.clearMessages();
    if (window.loadGroups) window.loadGroups();
    if (window.loadConversations) window.loadConversations();
    if (els.selectedUsername) els.selectedUsername.textContent = "";
    if (els.selectedStatus && els.selectedStatus.lastChild) els.selectedStatus.lastChild.textContent = "";
  } catch (error) {
    if (typeof window.showToast === "function") window.showToast(error.message, "error");
  }
}

if (typeof window !== "undefined") {
  window.renderGroupIconPreview = renderGroupIconPreview;
  window.openGroupModal = openGroupModal;
  window.closeGroupModal = closeGroupModal;
  window.createGroupItem = createGroupItem;
  window.selectGroup = selectGroup;
  window.loadGroups = loadGroups;
  window.closeGroupMembersModal = closeGroupMembersModal;
  window.leaveCurrentGroup = leaveCurrentGroup;
}
