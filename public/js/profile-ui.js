// profile-ui.js - profile modal handlers
function openProfileModal() {
  const st = window.state || {};
  const els = window.elements || {};
  if (!st.currentUser || !els.profileModal) return;
  if (els.profileDisplayName) els.profileDisplayName.value = st.currentUser.displayName || "";
  if (els.profileBio) els.profileBio.value = st.currentUser.bio || "";
  if (els.profileEmail) els.profileEmail.value = st.currentUser.email || "";
  if (els.profileError) els.profileError.textContent = "";
  els.profileModal.classList.remove("is-hidden");
}

function closeProfileModal() {
  const els = window.elements || {};
  if (els.profileModal) els.profileModal.classList.add("is-hidden");
}

if (typeof window !== "undefined") {
  window.openProfileModal = openProfileModal;
  window.closeProfileModal = closeProfileModal;
}
