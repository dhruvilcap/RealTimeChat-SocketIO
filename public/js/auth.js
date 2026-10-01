const authMessage = document.getElementById("authMessage");

function showMessage(text, type = "error") {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.className = `message-box ${type}`;
}

function saveSession(data) {
  localStorage.setItem("chatToken", data.token);
  localStorage.setItem("chatUser", JSON.stringify(data.user));
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || "Login failed.");
        return;
      }

      saveSession(data);
      window.location.href = "/chat.html";
    } catch {
      showMessage("Unable to connect to the server.");
    }
  });
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.message || "Registration failed.");
        return;
      }

      saveSession(data);
      window.location.href = "/chat.html";
    } catch {
      showMessage("Unable to connect to the server.");
    }
  });
}
