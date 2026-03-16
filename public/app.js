let dashboardData = [];
let currentUser = null;

// --- AUTH LOGIC ---

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            currentUser = await res.json();
            showDashboard();
        } else {
            showAuth();
        }
    } catch (e) { showAuth(); }
}

async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (res.ok) {
        currentUser = (await res.json()).user;
        showDashboard();
        toast('Authentication Successful');
    } else {
        alert('ACCESS_DENIED: Invalid credentials');
    }
}

async function signup() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-pass').value;
    const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    if (res.ok) {
        const data = await res.json();
        alert(`Account created! Your UID is ${data.uid}. Please login.`);
        toggleAuthForm();
    } else {
        alert('REGISTRATION_FAILED: Email might be taken');
    }
}

function logout() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => {
        currentUser = null;
        location.reload();
    });
}

function showAuth() {
    document.getElementById('auth-overlay').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
}

function showDashboard() {
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay) {
        authOverlay.classList.add('hidden');
    }
    
    document.getElementById('app-content').classList.remove('hidden');

    // Personalized Welcome
    const welcomeText = document.getElementById('welcome-text');
    if (welcomeText) {
        welcomeText.innerHTML = `Welcome, <span class="text-neonCyan">${currentUser.name.split(' ')[0]}</span>`;
    }
    // Mobile fallback elements
    const welcomeTextMobile = document.getElementById('welcome-text-mobile');
    if (welcomeTextMobile) welcomeTextMobile.innerHTML = `Welcome, <span class="text-neonCyan">${currentUser.name.split(' ')[0]}</span>`;

    // Still update the hidden UID container for any internal refs
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = `UID: ${currentUser.uid}`;
    const userDisplayMobile = document.getElementById('user-display-mobile');
    if (userDisplayMobile) userDisplayMobile.innerText = `UID: ${currentUser.uid}`;

    if (currentUser.role === 'admin') {
        const adminBadge = document.getElementById('admin-badge');
        const stockInventoryBtn = document.getElementById('stock-inventory-btn');
        const adminSection = document.getElementById('admin-dashboard-section');

        if (adminBadge) adminBadge.classList.remove('hidden');
        if (stockInventoryBtn) stockInventoryBtn.classList.remove('hidden');
        if (adminSection) adminSection.classList.remove('hidden');
        
        loadInventory();
    } else {
        const adminBadge = document.getElementById('admin-badge');
        const stockInventoryBtn = document.getElementById('stock-inventory-btn');
        const adminSection = document.getElementById('admin-dashboard-section');

        if (adminBadge) adminBadge.classList.add('hidden');
        if (stockInventoryBtn) stockInventoryBtn.classList.add('hidden');
        if (adminSection) adminSection.classList.add('hidden');
        
        // If a non-admin tries to access admin.html, redirect them to home
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = '/';
        }
    }
    fetchDashboard();
}

function toggleAuthForm() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('signup-form').classList.toggle('hidden');
}

// --- DASHBOARD LOGIC ---

async function fetchDashboard() {
    try {
        const res = await fetch('/api/dashboard');
        dashboardData = await res.json();
        renderDashboard();
    } catch (err) { }
}

