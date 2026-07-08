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

if (typeof window !== "undefined") {
  window.renderGroupIconPreview = renderGroupIconPreview;
  window.openGroupModal = openGroupModal;
  window.closeGroupModal = closeGroupModal;
}
