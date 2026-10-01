const token = localStorage.getItem("chatToken");
const savedUser = JSON.parse(localStorage.getItem("chatUser") || "null");

if (!token || !savedUser) {
  // Group chat is intentionally available without login.
  if (new URLSearchParams(location.search).get("mode") === "group") {
    window.location.href = "/?group=true";
  } else {
    window.location.href = "/login.html";
  }
}

const myUser = savedUser;
const socket = io({
  auth: { token }
});

const messagesArea = document.getElementById("messagesArea");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.querySelector(".send-btn");
const usersList = document.getElementById("usersList");
const userSearch = document.getElementById("userSearch");
const groupChatItem = document.getElementById("groupChatItem");
const conversationTitle = document.getElementById("conversationTitle");
const conversationStatus = document.getElementById("conversationStatus");
const conversationAvatar = document.getElementById("conversationAvatar");
const typingArea = document.getElementById("typingArea");
const connectionStatus = document.getElementById("connectionStatus");
const myProfile = document.getElementById("myProfile");
const myStatus = document.getElementById("myStatus");
const emojiPanel = document.getElementById("emojiPanel");

let users = [];
let onlineUserIds = new Set();
let currentChat = {
  type: "group",
  userId: null,
  userName: "Group Broadcast"
};
let typingTimeout = null;
let isTyping = false;

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function initials(name) {
  return name
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatTime(isoTime) {
  return new Date(isoTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLastSeen(dateValue) {
  if (!dateValue) return "Offline";

  const date = new Date(dateValue);
  return `Last seen ${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function showWelcome(show) {
  const welcome = document.getElementById("welcomeChat");
  if (welcome) welcome.style.display = show ? "flex" : "none";
}

function setInputEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  if (enabled) messageInput.focus();
}

function scrollToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function addMessage(message, type) {
  showWelcome(false);

  const mine = message.senderId === myUser.id;
  const wrapper = document.createElement("div");
  wrapper.className = `message-row ${mine ? "mine" : "theirs"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = initials(message.senderName);

  const content = document.createElement("div");
  content.className = "message-content";

  if (!mine) {
    const sender = document.createElement("div");
    sender.className = "message-sender";
    sender.textContent = message.senderName;
    content.appendChild(sender);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = escapeHtml(message.text).replace(/\n/g, "<br>");

  const meta = document.createElement("div");
  meta.className = "message-time";
  meta.textContent = formatTime(message.time);

  content.appendChild(bubble);
  content.appendChild(meta);

  if (mine) {
    wrapper.appendChild(content);
    wrapper.appendChild(avatar);
  } else {
    wrapper.appendChild(avatar);
    wrapper.appendChild(content);
  }

  messagesArea.appendChild(wrapper);
  scrollToBottom();
}

function clearMessages() {
  messagesArea.innerHTML = `
    <div class="welcome-chat" id="welcomeChat">
      <div class="welcome-icon">💬</div>
      <h3>Start your conversation</h3>
      <p>Messages sent from this point will appear here in real time.</p>
    </div>
  `;
}

function selectGroupChat() {
  currentChat = {
    type: "group",
    userId: null,
    userName: "Group Broadcast"
  };

  document.querySelectorAll(".chat-list-item").forEach(item => {
    item.classList.remove("active");
  });
  groupChatItem.classList.add("active");

  conversationTitle.textContent = "Group Broadcast";
  conversationStatus.textContent = "Everyone connected can see these messages";
  conversationAvatar.textContent = "👥";

  clearMessages();
  typingArea.textContent = "";
  setInputEnabled(true);
  closeSidebarOnMobile();
}

function selectPrivateChat(user) {
  currentChat = {
    type: "private",
    userId: user.id,
    userName: user.name
  };

  document.querySelectorAll(".chat-list-item").forEach(item => {
    item.classList.remove("active");
  });

  const selected = document.querySelector(`[data-user-id="${user.id}"]`);
  if (selected) selected.classList.add("active");

  conversationTitle.textContent = user.name;
  conversationAvatar.textContent = initials(user.name);

  updateConversationStatus(user.id);
  clearMessages();
  typingArea.textContent = "";
  setInputEnabled(true);
  closeSidebarOnMobile();
}

function updateConversationStatus(userId) {
  const user = users.find(item => item.id === userId);

  if (onlineUserIds.has(userId)) {
    conversationStatus.textContent = "● Online";
    conversationStatus.classList.add("online-text");
  } else {
    conversationStatus.textContent = user ? formatLastSeen(user.lastSeen) : "Offline";
    conversationStatus.classList.remove("online-text");
  }
}

function renderMyProfile() {
  myProfile.innerHTML = `
    <div class="avatar profile-avatar" style="background:${escapeHtml(myUser.avatarColor || "#6c63ff")}">
      ${escapeHtml(initials(myUser.name))}
      <span class="online-indicator"></span>
    </div>
    <div class="profile-info">
      <strong>${escapeHtml(myUser.name)}</strong>
      <span>${escapeHtml(myUser.email)}</span>
    </div>
  `;
}

function renderUsers(filter = "") {
  const query = filter.trim().toLowerCase();

  const filtered = users.filter(user =>
    user.id !== myUser.id &&
    (user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query))
  );

  usersList.innerHTML = "";

  if (!filtered.length) {
    usersList.innerHTML = `<div class="empty-users">No other users found.</div>`;
    return;
  }

  filtered.forEach(user => {
    const item = document.createElement("button");
    item.className = "chat-list-item";
    item.dataset.userId = user.id;

    const online = onlineUserIds.has(user.id);

    item.innerHTML = `
      <div class="avatar user-avatar" style="background:${escapeHtml(user.avatarColor || "#6c63ff")}">
        ${escapeHtml(initials(user.name))}
        <span class="online-indicator ${online ? "" : "offline"}"></span>
      </div>
      <div class="chat-item-text">
        <strong>${escapeHtml(user.name)}</strong>
        <span>${online ? "Online" : "Offline"}</span>
      </div>
      ${online ? '<span class="online-dot"></span>' : ""}
    `;

    item.addEventListener("click", () => selectPrivateChat(user));
    usersList.appendChild(item);
  });
}

async function loadUsers() {
  try {
    const response = await fetch("/api/users");
    if (!response.ok) throw new Error();

    users = await response.json();
    renderUsers(userSearch.value);

    if (currentChat.type === "private" && currentChat.userId) {
      const selected = users.find(user => user.id === currentChat.userId);
      if (selected) updateConversationStatus(selected.id);
    }
  } catch {
    usersList.innerHTML = `<div class="empty-users">Could not load users.</div>`;
  }
}

function startTyping() {
  if (isTyping) return;
  isTyping = true;

  socket.emit("typing:start", {
    chatType: currentChat.type,
    receiverId: currentChat.userId
  });
}

function stopTyping() {
  if (!isTyping) return;
  isTyping = false;

  socket.emit("typing:stop", {
    chatType: currentChat.type,
    receiverId: currentChat.userId
  });
}

messageInput.addEventListener("input", () => {
  if (!messageInput.value.trim()) {
    stopTyping();
    return;
  }

  startTyping();

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 1000);
});

messageForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (!text || messageInput.disabled) return;

  if (currentChat.type === "group") {
    socket.emit("group:message", text);
  } else {
    socket.emit("private:message", {
      receiverId: currentChat.userId,
      text
    });
  }

  messageInput.value = "";
  stopTyping();
  emojiPanel.classList.add("hidden");
  messageInput.focus();
});

socket.on("group:message", (message) => {
  if (currentChat.type === "group") {
    addMessage(message, "group");
  }
});

socket.on("private:message", (message) => {
  const belongsToCurrentChat =
    currentChat.type === "private" &&
    (message.senderId === currentChat.userId ||
      message.receiverId === currentChat.userId);

  if (belongsToCurrentChat) {
    addMessage(message, "private");
  }
});

socket.on("presence:list", ids => {
  onlineUserIds = new Set(ids);
  renderUsers(userSearch.value);
});

socket.on("presence:update", data => {
  if (data.online) {
    onlineUserIds.add(data.userId);
  } else {
    onlineUserIds.delete(data.userId);

    const user = users.find(item => item.id === data.userId);
    if (user) user.lastSeen = data.lastSeen || new Date().toISOString();
  }

  renderUsers(userSearch.value);

  if (currentChat.type === "private" && currentChat.userId === data.userId) {
    updateConversationStatus(data.userId);
  }
});

socket.on("typing:update", data => {
  if (data.userId === myUser.id) return;

  if (currentChat.type === "group" && data.chatType === "group") {
    typingArea.textContent = data.typing ? `${data.userName} is typing...` : "";
  }

  if (
    currentChat.type === "private" &&
    data.chatType === "private" &&
    data.userId === currentChat.userId
  ) {
    typingArea.textContent = data.typing ? `${data.userName} is typing...` : "";
  }
});

socket.on("connect", () => {
  connectionStatus.innerHTML = "<i></i> Connected";
  connectionStatus.classList.remove("disconnected");
  myStatus.textContent = "Online";
  setInputEnabled(true);
});

socket.on("disconnect", () => {
  connectionStatus.innerHTML = "<i></i> Disconnected";
  connectionStatus.classList.add("disconnected");
  myStatus.textContent = "Offline";
});

socket.on("connect_error", error => {
  console.error(error.message);

  if (error.message.toLowerCase().includes("token")) {
    localStorage.removeItem("chatToken");
    localStorage.removeItem("chatUser");
    window.location.href = "/login.html";
  }
});

// Search
userSearch.addEventListener("input", () => renderUsers(userSearch.value));

// Group
groupChatItem.addEventListener("click", selectGroupChat);

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  socket.disconnect();
  localStorage.removeItem("chatToken");
  localStorage.removeItem("chatUser");
  window.location.href = "/";
});

// Emoji
document.getElementById("emojiBtn").addEventListener("click", () => {
  emojiPanel.classList.toggle("hidden");
});

emojiPanel.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", () => {
    messageInput.value += button.textContent;
    messageInput.focus();
    emojiPanel.classList.add("hidden");
  });
});

// Mobile sidebar
const sidebar = document.getElementById("sidebar");

document.getElementById("mobileMenu").addEventListener("click", () => {
  sidebar.classList.add("open");
});

document.getElementById("mobileClose").addEventListener("click", () => {
  sidebar.classList.remove("open");
});

function closeSidebarOnMobile() {
  if (window.innerWidth <= 800) {
    sidebar.classList.remove("open");
  }
}

renderMyProfile();
loadUsers();
selectGroupChat();