function renderDashboard() {
    const grid = document.getElementById('dashboard-grid');
    if (!dashboardData || dashboardData.length === 0) {
        grid.innerHTML = `<div class="col-span-full border border-dashed border-white/10 rounded-[2rem] p-20 text-center opacity-20 uppercase tracking-[1em] text-xs">Awaiting Initial Uplink</div>`;
        return;
    }

    grid.innerHTML = dashboardData.map(item => `
        <div class="glass p-8 rounded-[2rem] hover:bg-white/[0.07] transition-all group relative overflow-hidden">
            <div class="absolute -top-12 -right-12 w-32 h-32 bg-neonCyan opacity-[0.03] blur-3xl rounded-full group-hover:opacity-[0.1] transition-opacity"></div>
            
            <div class="flex flex-col mb-6">
                <!-- Top row: name/badge left, timer right -->
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center gap-2">
                        <p class="text-[10px] uppercase font-bold text-slate-500 tracking-widest">${item.name}</p>
                        ${item.service_type ? `<span class="text-[8px] bg-neonCyan/10 text-neonCyan px-2 py-0.5 rounded font-black border border-neonCyan/20">${item.service_type.toUpperCase()}</span>` : ''}
                    </div>
                    <!-- VISUAL TIMER -->
                    <div class="flex items-center justify-center w-10 h-10 rounded-full border border-neonCyan/30 bg-neonCyan/5 shadow-[0_0_15px_rgba(0,243,255,0.1)] shrink-0" title="Code Refreshes In...">
                        <span class="text-neonCyan font-black text-xs font-cyber leading-none otp-timer">${item.remaining}s</span>
                    </div>
                </div>
                <!-- OTP code row -->
                <div class="flex items-center gap-4">
                    <h2 class="text-4xl font-bold tracking-tighter text-white font-cyber">${formatToken(item.token)}</h2>
                    <button onclick="copyToClipboard('${item.token}')" class="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-neonCyan transition-all active:scale-90" title="Copy Code">
                        <span class="copy-icon text-[10px] font-bold">COPY</span>
                    </button>
                </div>
            </div>
            
            ${item.isPreStocked ? `
            <div class="mb-4 space-y-2 p-4 rounded-xl border border-white/10 bg-white/[0.03]">
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                    <p class="text-[8px] uppercase text-slate-400 font-bold">Subscription Status</p>
                    <span class="text-[9px] font-black ${getExpiryColor(item.creation_date)} px-2 py-0.5 rounded-full border ${getExpiryBorder(item.creation_date)}">
                        ${getExpiryText(item.creation_date)}
                    </span>
                </div>
                <div class="flex justify-between items-end py-1">
                    <div><p class="text-[8px] uppercase text-slate-400 mb-0.5">Email Identifier</p><p class="text-[11px] text-neonCyan font-mono font-bold">${item.email}</p></div>
                    <button onclick="copyToClipboard('${item.email}', 'Email Copied')" class="text-[8px] text-slate-500 hover:text-neonCyan uppercase font-bold transition-colors">Copy</button>
                </div>
                <div class="flex justify-between items-end py-1">
                    <div><p class="text-[8px] uppercase text-slate-400 mb-0.5">Password</p><p class="text-[11px] text-neonCyan font-mono font-bold">${item.password}</p></div>
                    <button onclick="copyToClipboard('${item.password}', 'Password Copied')" class="text-[8px] text-slate-500 hover:text-neonCyan uppercase font-bold transition-colors">Copy</button>
                </div>
            </div>
            ` : ''}

            <div class="flex justify-between items-center pt-4 border-t border-white/5 mt-2">
                <div class="text-[8px] uppercase tracking-widest text-slate-600">Sync: SHA-1 // Active</div>
                <button class="text-[10px] text-slate-500 hover:text-red-500 font-bold tracking-widest transition-colors" onclick="terminateLink(${item.id})">TERMINATE</button>
            </div>
        </div>
    `).join('');
}

function formatToken(token) {
    return token.substring(0, 3) + ' ' + token.substring(3);
}

function terminateLink(id) {
    showSecureConfirm('Confirm deactivation of this link?').then(confirmed => {
        if (confirmed) {
            fetch('/api/terminate/' + id, { method: 'DELETE' }).then(() => {
                toast('Uplink Terminated');
                fetchDashboard();
            });
        }
    });
}

async function addAccount() {
    const name = document.getElementById('add-name').value;
    const secret = document.getElementById('add-secret').value;
    if (!name || !secret) return;
    const res = await fetch('/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, secret })
    });
    if (res.ok) {
        toggleModal('add-modal');
        fetchDashboard();
        toast('Link Established');
    }
}

// --- ADMIN LOGIC ---

