// ============================================================
//  BioXape Dashboard — auth.js
//  Handles: Email login, Google OAuth, JWT, logout
// ============================================================

// ── Google OAuth Init ────────────────────────────────────────
function initGoogleAuth() {
  if (!window.google) return;
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleGoogleResponse,
    auto_select: false,
    cancel_on_tap_outside: true
  });
  const btnEl = document.getElementById('google-signin-btn');
  if (btnEl) {
    google.accounts.id.renderButton(btnEl, {
      theme: 'outline', size: 'large', width: 400,
      text: 'signin_with', shape: 'rectangular'
    });
  }
}

async function handleGoogleResponse(response) {
  showPageLoader('Signing you in...');
  const result = await apiCall('/auth/google', 'POST', { credential: response.credential });
  hidePageLoader();
  if (!result || !result.success) {
    showToast(result?.message || 'Google sign-in failed', 'error');
    return;
  }
  setAuth(result.token, result.user);
  showToast(`Welcome, ${result.user.name}!`, 'success');
  setTimeout(redirectByRole, 800);
}

// ── Email Login ──────────────────────────────────────────────
async function handleEmailLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  if (!email || !password) { showToast('Please enter email and password', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  const result = await apiCall('/auth/login', 'POST', { email, password });

  btn.disabled = false;
  btn.textContent = 'Sign In';

  if (!result || !result.success) {
    showToast(result?.message || 'Login failed', 'error');
    return;
  }
  setAuth(result.token, result.user);
  showToast(`Welcome back, ${result.user.name}!`, 'success');
  setTimeout(redirectByRole, 800);
}

// ── Logout ───────────────────────────────────────────────────
async function logout() {
  await apiCall('/auth/logout', 'POST');
  clearAuth();
  window.location.href = '/index.html';
}

// ── Change Password ──────────────────────────────────────────
async function handleChangePassword(e) {
  e.preventDefault();
  const current  = document.getElementById('current-password').value;
  const newPass  = document.getElementById('new-password').value;
  const confirm  = document.getElementById('confirm-password').value;

  if (newPass !== confirm) { showToast('Passwords do not match', 'error'); return; }
  if (newPass.length < 8)  { showToast('Password must be at least 8 characters', 'error'); return; }

  const result = await apiCall('/auth/change-password', 'PUT', { currentPassword: current, newPassword: newPass });
  if (result?.success) {
    showToast('Password changed successfully', 'success');
    e.target.reset();
  } else {
    showToast(result?.message || 'Failed to change password', 'error');
  }
}

// ── Update Profile ───────────────────────────────────────────
async function handleUpdateProfile(e) {
  e.preventDefault();
  const formData = new FormData();
  formData.append('name',  document.getElementById('profile-name').value);
  formData.append('phone', document.getElementById('profile-phone').value);
  formData.append('bio',   document.getElementById('profile-bio').value);

  const twitterVal     = document.getElementById('profile-twitter');
  const linkedinVal    = document.getElementById('profile-linkedin');
  const researchgateVal= document.getElementById('profile-researchgate');

  if (twitterVal)      formData.append('twitter',      twitterVal.value);
  if (linkedinVal)     formData.append('linkedin',     linkedinVal.value);
  if (researchgateVal) formData.append('researchgate', researchgateVal.value);

  const photoFile = document.getElementById('profile-photo')?.files[0];
  if (photoFile) formData.append('photo', photoFile);

  const result = await apiCall('/auth/update-profile', 'PUT', formData, true);
  if (result?.success) {
    setAuth(getToken(), result.user);
    showToast('Profile updated successfully', 'success');
    fillSidebarUser();
  } else {
    showToast(result?.message || 'Failed to update profile', 'error');
  }
}

// ── Page Loader helpers ──────────────────────────────────────
function showPageLoader(msg = 'Loading...') {
  let el = document.getElementById('page-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'page-loader';
    el.className = 'page-loader';
    el.innerHTML = `<div class="page-loader-logo">Bio<em>Xape</em></div>
      <div class="spinner"></div>
      <p id="loader-msg" style="font-size:13px;color:#7a9e8c">${msg}</p>`;
    document.body.appendChild(el);
  } else {
    document.getElementById('loader-msg').textContent = msg;
    el.style.display = 'flex';
  }
}
function hidePageLoader() {
  const el = document.getElementById('page-loader');
  if (el) el.style.display = 'none';
}

// ── Auto-attach form listeners ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const loginForm   = document.getElementById('login-form');
  const profileForm = document.getElementById('profile-form');
  const passForm    = document.getElementById('change-password-form');
  const logoutBtns  = document.querySelectorAll('.btn-logout');

  if (loginForm)   loginForm.addEventListener('submit', handleEmailLogin);
  if (profileForm) profileForm.addEventListener('submit', handleUpdateProfile);
  if (passForm)    passForm.addEventListener('submit', handleChangePassword);
  logoutBtns.forEach(btn => btn.addEventListener('click', logout));

  // Init Google auth if on login page
  if (document.getElementById('google-signin-btn')) {
    if (window.google) initGoogleAuth();
    else window.addEventListener('load', initGoogleAuth);
  }

  // Redirect if already logged in and on login page
  if (document.body.dataset.page === 'login' && isLoggedIn()) redirectByRole();
});