async function stockAccount() {
    const email = document.getElementById('stock-email').value;
    const password = document.getElementById('stock-pass').value;
    const secret = document.getElementById('stock-secret').value;
    const serviceType = document.getElementById('stock-service-type').value;
    const creationDate = document.getElementById('stock-date').value;
    if (!email || !password || !secret || !creationDate) return toast('All fields required');

    const res = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, secret, serviceType, creationDate })
    });
    if (res.ok) {
        toast('Account initialized');
        loadInventory();
        document.getElementById('stock-email').value = '';
        document.getElementById('stock-pass').value = '';
        document.getElementById('stock-secret').value = '';
    }
}

async function assignAccount() {
    const stockId = document.getElementById('stock-select').value;
    const userUid = document.getElementById('assign-uid').value;
    if (!stockId || !userUid) return toast('Select stock and enter UID');

    const res = await fetch('/api/admin/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId, userUid })
    });
    if (res.ok) {
        toast('Link established');
        loadInventory();
        document.getElementById('assign-uid').value = '';
    }
}

async function loadInventory() {
    try {
        const res = await fetch('/api/admin/inventory');
        const items = await res.json();
        console.log('ADMIN_INVENTORY_DEBUG:', items);
        const select = document.getElementById('stock-select');
        if (select) select.innerHTML = items.filter(i => !i.assigned_to_uid).map(i => `<option value="${i.id}">${i.email}</option>`).join('');

        const inventoryBody = document.getElementById('stock-inventory-body');
        if (inventoryBody) {
            inventoryBody.innerHTML = items.map(i => `
                <tr class="border-t border-white/5 bg-white/${i.assigned_to_uid ? '0' : '5'}">
                    <td class="p-3 text-slate-300 font-mono text-[9px] truncate max-w-[100px]">${i.email}</td>
                    <td class="p-3 text-slate-500 text-[8px] uppercase font-bold">${i.service_type || 'Plus'}</td>
                    <td class="p-3 text-neonCyan font-cyber text-[10px] tracking-widest">${i.token ? formatToken(i.token) : '--- ---'}</td>
                    <td class="p-3 text-center">
                        <span class="text-[8px] font-black ${getExpiryColor(i.creation_date)} px-2 py-0.5 rounded-full border ${getExpiryBorder(i.creation_date)}">
                            ${getExpiryText(i.creation_date)}
                        </span>
                    </td>
                    <td class="p-3 ${i.assigned_to_uid ? 'text-neonCyan' : 'text-slate-500'}">
                        ${i.assigned_to_uid ? `ID: ${i.assigned_to_uid}` : 'AVAILABLE'}
                    </td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            ${i.assigned_to_uid ? `<button data-id="${i.id}" class="admin-unassign-btn text-neonCyan hover:text-white font-bold uppercase transition-colors px-3 py-1 text-[8px] bg-neonCyan/10 rounded-lg border border-neonCyan/20">Unlink</button>` : ''}
                            <button data-id="${i.id}" class="admin-del-btn text-red-500 hover:text-white font-bold uppercase transition-colors px-3 py-1 text-[8px] bg-red-500/10 rounded-lg border border-red-500/20">Del</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        const uRes = await fetch('/api/admin/users');
        const users = await uRes.json();
        const userBody = document.getElementById('user-registry-body');
        if (userBody) {
            userBody.innerHTML = users.map(u => `
                <tr class="border-t border-white/5">
                    <td class="p-3 text-slate-300 font-bold">${u.name}</td>
                    <td class="p-3 text-neonCyan font-mono">${u.uid_4}</td>
                    <td class="p-3">
                        ${u.uid_4 !== '0001' ? `<button data-uid="${u.uid_4}" class="admin-purge-btn text-red-500 hover:text-red-400 font-bold uppercase transition-colors px-2">Purge</button>` : '<span class="opacity-20">Locked</span>'}
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) { console.error('LOAD_INVENTORY_ERROR', e); }
}

// Custom Modal Logic
function showSecureConfirm(msg) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-msg');
        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        msgEl.innerText = msg;
        modal.classList.remove('hidden');

        const cleanup = (val) => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(val);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
    });
}

// Event Delegation for Admin Buttons
document.addEventListener('click', (e) => {
    // Robust detection using closest for both button and icon (if added later)
    const purgeBtn = e.target.closest('.admin-purge-btn');
    const delBtn = e.target.closest('.admin-del-btn');

    if (purgeBtn) {
        const uid = purgeBtn.getAttribute('data-uid');
        showSecureConfirm(`ADMIN_PURGE_PROTOCOL: Permanent deletion of user ${uid}?`).then(confirmed => {
            if (confirmed) {
                fetch(`/api/admin/users/${uid}`, { method: 'DELETE' }).then(res => {
                    if (res.ok) { toast('User Purged'); loadInventory(); }
                    else res.json().then(data => alert(data.error || 'Purge Failed'));
                });
            }
        });
    }

    if (delBtn) {
        const id = delBtn.getAttribute('data-id');
        showSecureConfirm('ADMIN_INVENTORY_PROTOCOL: Remove this item from stock?').then(confirmed => {
            if (confirmed) {
                fetch(`/api/admin/inventory/${id}`, { method: 'DELETE' }).then(res => {
                    if (res.ok) { toast('Stock Removed'); loadInventory(); }
                });
            }
        });
    }

    const unassignBtn = e.target.closest('.admin-unassign-btn');
    if (unassignBtn) {
        const stockId = unassignBtn.getAttribute('data-id');
        showSecureConfirm('ADMIN_UPLINK_PROTOCOL: Detach this account from the user?').then(confirmed => {
            if (confirmed) {
                fetch('/api/admin/unassign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stockId })
                }).then(res => {
                    if (res.ok) { toast('Account Unlinked'); loadInventory(); fetchDashboard(); }
                });
            }
        });
    }
});

// --- UTILS ---

function toggleModal(id) { document.getElementById(id).classList.toggle('hidden'); }

function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerText = msg;
    el.classList.add('show');
    el.classList.remove('opacity-0');
    setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('opacity-0');
    }, 2000);
}

function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => toast(label || 'Code Copied'));
}

setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = 30 - (now % 30);
    const syncTimer = document.getElementById('sync-timer');
    const syncProgress = document.getElementById('sync-progress');

    if (syncTimer) syncTimer.innerText = remaining;
    if (syncProgress) syncProgress.style.width = (remaining / 30 * 100) + '%';
    
    document.querySelectorAll('.otp-timer').forEach(el => {
        el.innerText = remaining + 's';
    });

    if (remaining === 30) {
        fetchDashboard();
        if (currentUser && currentUser.role === 'admin') loadInventory();
    }
}, 1000);

checkAuth();
fetchDashboard();

function getExpiryText(dateStr) {
    if (!dateStr) return 'LIFETIME';
    const created = new Date(dateStr);
    const expires = new Date(created.getTime() + (30 * 24 * 60 * 60 * 1000));
    const now = new Date();
    const diff = expires - now;
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));

    if (days <= 0) return 'EXPIRED';
    return `EXPIRES IN ${days}D`;
}

function getExpiryColor(dateStr) {
    if (!dateStr) return 'text-slate-500';
    const text = getExpiryText(dateStr);
    if (text === 'EXPIRED') return 'text-red-500 bg-red-500/10';
    if (text.includes('1D') || text.includes('2D')) return 'text-orange-500 bg-orange-500/10';
    return 'text-neonCyan bg-neonCyan/10';
}

function getExpiryBorder(dateStr) {
    if (!dateStr) return 'border-white/10';
    const text = getExpiryText(dateStr);
    if (text === 'EXPIRED') return 'border-red-500/20';
    if (text.includes('1D') || text.includes('2D')) return 'border-orange-500/20';
    return 'border-neonCyan/20';
}
