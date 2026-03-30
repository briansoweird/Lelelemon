/* ══════════════════════════════════════════════════════════════
   LELELEMON POS  ·  app.js
   Powered by Supabase  ·  see SETUP.html for connection guide
   ══════════════════════════════════════════════════════════════ */


/* ─────────────────────────────────────────────────────────────
   ① PASTE YOUR SUPABASE CREDENTIALS HERE
   (find them in: supabase.com → your project → Settings → API)
   ───────────────────────────────────────────────────────────── */
   const SUPABASE_URL = 'https://rdnkwvawitasfkgjuxoc.supabase.co';
   const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkbmt3dmF3aXRhc2ZrZ2p1eG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMjMyODYsImV4cCI6MjA4Nzg5OTI4Nn0.TU7J416dbeObLMYMRahmkl-w1k9ORbkGpqDyE-vAh-8';
   
   
   /* ─────────────────────────────────────────────────────────────
      LOCAL MODE — automatically true when:
        • Credentials are still the placeholders, OR
        • App is opened as a local file (file://)
      In local mode all DB calls are skipped silently and the app
      works entirely from in-memory data.
      ───────────────────────────────────────────────────────────── */
   const IS_LOCAL_MODE =
     SUPABASE_URL.includes('YOUR_PROJECT') ||
     SUPABASE_KEY.includes('YOUR_ANON')    ||
     (typeof location !== 'undefined' && location.protocol === 'file:');
   
   
   /* ══════════════════════════════════════════════════════════════
      SUPABASE HELPER  —  lightweight fetch wrapper
      No external SDK needed; uses the Supabase REST API directly.
      ══════════════════════════════════════════════════════════════ */
   const sb = {
     headers(extra = {}) {
       return {
         apikey:          SUPABASE_KEY,
         Authorization:   `Bearer ${SUPABASE_KEY}`,
         'Content-Type':  'application/json',
         ...extra,
       };
     },
   
     async get(table, query = '') {
       const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
         headers: this.headers(),
       });
       if (!res.ok) throw new Error(`GET ${table} failed: ${res.status}`);
       return res.json();
     },
   
     async post(table, body) {
       const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
         method:  'POST',
         headers: this.headers({ Prefer: 'return=representation' }),
         body:    JSON.stringify(body),
       });
       if (!res.ok) throw new Error(`POST ${table} failed: ${res.status}`);
       const rows = await res.json();
       return rows[0];
     },
   
     async patch(table, filter, body) {
       const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
         method:  'PATCH',
         headers: this.headers({ Prefer: 'return=representation' }),
         body:    JSON.stringify(body),
       });
       if (!res.ok) throw new Error(`PATCH ${table} failed: ${res.status}`);
       const rows = await res.json();
       return rows[0];
     },
   
     async delete(table, filter) {
       const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
         method:  'DELETE',
         headers: this.headers(),
       });
       if (!res.ok) throw new Error(`DELETE ${table} failed: ${res.status}`);
     },
   };
   
   
   /* ══════════════════════════════════════════════════════════════
      DATABASE LAYER  —  all app data flows through here
      ══════════════════════════════════════════════════════════════ */
   const db = {
   
     /* Load everything on login */
     async loadAll() {
       const [categories, menu] = await Promise.all([
         sb.get('categories', '?order=sort_order'),
         sb.get('menu_items',  '?order=id'),
       ]);
   
       // Map Supabase snake_case → app camelCase
       return {
         categories: categories.map(c => ({
           id:        c.id,
           label:     c.label,
           emoji:     c.emoji,
           isDefault: c.is_default,
         })),
         menu: menu.map(m => ({
           id:        m.id,
           cat:       m.cat,
           emoji:     m.emoji,
           name:      m.name,
           desc:      m.description,
           price:     parseFloat(m.price),
           available: m.available,
           photo:     m.photo || null,
         })),
       };
     },
   
     /* Save category (create or update) */
     async saveCategory(cat) {
       const payload = {
         id:         cat.id,
         emoji:      cat.emoji,
         label:      cat.label,
         is_default: cat.isDefault ?? false,
       };
       if (cat._isNew) {
         return sb.post('categories', payload);
       } else {
         return sb.patch('categories', `id=eq.${cat.id}`, payload);
       }
     },
   
     /* Delete category — items are cascade-deleted by DB foreign key */
     async deleteCategory(catId) {
       await sb.delete('categories', `id=eq.${catId}`);
     },
   
     /* Save menu item (create or update) */
     async saveItem(item) {
       const payload = {
         cat:         item.cat,
         emoji:       item.emoji,
         name:        item.name,
         description: item.desc,
         price:       item.price,
         available:   item.available,
         photo:       item.photo || null,
       };
       if (item._isNew) {
         // Supabase assigns the serial id; we return it so local array stays in sync
         return sb.post('menu_items', payload);
       } else {
         return sb.patch('menu_items', `id=eq.${item.id}`, payload);
       }
     },
   
     /* Delete menu item */
     async deleteItem(itemId) {
       await sb.delete('menu_items', `id=eq.${itemId}`);
     },
   };
   
   
   /* ══════════════════════════════════════════════════════════════
      AUTH  (local credentials — swap for Supabase Auth if needed)
      ══════════════════════════════════════════════════════════════ */
   /* ── ACCOUNTS — stored in localStorage, seeded with defaults ── */
   const PROTECTED_USERS = ['admin'];  // cannot be deleted
   
   function loadAccounts() {
     const stored = localStorage.getItem('lelelemon_accounts');
     if (stored) return JSON.parse(stored);
     // Default accounts on first run
     const defaults = [
       { username:'admin',   password:'lelelemon123', name:'Admin',   role:'admin',   color:'#1A1A00' },
       { username:'manager', password:'manager456',   name:'Manager', role:'manager', color:'#7C3AED' },
     ];
     localStorage.setItem('lelelemon_accounts', JSON.stringify(defaults));
     return defaults;
   }
   
   function saveAccounts(accounts) {
     localStorage.setItem('lelelemon_accounts', JSON.stringify(accounts));
   }
   
   let ACCOUNTS    = loadAccounts();
   let currentUser = null;   // username string
   let currentAcct = null;   // full account object
   
   /* ── Sessions — track time-in / time-out per login ── */
   let SESSIONS = JSON.parse(localStorage.getItem('lelelemon_sessions') || '[]');
   // Persist session id across refreshes so logout always records timeOut correctly
   let _currentSessionId = parseInt(localStorage.getItem('lelelemon_curSession') || '0') || null;
   
   function startSession(acct) {
     _currentSessionId = Date.now();
     const session = {
       id:       _currentSessionId,
       username: acct.username,
       name:     acct.name || acct.username,
       role:     acct.role,
       color:    acct.color || '#1A1A00',
       timeIn:   new Date().toISOString(),
       timeOut:  null,
       duration: null,
     };
     SESSIONS.push(session);
     try {
       localStorage.setItem('lelelemon_sessions',   JSON.stringify(SESSIONS));
       localStorage.setItem('lelelemon_curSession', String(_currentSessionId));
     } catch(e) {}
   }
   
   function endSession() {
     if (!_currentSessionId) return;
     const session = SESSIONS.find(s => s.id === _currentSessionId);
     if (session && !session.timeOut) {
       session.timeOut  = new Date().toISOString();
       const mins = Math.round((new Date(session.timeOut) - new Date(session.timeIn)) / 60000);
       session.duration = mins;
       try { localStorage.setItem('lelelemon_sessions', JSON.stringify(SESSIONS)); } catch(e) {}
     }
     _currentSessionId = null;
     try { localStorage.removeItem('lelelemon_curSession'); } catch(e) {}
   }
   
   function doLogin() {
     const userEl  = document.getElementById('loginUser');
     const passEl  = document.getElementById('loginPass');
     const errEl   = document.getElementById('loginError');
     const btn     = document.getElementById('loginBtn');
     const btnText = document.getElementById('loginBtnText');
     const user    = userEl.value.trim();
     const pass    = passEl.value;
   
     userEl.classList.remove('error');
     passEl.classList.remove('error');
     errEl.classList.remove('show');
     document.getElementById('userError').textContent = '';
     document.getElementById('passError').textContent = '';
   
     let valid = true;
     if (!user) { userEl.classList.add('error'); document.getElementById('userError').textContent = 'Username is required.'; valid = false; }
     if (!pass) { passEl.classList.add('error'); document.getElementById('passError').textContent = 'Password is required.'; valid = false; }
     if (!valid) return;
   
     btn.classList.add('loading');
     btnText.textContent = 'Signing in…';
   
     setTimeout(async () => {
       btn.classList.remove('loading');
       btnText.textContent = 'Sign In';
   
       const acct = ACCOUNTS.find(a => a.username === user && a.password === pass);
       if (acct) {
         currentUser = user;
         currentAcct = acct;
         // Persist login so page refresh keeps the user in
         try { localStorage.setItem('lelelemon_loggedIn', user); } catch(e) {}
         userEl.value = '';
         passEl.value = '';
         document.getElementById('loginOverlay').style.display = 'none';
   
         if (acct.role === 'cashier') {
           // Cashiers go to the Time-In/Out screen
           showCashierScreen(acct);
         } else {
           // Admin / Manager go straight to POS
           document.getElementById('posApp').style.display         = 'flex';
           document.getElementById('loggedInUser').textContent     = '👤 ' + (acct.name || user);
           document.getElementById('managerModeBtn').style.display = (acct.role === 'manager' || acct.role === 'admin') ? 'inline-block' : 'none';
         }
   
         // ── Pull live data from Supabase (skipped in local mode) ──
         const syncEl = document.getElementById('syncIndicator');
   
         if (IS_LOCAL_MODE) {
           // Running locally — hide the sync indicator entirely, no errors shown
           syncEl.style.display = 'none';
         } else {
           syncEl.style.display = 'flex';
           setSyncState('syncing', 'Loading…');
           try {
             const data = await db.loadAll();
             CATEGORIES = data.categories;
             MENU       = data.menu;
             const maxId = MENU.reduce((m, i) => Math.max(m, i.id), 0);
             nextId = maxId + 1;
             setSyncState('ok', 'Synced');
           } catch (e) {
             console.error('[Supabase] loadAll failed:', e);
             showToast('⚠️ Could not reach Supabase — using local data');
             setSyncState('error', 'Offline');
           }
         }
   
         // Session starts when cashier presses Clock In (not on login)
         renderCategoryBar();
         renderMenu(currentCat);
         updateCartBadge();
   
       } else {
         errEl.textContent = '⚠️ Incorrect username or password.';
         errEl.classList.add('show');
         passEl.classList.add('error');
         passEl.value = '';
         passEl.focus();
       }
     }, 700);
   }
   
   function doLogout() {
     if (currentAcct?.role === 'cashier') endSession();
     currentUser = null;
     currentAcct = null;
     try { localStorage.removeItem('lelelemon_loggedIn'); } catch(e) {}
     document.getElementById('posApp').style.display          = 'none';
     document.getElementById('cashierScreen').style.display   = 'none';
     document.getElementById('loginOverlay').style.display    = 'flex';
     stopCashierClock();
     closeManagerPanel();
     clearOrder();
     renderLoginTiles();
   }
   
   function renderLoginTiles() {
     const el = document.getElementById('loginAccounts');
     if (!el) return;
     if (!ACCOUNTS.length) { el.innerHTML = ''; return; }
     el.innerHTML = `
       <div class="login-accounts-label">Quick Sign In</div>
       <div class="login-account-tiles">
         ${ACCOUNTS.map(a => {
           const initials = (a.name || a.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
           const roleLabel = a.role === 'admin' ? 'Admin' : a.role === 'manager' ? 'Manager' : 'Cashier';
           return `<div class="login-acct-tile" onclick="quickLogin('${a.username}')">
             <div class="login-acct-avatar" style="background:${a.color||'#1A1A00'}">${initials}</div>
             <div class="login-acct-info">
               <div class="login-acct-name">${a.name || a.username}</div>
               <div class="login-acct-role">${roleLabel}</div>
             </div>
           </div>`;
         }).join('')}
       </div>`;
   }
   
   function quickLogin(username) {
     document.getElementById('loginUser').value = username;
     document.getElementById('loginPass').value = '';
     document.getElementById('loginPass').focus();
   }
   
   function togglePass() {
     const p = document.getElementById('loginPass');
     const b = document.getElementById('toggleBtn');
     p.type = p.type === 'password' ? 'text' : 'password';
     b.textContent = p.type === 'password' ? '👁' : '🙈';
   }
   
   function loginOnEnter(e) { if (e.key === 'Enter') doLogin(); }
   
   
   /* ══════════════════════════════════════════════════════════════
      MOBILE TAB SWITCHING
      ══════════════════════════════════════════════════════════════ */
   function switchTab(tab) {
     const layout  = document.getElementById('posLayout');
     const navMenu = document.getElementById('navMenu');
     const navCart = document.getElementById('navCart');
     if (tab === 'cart') {
       layout.classList.add('show-order');
       navMenu.classList.remove('active');
       navCart.classList.add('active');
     } else {
       layout.classList.remove('show-order');
       navMenu.classList.add('active');
       navCart.classList.remove('active');
     }
   }
   
   function updateCartBadge() {
     const total = Object.values(cart).reduce((s, i) => s + i.qty, 0);
     const badge = document.getElementById('cartBadge');
     if (!badge) return;
     badge.textContent = total;
     badge.classList.toggle('show', total > 0);
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      SYNC INDICATOR
      ══════════════════════════════════════════════════════════════ */
   function setSyncState(state, label) {
     const dot = document.querySelector('.sync-dot');
     const lbl = document.getElementById('syncLabel');
     if (!dot || !lbl) return;
     dot.className   = 'sync-dot' + (state !== 'ok' ? ' ' + state : '');
     lbl.textContent = label;
   }
   
   async function syncOp(fn) {
     // In local mode, skip all DB calls silently — data lives in memory only
     if (IS_LOCAL_MODE) return;
   
     setSyncState('syncing', 'Saving…');
     try {
       await fn();
       setSyncState('ok', 'Saved');
     } catch (e) {
       console.error('[Supabase] syncOp failed:', e);
       setSyncState('error', 'Failed');
       showToast('⚠️ Could not save to database.');
     }
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      LOCAL DATA  (shown before Supabase loads, or if offline)
      ══════════════════════════════════════════════════════════════ */
   let nextId = 18;
   
   let CATEGORIES = [
     { id: 'lemonade', label: '🍋 Lemonades', emoji: '🍋', isDefault: true },
     { id: 'sparkle',  label: '✨ Sparkling',  emoji: '✨', isDefault: true },
     { id: 'slush',    label: '🧊 Slushes',    emoji: '🧊', isDefault: true },
     { id: 'snack',    label: '🍪 Snacks',     emoji: '🍪', isDefault: true },
     { id: 'combo',    label: '🎁 Combos',     emoji: '🎁', isDefault: true },
   ];
   
   let MENU = [
     { id: 1,  cat: 'lemonade', emoji: '🍋', name: 'Classic Lemonade',    desc: 'Fresh-squeezed, perfectly sweet',  price: 85,  available: true, photo: null },
     { id: 2,  cat: 'lemonade', emoji: '🍓', name: 'Strawberry Lemonade', desc: 'Fruity & tangy blend',             price: 99,  available: true, photo: null },
     { id: 3,  cat: 'lemonade', emoji: '🫐', name: 'Blueberry Lemonade',  desc: 'Antioxidant-rich twist',           price: 105, available: true, photo: null },
     { id: 4,  cat: 'lemonade', emoji: '🌿', name: 'Mint Lemonade',       desc: 'Cool & refreshing',                price: 95,  available: true, photo: null },
     { id: 5,  cat: 'lemonade', emoji: '🥭', name: 'Mango Lemonade',      desc: 'Tropical sunshine in a cup',       price: 110, available: true, photo: null },
     { id: 6,  cat: 'lemonade', emoji: '🍑', name: 'Peach Lemonade',      desc: 'Soft & sweet Georgia style',       price: 105, available: true, photo: null },
     { id: 7,  cat: 'sparkle',  emoji: '✨', name: 'Classic Sparkle',     desc: 'Sparkling lemonade fizz',          price: 99,  available: true, photo: null },
     { id: 8,  cat: 'sparkle',  emoji: '🌸', name: 'Rose Sparkle',        desc: 'Floral & bubbly delight',          price: 115, available: true, photo: null },
     { id: 9,  cat: 'sparkle',  emoji: '🍇', name: 'Grape Sparkle',       desc: 'Purple fizzy lemonade',            price: 115, available: true, photo: null },
     { id: 10, cat: 'slush',    emoji: '🧊', name: 'Lemon Slush',         desc: 'Ice-cold frozen lemonade',         price: 120, available: true, photo: null },
     { id: 11, cat: 'slush',    emoji: '🍓', name: 'Berry Slush',         desc: 'Mixed berry frozen blend',         price: 130, available: true, photo: null },
     { id: 12, cat: 'slush',    emoji: '🥝', name: 'Kiwi Slush',          desc: 'Tart & icy kiwi lemonade',         price: 130, available: true, photo: null },
     { id: 13, cat: 'snack',    emoji: '🍪', name: 'Lemon Cookie',        desc: 'Zesty shortbread cookie',          price: 45,  available: true, photo: null },
     { id: 14, cat: 'snack',    emoji: '🍰', name: 'Lemon Tart',          desc: 'Creamy citrus custard',            price: 85,  available: true, photo: null },
     { id: 15, cat: 'snack',    emoji: '🧁', name: 'Lemon Cupcake',       desc: 'Fluffy & frosted delight',         price: 75,  available: true, photo: null },
     { id: 16, cat: 'combo',    emoji: '🎁', name: 'Classic Combo',       desc: 'Classic + cookie bundle',          price: 120, available: true, photo: null },
     { id: 17, cat: 'combo',    emoji: '⭐', name: 'VIP Combo',           desc: 'Sparkle + tart + cookie',          price: 225, available: true, photo: null },
   ];
   
   let cart      = {};
   let payMethod = 'cash';
   let orderNum  = parseInt(localStorage.getItem('lelelemon_orderNum') || '1');
   let currentCat = 'all';
   
   /* ── Sales log — persisted in localStorage so it survives refresh ── */
   let SALES = JSON.parse(localStorage.getItem('lelelemon_sales') || '[]');
   
   // Only seed demo data on the very first visit — never after a manual clear
   const _neverSeeded  = !localStorage.getItem('lelelemon_seeded');
   const _userCleared  =  localStorage.getItem('lelelemon_cleared') === '1';
   
   if (!SALES.length && _neverSeeded && !_userCleared) {
     localStorage.setItem('lelelemon_seeded', '1');
     const now = new Date();
     const methods = ['cash', 'cash', 'gcash', 'card', 'cash', 'gcash', 'cash', 'card'];
     const demoOrders = [
       [{ id:1,name:'Classic Lemonade',emoji:'🍋',cat:'lemonade',price:85,qty:2  },
        { id:13,name:'Lemon Cookie',   emoji:'🍪',cat:'snack',   price:45,qty:1  }],
       [{ id:7,name:'Classic Sparkle', emoji:'✨',cat:'sparkle', price:99,qty:1  },
        { id:8,name:'Rose Sparkle',    emoji:'🌸',cat:'sparkle', price:115,qty:1 }],
       [{ id:5,name:'Mango Lemonade',  emoji:'🥭',cat:'lemonade',price:110,qty:3 }],
       [{ id:17,name:'VIP Combo',      emoji:'⭐',cat:'combo',   price:225,qty:1 },
        { id:10,name:'Lemon Slush',    emoji:'🧊',cat:'slush',   price:120,qty:2 }],
       [{ id:2,name:'Strawberry Lemonade',emoji:'🍓',cat:'lemonade',price:99,qty:1},
        { id:14,name:'Lemon Tart',     emoji:'🍰',cat:'snack',   price:85,qty:2  }],
       [{ id:11,name:'Berry Slush',    emoji:'🍓',cat:'slush',   price:130,qty:2 },
        { id:15,name:'Lemon Cupcake',  emoji:'🧁',cat:'snack',   price:75,qty:1  }],
       [{ id:16,name:'Classic Combo',  emoji:'🎁',cat:'combo',   price:120,qty:2 }],
       [{ id:4,name:'Mint Lemonade',   emoji:'🌿',cat:'lemonade',price:95,qty:1  },
        { id:9,name:'Grape Sparkle',   emoji:'🍇',cat:'sparkle', price:115,qty:1 },
        { id:13,name:'Lemon Cookie',   emoji:'🍪',cat:'snack',   price:45,qty:3  }],
       [{ id:3,name:'Blueberry Lemonade',emoji:'🫐',cat:'lemonade',price:105,qty:2}],
       [{ id:12,name:'Kiwi Slush',     emoji:'🥝',cat:'slush',   price:130,qty:1 },
        { id:17,name:'VIP Combo',      emoji:'⭐',cat:'combo',   price:225,qty:1 }],
       [{ id:6,name:'Peach Lemonade',  emoji:'🍑',cat:'lemonade',price:105,qty:2 },
        { id:15,name:'Lemon Cupcake',  emoji:'🧁',cat:'snack',   price:75,qty:2  }],
       [{ id:1,name:'Classic Lemonade',emoji:'🍋',cat:'lemonade',price:85,qty:4  }],
       [{ id:7,name:'Classic Sparkle', emoji:'✨',cat:'sparkle', price:99,qty:2  },
        { id:14,name:'Lemon Tart',     emoji:'🍰',cat:'snack',   price:85,qty:1  }],
       [{ id:5,name:'Mango Lemonade',  emoji:'🥭',cat:'lemonade',price:110,qty:2 },
        { id:16,name:'Classic Combo',  emoji:'🎁',cat:'combo',   price:120,qty:1 }],
     ];
     demoOrders.forEach((items, i) => {
       const sub   = items.reduce((s, it) => s + it.price * it.qty, 0);
       const total = sub * 1.12;
       const d     = new Date(now);
       d.setDate(d.getDate() - Math.floor(i * 2.1));          // spread across ~28 days
       d.setHours(9 + (i % 8), (i * 17) % 60, 0, 0);
       SALES.push({
         id: i + 1, date: d.toISOString(), method: methods[i % methods.length],
         total: parseFloat(total.toFixed(2)),
         subtotal: parseFloat(sub.toFixed(2)),
         tax: parseFloat((total - sub).toFixed(2)),
         items,
       });
     });
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      HELPERS
      ══════════════════════════════════════════════════════════════ */
   const fmt      = n => '₱' + n.toFixed(2);
   const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
   
   
   /* ══════════════════════════════════════════════════════════════
      CATEGORY BAR  (POS)
      ══════════════════════════════════════════════════════════════ */
   function renderCategoryBar() {
     const bar  = document.getElementById('categoryBar');
     const used = CATEGORIES.filter(c => MENU.some(m => m.cat === c.id));
     bar.innerHTML =
       `<button class="cat-btn ${currentCat === 'all' ? 'active' : ''}" onclick="filterCat('all',this)">All Items</button>` +
       used.map(c => {
         const style = c.color && currentCat === c.id
           ? `style="background:${c.color};border-color:${c.color};color:${isLightColor(c.color)?'#1A1A00':'#FFFEF0'}"`
           : (c.color ? `style="--cat-hover:${c.color}"` : '');
         return `<button class="cat-btn ${currentCat === c.id ? 'active' : ''}" onclick="filterCat('${c.id}',this)" ${style}>${c.emoji} ${catName(c)}</button>`;
       }).join('');
   }
   
   function isLightColor(hex) {
     const h = hex.replace('#','');
     const r = parseInt(h.substr(0,2),16);
     const g = parseInt(h.substr(2,2),16);
     const b = parseInt(h.substr(4,2),16);
     return (r*299 + g*587 + b*114) / 1000 > 140;
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      MENU GRID  (POS)
      ══════════════════════════════════════════════════════════════ */
   function renderMenu(cat = 'all') {
     const grid  = document.getElementById('menuGrid');
     const items = cat === 'all' ? MENU : MENU.filter(m => m.cat === cat);
   
     grid.innerHTML = items.map(item => {
       const media  = item.photo
         ? `<img src="${item.photo}" class="item-card-img" alt="${item.name}" />`
         : `<span class="item-emoji">${item.emoji}</span>`;
       const badge  = item.available ? '' : `<div class="unavailable-badge">Unavailable</div>`;
       const addBtn = item.available
         ? `<button class="item-add-btn" onclick="event.stopPropagation();addItem(${item.id})" type="button">+</button>`
         : '';
       return `
         <div class="item-card ${item.available ? '' : 'unavailable'}"
              onclick="${item.available ? `addItem(${item.id})` : ''}">
           ${badge}${media}
           <div class="item-name">${item.name}</div>
           <div class="item-desc">${item.desc}</div>
           <div class="item-price">${fmt(item.price)}</div>
           ${addBtn}
         </div>`;
     }).join('');
   }
   
   function filterCat(cat, btn) {
     currentCat = cat;
     document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
     btn.classList.add('active');
     renderMenu(cat);
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      CART
      ══════════════════════════════════════════════════════════════ */
   function addItem(id) {
     const item = MENU.find(m => m.id === id);
     if (!item || !item.available) return;
     if (!cart[id]) cart[id] = { ...item, qty: 0 };
     cart[id].qty++;
     renderOrder();
     updateCartBadge();
     showToast(`${item.emoji} ${item.name} added!`);
   }
   
   function changeQty(id, delta) {
     if (!cart[id]) return;
     cart[id].qty += delta;
     if (cart[id].qty <= 0) delete cart[id];
     renderOrder();
     updateCartBadge();
   }
   
   function clearOrder() {
     cart = {};
     renderOrder();
     updateCartBadge();
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      ORDER PANEL
      ══════════════════════════════════════════════════════════════ */
   function renderOrder() {
     const keys      = Object.keys(cart);
     const itemsEl   = document.getElementById('orderItems');
     const countEl   = document.getElementById('orderCount');
     const chargeBtn = document.getElementById('chargeBtn');
   
     if (!keys.length) {
       itemsEl.innerHTML     = `<div class="empty-order"><span class="empty-icon">🍋</span>No items yet.<br>Tap a product to add!</div>`;
       countEl.textContent   = '0 items';
       chargeBtn.disabled    = true;
       chargeBtn.textContent = 'Charge ₱0.00';
       updateTotals(0);
       return;
     }
   
     let totalQty = 0;
     itemsEl.innerHTML = keys.map(id => {
       const it = cart[id];
       totalQty += it.qty;
       const thumb = it.photo
         ? `<img src="${it.photo}" class="oi-img" alt="" />`
         : `<span class="oi-emoji">${it.emoji}</span>`;
       return `
         <div class="order-item">
           ${thumb}
           <div class="oi-info">
             <div class="oi-name">${it.name}</div>
             <div class="oi-price">${fmt(it.price)} each</div>
           </div>
           <div class="oi-qty">
             <button class="qty-btn" onclick="changeQty(${id},-1)" type="button">−</button>
             <span class="qty-num">${it.qty}</span>
             <button class="qty-btn" onclick="changeQty(${id},1)"  type="button">+</button>
           </div>
           <div class="oi-total">${fmt(it.price * it.qty)}</div>
         </div>`;
     }).join('');
   
     countEl.textContent = totalQty + (totalQty === 1 ? ' item' : ' items');
     const sub = keys.reduce((s, id) => s + cart[id].price * cart[id].qty, 0);
     chargeBtn.disabled    = false;
     chargeBtn.textContent = `Charge ${fmt(sub * 1.12)}`;
     updateTotals(sub);
   }
   
   function updateTotals(sub) {
     const tax = sub * 0.12;
     document.getElementById('subtotal').textContent = fmt(sub);
     document.getElementById('tax').textContent      = fmt(tax);
     document.getElementById('total').textContent    = fmt(sub + tax);
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      PAYMENT
      ══════════════════════════════════════════════════════════════ */
   function selectPay(method, btn) {
     payMethod = method;
     document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('selected'));
     btn.classList.add('selected');
   }
   
   function charge() {
     const keys = Object.keys(cart);
     if (!keys.length) return;
     const sub    = keys.reduce((s, id) => s + cart[id].price * cart[id].qty, 0);
     const labels = { cash: '💵 Cash Payment', card: '💳 Card Payment', gcash: '📱 GCash Payment' };
     document.getElementById('modalSub').textContent    = `${labels[payMethod]} · Order #${String(orderNum).padStart(4, '0')}`;
     document.getElementById('modalAmount').textContent = fmt(sub * 1.12);
     document.getElementById('modal').classList.add('show');
   }
   
   function closeModal() {
     // ── Record the completed sale before clearing cart ──────
     const keys = Object.keys(cart);
     if (keys.length) {
       const sub   = keys.reduce((s, id) => s + cart[id].price * cart[id].qty, 0);
       const total = sub * 1.12;
       const sale  = {
         id:        orderNum,
         date:      new Date().toISOString(),
         method:    payMethod,
         cashier:   currentAcct?.name || currentUser || 'Unknown',
         total:     parseFloat(total.toFixed(2)),
         subtotal:  parseFloat(sub.toFixed(2)),
         tax:       parseFloat((total - sub).toFixed(2)),
         items:     keys.map(id => ({
           id:    cart[id].id,
           name:  cart[id].name,
           emoji: cart[id].emoji,
           cat:   cart[id].cat,
           price: cart[id].price,
           qty:   cart[id].qty,
         })),
       };
       SALES.push(sale);
       try { localStorage.setItem('lelelemon_sales', JSON.stringify(SALES)); } catch(e) {}
     }
   
     document.getElementById('modal').classList.remove('show');
     cart = {};
     orderNum++;
     try { localStorage.setItem('lelelemon_orderNum', String(orderNum)); } catch(e) {}
     document.getElementById('orderNum').textContent = `Order #${String(orderNum).padStart(4, '0')}`;
     renderOrder();
     updateCartBadge();
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      MANAGER PANEL
      ══════════════════════════════════════════════════════════════ */
   let mgrCurrentCat = 'all';
   
   function openManagerPanel() {
     mgrCurrentCat = 'all';
     renderMgrFilterBar();
     renderMgrItems();
     renderMgrCats();
     const acctBtn = document.getElementById('accountsMgrBtn');
     if (acctBtn) acctBtn.style.display = (currentAcct?.role === 'admin') ? '' : 'none';
     document.getElementById('mgrOverlay').classList.add('show');
   }
   
   function closeManagerPanel() {
     document.getElementById('mgrOverlay').classList.remove('show');
     renderCategoryBar();
     renderMenu(currentCat);
   }
   
   function mgrTab(tabId, btn) {
     document.querySelectorAll('.mgr-tab').forEach(t => t.classList.remove('active'));
     document.querySelectorAll('.mgr-nav-btn').forEach(b => b.classList.remove('active'));
     document.getElementById('mgr' + capFirst(tabId)).classList.add('active');
     btn.classList.add('active');
     if (tabId === 'analytics') renderAnalytics();
     if (tabId === 'accounts')  renderAccountsList();
   }
   
   function mgrFilterCat(cat, btn) {
     mgrCurrentCat = cat;
     document.querySelectorAll('.mgr-filter-btn').forEach(b => b.classList.remove('active'));
     btn.classList.add('active');
     renderMgrItems();
   }
   
   function catName(c) {
     // Extract clean display name from label, fallback to capitalised id
     return c.label.replace(/^\S+\s/, '').trim() || capFirst(c.id);
   }
   
   function renderMgrFilterBar() {
     const bar = document.getElementById('mgrFilterBar');
     bar.innerHTML =
       `<button class="mgr-filter-btn ${mgrCurrentCat === 'all' ? 'active' : ''}" onclick="mgrFilterCat('all',this)">All</button>` +
       CATEGORIES.map(c =>
         `<button class="mgr-filter-btn ${mgrCurrentCat === c.id ? 'active' : ''}" onclick="mgrFilterCat('${c.id}',this)">${c.emoji} ${catName(c)}</button>`
       ).join('');
   }
   
   function renderMgrItems() {
     const list  = document.getElementById('mgrItemsList');
     const items = mgrCurrentCat === 'all' ? MENU : MENU.filter(m => m.cat === mgrCurrentCat);
   
     if (!items.length) {
       list.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px;font-size:13px;">No items in this category yet.</div>`;
       return;
     }
   
     list.innerHTML = items.map(item => {
       const thumb = item.photo
         ? `<div class="mgr-item-thumb"><img src="${item.photo}" alt="" /></div>`
         : `<div class="mgr-item-thumb">${item.emoji}</div>`;
       const cat = CATEGORIES.find(c => c.id === item.cat);
       return `
         <div class="mgr-item-row ${item.available ? '' : 'unavailable'}">
           ${thumb}
           <div class="mgr-item-info">
             <div class="mgr-item-name">${item.name}</div>
             <div class="mgr-item-meta">${cat ? cat.emoji + ' ' + catName(cat) : item.cat} · ${item.desc || '—'}</div>
           </div>
           <span class="mgr-item-price">${fmt(item.price)}</span>
           <div class="mgr-item-actions">
             <button class="mgr-avail-toggle" title="${item.available ? 'Mark unavailable' : 'Mark available'}"
                     onclick="toggleAvailability(${item.id})" type="button">${item.available ? '✅' : '⛔'}</button>
             <button class="mgr-edit-btn" onclick="openItemEditor(${item.id})" type="button">✏ Edit</button>
           </div>
         </div>`;
     }).join('');
   }
   
   function renderMgrCats() {
     const list = document.getElementById('mgrCatList');
     list.innerHTML = CATEGORIES.map(c => {
       const count       = MENU.filter(m => m.cat === c.id).length;
       const displayName = catName(c);
       const colorDot    = c.color
         ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};border:1.5px solid rgba(0,0,0,0.1);margin-right:4px;vertical-align:middle;"></span>`
         : '';
       const delBtn = c.isDefault
         ? `<span class="default-cat-badge">default</span>`
         : `<button class="mgr-cat-del-btn" title="Delete" onclick="confirmDeleteCat('${c.id}')" type="button">🗑</button>`;
       return `
         <div class="mgr-cat-row">
           <div class="mgr-cat-emoji" style="${c.color ? `background:${c.color};border-radius:10px;padding:4px;` : ''}">${c.emoji}</div>
           <div class="mgr-cat-info">
             <div class="mgr-cat-name">${colorDot}${displayName}</div>
             <div class="mgr-cat-count">${count} item${count !== 1 ? 's' : ''}</div>
           </div>
           <div class="mgr-cat-actions">
             <button class="mgr-cat-edit-btn" onclick="openCatEditor('${c.id}')" type="button">✏ Edit</button>
             ${delBtn}
           </div>
         </div>`;
     }).join('');
   }
   
   async function toggleAvailability(id) {
     const item = MENU.find(m => m.id === id);
     if (!item) return;
     item.available = !item.available;
     await syncOp(() => db.saveItem(item));
     renderMgrItems();
     showToast(`${item.emoji} ${item.name} marked ${item.available ? 'available' : 'unavailable'}`);
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      ITEM EDITOR
      ══════════════════════════════════════════════════════════════ */
   let editingItemId   = null;
   let currentPhotoB64 = null;
   
   function openItemEditor(id) {
     editingItemId   = id;
     currentPhotoB64 = null;
     const delBtn    = document.getElementById('efDeleteBtn');
   
     document.getElementById('efCat').innerHTML = CATEGORIES.map(c =>
       `<option value="${c.id}">${c.emoji} ${catName(c)}</option>`).join('');
   
     if (id === null) {
       document.getElementById('editorTitle').textContent = 'Add New Item';
       delBtn.style.display = 'none';
       document.getElementById('efName').value  = '';
       document.getElementById('efEmoji').value = '🍋';
       document.getElementById('efDesc').value  = '';
       document.getElementById('efPrice').value = '';
       document.getElementById('efCat').value   = CATEGORIES[0]?.id || '';
       document.getElementById('efAvailable').checked = true;
       clearPhotoPreview();
     } else {
       const item = MENU.find(m => m.id === id);
       document.getElementById('editorTitle').textContent = 'Edit Item';
       delBtn.style.display = 'inline-flex';
       document.getElementById('efName').value  = item.name;
       document.getElementById('efEmoji').value = item.emoji;
       document.getElementById('efDesc').value  = item.desc;
       document.getElementById('efPrice').value = item.price;
       document.getElementById('efCat').value   = item.cat;
       document.getElementById('efAvailable').checked = item.available;
       if (item.photo) { currentPhotoB64 = item.photo; showPhotoPreview(item.photo); }
       else clearPhotoPreview();
     }
     document.getElementById('efError').textContent = '';
     document.getElementById('editorOverlay').classList.add('show');
   }
   
   function closeItemEditor() {
     document.getElementById('editorOverlay').classList.remove('show');
   }
   
   async function saveItem() {
     const name  = document.getElementById('efName').value.trim();
     const emoji = document.getElementById('efEmoji').value.trim() || '🍋';
     const desc  = document.getElementById('efDesc').value.trim();
     const price = parseFloat(document.getElementById('efPrice').value);
     const cat   = document.getElementById('efCat').value;
     const avail = document.getElementById('efAvailable').checked;
     const errEl = document.getElementById('efError');
   
     if (!name)                     { errEl.textContent = 'Item name is required.'; return; }
     if (isNaN(price) || price < 0) { errEl.textContent = 'Enter a valid price.';   return; }
     if (!cat)                      { errEl.textContent = 'Select a category.';     return; }
     errEl.textContent = '';
   
     const payload = { cat, emoji, name, desc, price, available: avail, photo: currentPhotoB64 };
   
     if (editingItemId === null) {
       const newItem = { ...payload, _isNew: true };
       let savedId = nextId++;
       await syncOp(async () => {
         const saved = await db.saveItem(newItem);
         if (saved?.id) savedId = saved.id;
       });
       MENU.push({ id: savedId, ...payload });
       showToast('✅ Item added!');
     } else {
       const item = MENU.find(m => m.id === editingItemId);
       Object.assign(item, payload);
       await syncOp(() => db.saveItem(item));
       if (cart[editingItemId]) Object.assign(cart[editingItemId], payload);
       showToast('✅ Item updated!');
     }
   
     closeItemEditor();
     renderMgrFilterBar();
     renderMgrItems();
     renderMgrCats();
   }
   
   function confirmDeleteItem() {
     const item = MENU.find(m => m.id === editingItemId);
     if (!item) return;
     document.getElementById('confirmIcon').textContent  = item.emoji;
     document.getElementById('confirmTitle').textContent = `Delete "${item.name}"?`;
     document.getElementById('confirmSub').textContent   = 'This item will be permanently removed from the menu.';
     document.getElementById('confirmDelBtn').onclick    = async () => {
       await syncOp(() => db.deleteItem(editingItemId));
       MENU = MENU.filter(m => m.id !== editingItemId);
       delete cart[editingItemId];
       closeConfirm();
       closeItemEditor();
       renderMgrFilterBar();
       renderMgrItems();
       renderMgrCats();
       renderOrder();
       updateCartBadge();
       showToast('🗑 Item deleted.');
     };
     document.getElementById('confirmOverlay').classList.add('show');
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      PHOTO UPLOAD
      ══════════════════════════════════════════════════════════════ */
   function handlePhotoUpload(e) {
     const file = e.target.files[0];
     if (!file) return;
     const reader = new FileReader();
     reader.onload = ev => { currentPhotoB64 = ev.target.result; showPhotoPreview(currentPhotoB64); };
     reader.readAsDataURL(file);
     e.target.value = '';
   }
   
   function showPhotoPreview(src) {
     document.getElementById('photoPlaceholderIcon').style.display = 'none';
     document.getElementById('photoPlaceholderText').style.display = 'none';
     const img = document.getElementById('photoImg');
     img.src = src;
     img.style.display = 'block';
     document.getElementById('photoActionBar').style.display = 'flex';
   }
   
   function clearPhotoPreview() {
     document.getElementById('photoPlaceholderIcon').style.display = 'block';
     document.getElementById('photoPlaceholderText').style.display = 'block';
     const img = document.getElementById('photoImg');
     img.src = '';
     img.style.display = 'none';
     document.getElementById('photoActionBar').style.display = 'none';
     currentPhotoB64 = null;
   }
   
   function removePhoto() { clearPhotoPreview(); }
   function pickEmoji(e)  { document.getElementById('efEmoji').value = e; }
   
   
   /* ══════════════════════════════════════════════════════════════
      CATEGORY EDITOR
      ══════════════════════════════════════════════════════════════ */
   /* ══════════════════════════════════════════════════════════════
      CATEGORY EDITOR  —  full featured
      ══════════════════════════════════════════════════════════════ */
   let editingCatId  = null;
   let catColor      = '#F5E642';   // currently selected color
   
   const CAT_COLORS = [
     '#F5E642','#FCD34D','#FB923C','#F87171','#F472B6',
     '#C084FC','#818CF8','#60A5FA','#34D399','#4ADE80',
     '#A3E635','#E2E8F0','#1A1A00','#7A7A40',
   ];
   
   function buildCatColorGrid() {
     const grid = document.getElementById('catColorGrid');
     if (!grid) return;
     grid.innerHTML = CAT_COLORS.map(col => `
       <div class="cat-color-swatch ${col === catColor ? 'selected' : ''}"
            style="background:${col};"
            onclick="selectCatColor('${col}',this)"
            title="${col}"></div>`).join('');
   }
   
   function selectCatColor(col, el) {
     catColor = col;
     document.querySelectorAll('.cat-color-swatch').forEach(s => s.classList.remove('selected'));
     el.classList.add('selected');
     updateCatPreview();
   }
   
   function updateCatPreview() {
     const name  = document.getElementById('catName')?.value.trim()  || 'New Category';
     const emoji = document.getElementById('catEmoji')?.value.trim() || '📦';
     const badge = document.getElementById('catPreviewBadge');
     if (!badge) return;
     document.getElementById('catPreviewEmoji').textContent = emoji;
     document.getElementById('catPreviewName').textContent  = name;
     // Pick text color based on brightness
     const hex = catColor.replace('#','');
     const r = parseInt(hex.substr(0,2),16);
     const g = parseInt(hex.substr(2,2),16);
     const b = parseInt(hex.substr(4,2),16);
     const bright = (r*299 + g*587 + b*114) / 1000;
     badge.style.background  = catColor;
     badge.style.color       = bright > 140 ? '#1A1A00' : '#FFFEF0';
     badge.style.borderColor = bright > 140 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
   }
   
   function openCatEditor(catId = null) {
     editingCatId = catId;
     const delBtn = document.getElementById('catDeleteBtn');
   
     if (catId === null) {
       // ── ADD new category ──
       document.getElementById('catEditorTitle').textContent = 'Add Category';
       document.getElementById('catName').value  = '';
       document.getElementById('catEmoji').value = '📦';
       catColor = '#F5E642';
       if (delBtn) delBtn.style.display = 'none';
     } else {
       // ── EDIT existing category ──
       const cat = CATEGORIES.find(c => c.id === catId);
       document.getElementById('catEditorTitle').textContent = 'Edit Category';
       // Use the real display name (strip emoji from label if present)
       const displayName = cat.label.replace(/^\S+\s/, '').trim() || capFirst(catId);
       document.getElementById('catName').value  = displayName;
       document.getElementById('catEmoji').value = cat.emoji;
       catColor = cat.color || '#F5E642';
       if (delBtn) delBtn.style.display = cat.isDefault ? 'none' : 'inline-flex';
     }
   
     document.getElementById('catError').textContent = '';
     buildCatColorGrid();
     updateCatPreview();
     document.getElementById('catEditorOverlay').classList.add('show');
     // Focus name input
     setTimeout(() => document.getElementById('catName')?.focus(), 100);
   }
   
   function closeCatEditor() {
     document.getElementById('catEditorOverlay').classList.remove('show');
   }
   
   function pickCatEmoji(e) {
     document.getElementById('catEmoji').value = e;
     updateCatPreview();
   }
   
   async function saveCategory() {
     const name  = document.getElementById('catName').value.trim();
     const emoji = document.getElementById('catEmoji').value.trim() || '📦';
     const errEl = document.getElementById('catError');
   
     if (!name) { errEl.textContent = 'Category name is required.'; return; }
     errEl.textContent = '';
   
     if (editingCatId === null) {
       // ── ADD ──
       const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g,'');
       if (CATEGORIES.find(c => c.id === id)) {
         errEl.textContent = 'A category with that name already exists.'; return;
       }
       const newCat = {
         id, label: `${emoji} ${name}`, emoji,
         color: catColor, isDefault: false, _isNew: true,
       };
       await syncOp(() => db.saveCategory(newCat));
       delete newCat._isNew;
       CATEGORIES.push(newCat);
       showToast(`${emoji} "${name}" added!`);
     } else {
       // ── EDIT — update everything including label ──
       const cat   = CATEGORIES.find(c => c.id === editingCatId);
       cat.emoji   = emoji;
       cat.label   = `${emoji} ${name}`;
       cat.color   = catColor;
       await syncOp(() => db.saveCategory(cat));
       showToast(`✅ "${name}" updated!`);
     }
   
     closeCatEditor();
     renderMgrFilterBar();
     renderMgrCats();
     renderCategoryBar();
     // Refresh category dropdown in item editor too
     const efCat = document.getElementById('efCat');
     if (efCat) efCat.innerHTML = CATEGORIES.map(c =>
       `<option value="${c.id}">${c.emoji} ${catName(c)}</option>`).join('');
   }
   
   function confirmDeleteEditingCat() {
     closeCatEditor();
     confirmDeleteCat(editingCatId);
   }
   
   function confirmDeleteCat(catId) {
     const cat   = CATEGORIES.find(c => c.id === catId);
     const count = MENU.filter(m => m.cat === catId).length;
     document.getElementById('confirmIcon').textContent  = cat?.emoji || '🏷';
     const catObj = CATEGORIES.find(c => c.id === catId);
     document.getElementById('confirmTitle').textContent = `Delete "${catObj ? catName(catObj) : capFirst(catId)}"?`;
     document.getElementById('confirmSub').textContent   = count > 0
       ? `⚠️ This will also delete ${count} item(s) in this category.`
       : 'This empty category will be removed.';
     document.getElementById('confirmDelBtn').onclick = async () => {
       await syncOp(() => db.deleteCategory(catId));
       CATEGORIES = CATEGORIES.filter(c => c.id !== catId);
       MENU       = MENU.filter(m => m.cat !== catId);
       closeConfirm();
       renderMgrFilterBar();
       renderMgrItems();
       renderMgrCats();
       renderCategoryBar();
       renderMenu(currentCat);
       showToast('🗑 Category deleted.');
     };
     document.getElementById('confirmOverlay').classList.add('show');
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      CONFIRM MODAL
      ══════════════════════════════════════════════════════════════ */
   function closeConfirm() {
     document.getElementById('confirmOverlay').classList.remove('show');
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      TOAST & CLOCK
      ══════════════════════════════════════════════════════════════ */
   function showToast(msg) {
     const t = document.getElementById('toast');
     t.textContent = msg;
     t.classList.add('show');
     setTimeout(() => t.classList.remove('show'), 2200);
   }
   
   function updateClock() {
     const el = document.getElementById('clock');
     if (el) el.textContent = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      DATABASE VIEWER
      ══════════════════════════════════════════════════════════════ */
   let dbvCurrentTab = 'categories';
   
   function openDbViewer() {
     renderDbViewer();
     document.getElementById('dbvOverlay').classList.add('show');
   }
   
   function closeDbViewer() {
     document.getElementById('dbvOverlay').classList.remove('show');
   }
   
   function dbvTab(tab, btn) {
     dbvCurrentTab = tab;
     document.querySelectorAll('.dbv-tab').forEach(b => b.classList.remove('active'));
     document.querySelectorAll('.dbv-section').forEach(s => s.classList.remove('active'));
     btn.classList.add('active');
     document.getElementById('dbv' + capFirst(tab)).classList.add('active');
     renderDbViewer();
   }
   
   function renderDbViewer() {
     renderDbvCategories();
     renderDbvMenu();
     renderDbvRaw();
     document.getElementById('dbvCount').textContent =
       `${CATEGORIES.length} categories · ${MENU.length} items`;
   }
   
   function renderDbvCategories() {
     document.getElementById('dbvCategories').innerHTML = `
       <table class="dbv-table">
         <thead><tr><th>ID</th><th>Emoji</th><th>Label</th><th>Default</th><th>Items</th></tr></thead>
         <tbody>
           ${CATEGORIES.map(c => {
             const count = MENU.filter(m => m.cat === c.id).length;
             return `<tr>
               <td><code>${c.id}</code></td>
               <td style="font-size:20px">${c.emoji}</td>
               <td>${c.label}</td>
               <td><span class="dbv-pill ${c.isDefault ? 'def' : 'no'}">${c.isDefault ? 'yes' : 'custom'}</span></td>
               <td>${count}</td>
             </tr>`;
           }).join('')}
         </tbody>
       </table>`;
   }
   
   function renderDbvMenu() {
     document.getElementById('dbvMenu').innerHTML = `
       <table class="dbv-table">
         <thead><tr><th>ID</th><th>Photo</th><th>Name</th><th>Category</th><th>Price</th><th>Available</th></tr></thead>
         <tbody>
           ${MENU.map(item => {
             const thumb = item.photo
               ? `<img src="${item.photo}" class="dbv-thumb" alt="" />`
               : `<span style="font-size:22px">${item.emoji}</span>`;
             return `<tr>
               <td><code>${item.id}</code></td>
               <td>${thumb}</td>
               <td><strong>${item.name}</strong><br><span style="color:var(--muted);font-size:10px">${item.desc || '—'}</span></td>
               <td><code>${item.cat}</code></td>
               <td>₱${item.price.toFixed(2)}</td>
               <td><span class="dbv-pill ${item.available ? 'yes' : 'no'}">${item.available ? 'yes' : 'no'}</span></td>
             </tr>`;
           }).join('')}
         </tbody>
       </table>`;
   }
   
   function renderDbvRaw() {
     const payload = {
       categories: CATEGORIES,
       menu: MENU.map(i => ({ ...i, photo: i.photo ? '[base64 image]' : null })),
     };
     document.getElementById('dbvRaw').innerHTML =
       `<pre class="dbv-json">${JSON.stringify(payload, null, 2)}</pre>`;
   }
   
   function dbvCopyJson() {
     navigator.clipboard.writeText(JSON.stringify({ categories: CATEGORIES, menu: MENU }, null, 2))
       .then(() => showToast('📋 JSON copied!'))
       .catch(() => showToast('⚠️ Could not copy'));
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      CASHIER TIME-IN / OUT SCREEN
      ══════════════════════════════════════════════════════════════ */
   let _csClockTimer   = null;  // interval for the big clock
   let _csElapsedTimer = null;  // interval for elapsed time
   let _csTimeIn       = null;  // ISO string of when cashier clocked in
   const CS_TIMEIN_KEY = 'lelelemon_cashierTimeIn';
   
   function showCashierScreen(acct) {
     const screen = document.getElementById('cashierScreen');
     if (!screen) return;
   
     // Set avatar and name in both states
     const initials = (acct.name || acct.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
     ['csAvatar','csAvatarIn'].forEach(id => {
       const el = document.getElementById(id);
       if (el) { el.textContent = initials; el.style.background = acct.color || '#F5E642'; }
     });
     ['csName','csNameIn'].forEach(id => {
       const el = document.getElementById(id);
       if (el) el.textContent = acct.name || acct.username;
     });
   
     // Check if already clocked in (survived a refresh)
     const savedTimeIn = localStorage.getItem(CS_TIMEIN_KEY);
     if (savedTimeIn) {
       _csTimeIn = savedTimeIn;
       showClockedIn();
     } else {
       showClockedOut();
     }
   
     screen.style.display = 'flex';
     startCashierClock();
   }
   
   function showClockedOut() {
     document.getElementById('csClockOut').style.display = '';
     document.getElementById('csClockIn').style.display  = 'none';
     stopElapsedTimer();
   }
   
   function showClockedIn() {
     document.getElementById('csClockOut').style.display = 'none';
     document.getElementById('csClockIn').style.display  = '';
     // Show time-in value
     if (_csTimeIn) {
       const d = new Date(_csTimeIn);
       document.getElementById('csTimeInVal').textContent =
         d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
     }
     startElapsedTimer();
   }
   
   // Big clock on the clocked-out screen
   function startCashierClock() {
     stopCashierClock();
     function tick() {
       const now  = new Date();
       const time = now.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' });
       const date = now.toLocaleDateString('en-PH', { weekday:'long', month:'long', day:'numeric' });
       const tEl = document.getElementById('csCurrentTime');
       const dEl = document.getElementById('csCurrentDate');
       if (tEl) tEl.textContent = time;
       if (dEl) dEl.textContent = date;
     }
     tick();
     _csClockTimer = setInterval(tick, 1000);
   }
   
   function stopCashierClock() {
     if (_csClockTimer) { clearInterval(_csClockTimer); _csClockTimer = null; }
     stopElapsedTimer();
   }
   
   // Elapsed time counter on the clocked-in screen
   function startElapsedTimer() {
     stopElapsedTimer();
     function tick() {
       if (!_csTimeIn) return;
       const mins = Math.round((Date.now() - new Date(_csTimeIn)) / 60000);
       const el   = document.getElementById('csElapsed');
       if (el) {
         if (mins < 60) el.textContent = `${mins}m on shift`;
         else el.textContent = `${Math.floor(mins/60)}h ${mins%60}m on shift`;
       }
     }
     tick();
     _csElapsedTimer = setInterval(tick, 30000); // update every 30s
   }
   
   function stopElapsedTimer() {
     if (_csElapsedTimer) { clearInterval(_csElapsedTimer); _csElapsedTimer = null; }
   }
   
   function cashierClockIn() {
     _csTimeIn = new Date().toISOString();
     try { localStorage.setItem(CS_TIMEIN_KEY, _csTimeIn); } catch(e) {}
     // Record session start
     if (currentAcct) startSession(currentAcct);
     showClockedIn();
     showToast('⏱ Clocked in!');
   }
   
   function cashierClockOut() {
     if (!confirm('Clock out now?')) return;
     // Record session end
     endSession();
     try { localStorage.removeItem(CS_TIMEIN_KEY); } catch(e) {}
     _csTimeIn = null;
     showClockedOut();
     showToast('✅ Clocked out. See you soon!');
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      ACCOUNTS MANAGER
      ══════════════════════════════════════════════════════════════ */
   let editingAcctUser = null;
   let acctColor       = '#1A1A00';
   
   const ACCT_COLORS = [
     '#1A1A00','#7C3AED','#2563EB','#059669','#DC2626',
     '#D97706','#DB2777','#0891B2','#65A30D','#7A7A40',
   ];
   
   function renderAccountsList() {
     const el = document.getElementById('accountsList');
     if (!el) return;
     ACCOUNTS = loadAccounts();
     el.innerHTML = ACCOUNTS.map(a => {
       const initials  = (a.name || a.username).split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
       const roleLabel = a.role === 'admin' ? 'Admin' : a.role === 'manager' ? 'Manager' : 'Cashier';
       const isProtected = PROTECTED_USERS.includes(a.username);
       return `
         <div class="acct-row">
           <div class="acct-avatar" style="background:${a.color||'#1A1A00'}">${initials}</div>
           <div class="acct-info">
             <div class="acct-name">${a.name || a.username}</div>
             <div class="acct-meta">
               @${a.username} &nbsp;·&nbsp;
               <span class="acct-role-badge ${a.role}">${roleLabel}</span>
             </div>
           </div>
           <div>
             ${isProtected
               ? '<span class="acct-protected">protected</span>'
               : `<button class="mgr-edit-btn" onclick="openAccountEditor('${a.username}')" type="button">✏ Edit</button>`}
           </div>
         </div>`;
     }).join('');
     // Always refresh sessions log below the accounts list
     renderSessionsTab();
   }
   
   function buildAcctColorGrid(selected) {
     const grid = document.getElementById('acctColorGrid');
     if (!grid) return;
     grid.innerHTML = ACCT_COLORS.map(col => `
       <div class="cat-color-swatch ${col === selected ? 'selected' : ''}"
            style="background:${col};"
            onclick="selectAcctColor('${col}',this)"></div>`).join('');
   }
   
   function selectAcctColor(col, el) {
     acctColor = col;
     document.querySelectorAll('#acctColorGrid .cat-color-swatch').forEach(s => s.classList.remove('selected'));
     el.classList.add('selected');
   }
   
   function openAccountEditor(username) {
     editingAcctUser = username;
     const delBtn    = document.getElementById('acctDeleteBtn');
   
     if (username === null) {
       document.getElementById('accountEditorTitle').textContent = 'Add Account';
       document.getElementById('acctName').value  = '';
       document.getElementById('acctUser').value  = '';
       document.getElementById('acctPass').value  = '';
       document.getElementById('acctRole').value  = 'cashier';
       document.getElementById('acctUser').disabled = false;
       acctColor = '#1A1A00';
       if (delBtn) delBtn.style.display = 'none';
     } else {
       const acct = ACCOUNTS.find(a => a.username === username);
       document.getElementById('accountEditorTitle').textContent = 'Edit Account';
       document.getElementById('acctName').value  = acct.name || '';
       document.getElementById('acctUser').value  = acct.username;
       document.getElementById('acctPass').value  = acct.password;
       document.getElementById('acctRole').value  = acct.role;
       document.getElementById('acctUser').disabled = true; // can't change username
       acctColor = acct.color || '#1A1A00';
       if (delBtn) delBtn.style.display = PROTECTED_USERS.includes(username) ? 'none' : 'inline-flex';
     }
   
     document.getElementById('acctError').textContent = '';
     buildAcctColorGrid(acctColor);
     document.getElementById('accountEditorOverlay').classList.add('show');
     setTimeout(() => document.getElementById('acctName').focus(), 100);
   }
   
   function closeAccountEditor() {
     document.getElementById('accountEditorOverlay').classList.remove('show');
   }
   
   function toggleAcctPass() {
     const p = document.getElementById('acctPass');
     const b = document.getElementById('acctToggleBtn');
     p.type = p.type === 'password' ? 'text' : 'password';
     b.textContent = p.type === 'password' ? '👁' : '🙈';
   }
   
   function saveAccount() {
     const name  = document.getElementById('acctName').value.trim();
     const uname = document.getElementById('acctUser').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
     const pass  = document.getElementById('acctPass').value.trim();
     const role  = document.getElementById('acctRole').value;
     const errEl = document.getElementById('acctError');
   
     if (!name)          { errEl.textContent = 'Full name is required.';          return; }
     if (!uname)         { errEl.textContent = 'Username is required.';           return; }
     if (pass.length < 6){ errEl.textContent = 'Password must be 6+ characters.'; return; }
     errEl.textContent = '';
   
     ACCOUNTS = loadAccounts();
   
     if (editingAcctUser === null) {
       // ADD
       if (ACCOUNTS.find(a => a.username === uname)) {
         errEl.textContent = 'That username is already taken.'; return;
       }
       ACCOUNTS.push({ username: uname, password: pass, name, role, color: acctColor });
       showToast(`👤 "${name}" added!`);
     } else {
       // EDIT
       const acct = ACCOUNTS.find(a => a.username === editingAcctUser);
       acct.name     = name;
       acct.password = pass;
       acct.role     = role;
       acct.color    = acctColor;
       showToast(`✅ "${name}" updated!`);
     }
   
     saveAccounts(ACCOUNTS);
     closeAccountEditor();
     renderAccountsList();
     renderLoginTiles();
   }
   
   function deleteAccount() {
     const acct = ACCOUNTS.find(a => a.username === editingAcctUser);
     if (!acct || PROTECTED_USERS.includes(acct.username)) return;
     if (!confirm(`Remove account "${acct.name || acct.username}"? This cannot be undone.`)) return;
     ACCOUNTS = ACCOUNTS.filter(a => a.username !== editingAcctUser);
     saveAccounts(ACCOUNTS);
     closeAccountEditor();
     renderAccountsList();
     renderLoginTiles();
     showToast(`🗑 Account removed.`);
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      INIT
      ══════════════════════════════════════════════════════════════ */
   setInterval(updateClock, 1000);
   updateClock();
   renderLoginTiles();
   
   // ── Auto-restore login after page refresh ──────────────────
   (function restoreSession() {
     const savedUser = localStorage.getItem('lelelemon_loggedIn');
     if (!savedUser) return;
   
     ACCOUNTS = loadAccounts();
     const acct = ACCOUNTS.find(a => a.username === savedUser);
     if (!acct) {
       // Account no longer exists — clear stale login
       localStorage.removeItem('lelelemon_loggedIn');
       return;
     }
   
     // Restore session state
     currentUser = savedUser;
     currentAcct = acct;
     // Re-link active session only for cashiers
     if (acct.role !== 'cashier') {
       localStorage.removeItem('lelelemon_curSession');
       _currentSessionId = null;
     }
   
     document.getElementById('loginOverlay').style.display = 'none';
   
     if (acct.role === 'cashier') {
       showCashierScreen(acct);
     } else {
       document.getElementById('posApp').style.display         = 'flex';
       document.getElementById('loggedInUser').textContent     = '👤 ' + (acct.name || savedUser);
       document.getElementById('managerModeBtn').style.display = (acct.role === 'manager' || acct.role === 'admin') ? 'inline-block' : 'none';
     }
   
     // Restore Supabase data if connected
     if (!IS_LOCAL_MODE) {
       const syncEl = document.getElementById('syncIndicator');
       syncEl.style.display = 'flex';
       setSyncState('syncing', 'Loading…');
       db.loadAll()
         .then(data => {
           CATEGORIES = data.categories;
           MENU       = data.menu;
           const maxId = MENU.reduce((m, i) => Math.max(m, i.id), 0);
           nextId = maxId + 1;
           setSyncState('ok', 'Synced');
         })
         .catch(() => setSyncState('error', 'Offline'))
         .finally(() => {
           renderCategoryBar();
           renderMenu(currentCat);
           updateCartBadge();
         });
     } else {
       renderCategoryBar();
       renderMenu(currentCat);
       updateCartBadge();
     }
   })();
   
   /* ══════════════════════════════════════════════════════════════
      ANALYTICS
      ══════════════════════════════════════════════════════════════ */
   let chartRevenue = null;
   let chartPayment = null;
   
   // ── Filter sales by selected date range ──────────────────────
   function getFilteredSales() {
     const range = document.getElementById('analyticsRange')?.value || '30';
     if (range === 'all') return SALES;
     const days  = parseInt(range);
     const cutoff = new Date();
     cutoff.setDate(cutoff.getDate() - days);
     cutoff.setHours(0, 0, 0, 0);
     return SALES.filter(s => new Date(s.date) >= cutoff);
   }
   
   // ── Main render ───────────────────────────────────────────────
   function renderAnalytics() {
     const sales = getFilteredSales();
     renderAnKpis(sales);
     renderAnRevenueChart(sales);
     renderAnPaymentChart(sales);
     renderAnTopItems(sales);
     renderAnOrderLog(sales);
   }
   
   // ── KPI cards ─────────────────────────────────────────────────
   function renderAnKpis(sales) {
     const totalRev  = sales.reduce((s, o) => s + o.total, 0);
     const totalOrds = sales.length;
     const avgOrder  = totalOrds ? totalRev / totalOrds : 0;
   
     // Count unique days with sales
     const days = new Set(sales.map(s => s.date.slice(0,10))).size;
   
     document.getElementById('anKpiRow').innerHTML = `
       <div class="an-kpi highlight">
         <div class="an-kpi-label">Total Revenue</div>
         <div class="an-kpi-value">${fmt(totalRev)}</div>
         <div class="an-kpi-sub">incl. 12% tax</div>
       </div>
       <div class="an-kpi">
         <div class="an-kpi-label">Total Orders</div>
         <div class="an-kpi-value">${totalOrds}</div>
         <div class="an-kpi-sub">${days} day${days !== 1 ? 's' : ''} with sales</div>
       </div>
       <div class="an-kpi">
         <div class="an-kpi-label">Avg Order Value</div>
         <div class="an-kpi-value">${fmt(avgOrder)}</div>
         <div class="an-kpi-sub">per transaction</div>
       </div>
       <div class="an-kpi">
         <div class="an-kpi-label">Items Sold</div>
         <div class="an-kpi-value">${sales.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0)}</div>
         <div class="an-kpi-sub">total units</div>
       </div>`;
   }
   
   // ── Daily revenue bar chart ───────────────────────────────────
   function renderAnRevenueChart(sales) {
     // Build map of date → revenue
     const map = {};
     sales.forEach(s => {
       const d = s.date.slice(0, 10);
       map[d] = (map[d] || 0) + s.total;
     });
   
     // Fill in every day in the range (so gaps show as 0)
     const range   = document.getElementById('analyticsRange')?.value || '30';
     const numDays = range === 'all' ? 30 : parseInt(range);
     const labels  = [];
     const data    = [];
   
     for (let i = numDays - 1; i >= 0; i--) {
       const d = new Date();
       d.setDate(d.getDate() - i);
       const key = d.toISOString().slice(0, 10);
       labels.push(d.toLocaleDateString('en-PH', { month:'short', day:'numeric' }));
       data.push(parseFloat((map[key] || 0).toFixed(2)));
     }
   
     const ctx = document.getElementById('chartRevenue');
     if (!ctx) return;
   
     if (chartRevenue) chartRevenue.destroy();
     chartRevenue = new Chart(ctx, {
       type: 'bar',
       data: {
         labels,
         datasets: [{
           label: 'Revenue (₱)',
           data,
           backgroundColor: '#F5E642',
           borderColor: '#D4C200',
           borderWidth: 1.5,
           borderRadius: 6,
         }],
       },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
           x: { grid: { display: false }, ticks: { font: { family: 'DM Mono', size: 10 }, maxTicksLimit: 10 } },
           y: { grid: { color: '#E8E580' }, ticks: { font: { family: 'DM Mono', size: 10 }, callback: v => '₱' + v.toLocaleString() } },
         },
       },
     });
   }
   
   // ── Payment method donut chart ────────────────────────────────
   function renderAnPaymentChart(sales) {
     const counts = { cash: 0, card: 0, gcash: 0 };
     sales.forEach(s => { counts[s.method] = (counts[s.method] || 0) + 1; });
   
     const ctx = document.getElementById('chartPayment');
     if (!ctx) return;
   
     if (chartPayment) chartPayment.destroy();
     chartPayment = new Chart(ctx, {
       type: 'doughnut',
       data: {
         labels: ['Cash 💵', 'Card 💳', 'GCash 📱'],
         datasets: [{
           data: [counts.cash, counts.card, counts.gcash],
           backgroundColor: ['#F5E642', '#1A1A00', '#7A7A40'],
           borderColor: '#FFFEF0',
           borderWidth: 3,
           hoverOffset: 6,
         }],
       },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: {
           legend: { position: 'bottom', labels: { font: { family: 'DM Mono', size: 11 }, padding: 12, usePointStyle: true } },
         },
         cutout: '60%',
       },
     });
   }
   
   // ── Top selling items ─────────────────────────────────────────
   function renderAnTopItems(sales) {
     const el   = document.getElementById('anTopItems');
     const map  = {};
   
     sales.forEach(sale => {
       sale.items.forEach(item => {
         if (!map[item.name]) map[item.name] = { name: item.name, emoji: item.emoji, qty: 0, revenue: 0 };
         map[item.name].qty     += item.qty;
         map[item.name].revenue += item.price * item.qty;
       });
     });
   
     const sorted = Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
     const maxRev = sorted[0]?.revenue || 1;
     const rankClass = ['gold','silver','bronze'];
   
     if (!sorted.length) { el.innerHTML = `<div class="an-empty">No sales yet. Complete an order to see top items.</div>`; return; }
   
     el.innerHTML = sorted.map((item, i) => `
       <div class="an-top-row">
         <span class="an-top-rank ${rankClass[i] || ''}">${i + 1}</span>
         <span class="an-top-emoji">${item.emoji}</span>
         <div class="an-top-info">
           <div class="an-top-name">${item.name}</div>
           <div class="an-bar-wrap"><div class="an-bar" style="width:${Math.round(item.revenue/maxRev*100)}%"></div></div>
         </div>
         <div style="text-align:right;flex-shrink:0;">
           <div class="an-top-revenue">${fmt(item.revenue)}</div>
           <div class="an-top-meta">${item.qty} sold</div>
         </div>
       </div>`).join('');
   }
   
   // ── Order history log ─────────────────────────────────────────
   function renderAnOrderLog(sales) {
     const el = document.getElementById('anOrderLog');
     if (!sales.length) { el.innerHTML = `<div class="an-empty">No orders yet. Process a sale to see history here.</div>`; return; }
   
     const icons = { cash: '💵', card: '💳', gcash: '📱' };
     const recent = [...sales].reverse().slice(0, 50);
   
     el.innerHTML = recent.map(s => {
       const d    = new Date(s.date);
       const time = d.toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
       const itemList = s.items.map(i => `${i.emoji} ${i.name} ×${i.qty}`).join(', ');
       const cashierTag = s.cashier ? `<span style="background:var(--border);border-radius:6px;padding:1px 6px;font-size:10px;margin-left:4px;">👤 ${s.cashier}</span>` : '';
       return `
         <div class="an-log-row">
           <div class="an-log-num">#${String(s.id).padStart(4,'0')}</div>
           <div>
             <div style="font-size:11px;color:var(--muted);">${time}${cashierTag}</div>
             <div class="an-log-items">${itemList}</div>
           </div>
           <div class="an-log-pay">${icons[s.method] || '💵'}</div>
           <div class="an-log-total">${fmt(s.total)}</div>
         </div>`;
     }).join('');
   }
   
   // ── Clear all sales data ──────────────────────────────────────
   function clearSalesData() {
     if (!confirm('Clear ALL sales history? This cannot be undone.')) return;
     SALES = [];
     try {
       localStorage.removeItem('lelelemon_sales');
       localStorage.setItem('lelelemon_cleared', '1');  // prevent demo re-seed
     } catch(e) {}
     renderAnalytics();
     showToast('🗑 Sales data cleared.');
   }
   
   
   /* ══════════════════════════════════════════════════════════════
      SESSIONS TAB
      ══════════════════════════════════════════════════════════════ */
   function getFilteredSessions() {
     const range = document.getElementById('analyticsRange')?.value || '30';
     if (range === 'all') return SESSIONS;
     const days   = parseInt(range);
     const cutoff = new Date();
     cutoff.setDate(cutoff.getDate() - days);
     cutoff.setHours(0,0,0,0);
     return SESSIONS.filter(s => new Date(s.timeIn) >= cutoff);
   }
   
   function renderSessionsTab() {
     const sessions = getFilteredSessions();
     renderSessionKpis(sessions);
     renderSessionLog(sessions);
   }
   
   function renderSessionKpis(sessions) {
     const el = document.getElementById('anSessionKpis');
     if (!el) return;
     const totalSessions = sessions.length;
     const uniqueStaff   = new Set(sessions.map(s => s.username)).size;
     const completed     = sessions.filter(s => s.timeOut);
     const avgMins       = completed.length
       ? Math.round(completed.reduce((sum, s) => sum + (s.duration||0), 0) / completed.length)
       : 0;
     const totalMins     = completed.reduce((sum, s) => sum + (s.duration||0), 0);
   
     function fmtDur(mins) {
       if (mins < 60) return `${mins}m`;
       return `${Math.floor(mins/60)}h ${mins%60}m`;
     }
   
     el.innerHTML = `
       <div class="an-kpi">
         <div class="an-kpi-label">Total Logins</div>
         <div class="an-kpi-value">${totalSessions}</div>
         <div class="an-kpi-sub">${uniqueStaff} staff member${uniqueStaff!==1?'s':''}</div>
       </div>
       <div class="an-kpi highlight">
         <div class="an-kpi-label">Total Hours</div>
         <div class="an-kpi-value">${fmtDur(totalMins)}</div>
         <div class="an-kpi-sub">combined shift time</div>
       </div>
       <div class="an-kpi">
         <div class="an-kpi-label">Avg Shift</div>
         <div class="an-kpi-value">${fmtDur(avgMins)}</div>
         <div class="an-kpi-sub">per session</div>
       </div>
       <div class="an-kpi">
         <div class="an-kpi-label">Active Now</div>
         <div class="an-kpi-value">${sessions.filter(s=>!s.timeOut).length}</div>
         <div class="an-kpi-sub">currently logged in</div>
       </div>`;
   }
   
   function renderSessionLog(sessions) {
     const el = document.getElementById('anSessionLog');
     if (!el) return;
     if (!sessions.length) {
       el.innerHTML = `<div class="an-empty">No sessions yet. Cashier logins will appear here.</div>`;
       return;
     }
   
     function fmtDur(mins) {
       if (mins === null || mins === undefined) return '—';
       if (mins < 60) return `${mins}m`;
       return `${Math.floor(mins/60)}h ${mins%60}m`;
     }
     function fmtTime(iso) {
       if (!iso) return '—';
       return new Date(iso).toLocaleString('en-PH', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
     }
   
     const roleColors = { admin:'#854d0e', manager:'#5b21b6', cashier:'#166534' };
     const sorted = [...sessions].reverse();
   
     el.innerHTML = `
       <table class="dbv-table">
         <thead><tr>
           <th>Staff</th><th>Role</th><th>Time In</th><th>Time Out</th><th>Duration</th>
         </tr></thead>
         <tbody>
           ${sorted.map(s => {
             const initials = s.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
             const isActive = !s.timeOut;
             return `<tr>
               <td style="display:flex;align-items:center;gap:8px;border:none;">
                 <span style="width:28px;height:28px;border-radius:50%;background:${s.color||'#1A1A00'};color:#fff;font-size:11px;font-family:'Syne',sans-serif;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</span>
                 <span style="font-weight:600;">${s.name}</span>
               </td>
               <td><span class="acct-role-badge ${s.role}">${s.role}</span></td>
               <td>${fmtTime(s.timeIn)}</td>
               <td>${isActive ? '<span style="color:#16a34a;font-weight:700;">● Active</span>' : fmtTime(s.timeOut)}</td>
               <td>${isActive ? '<span style="color:#16a34a;">ongoing</span>' : fmtDur(s.duration)}</td>
             </tr>`;
           }).join('')}
         </tbody>
       </table>`;
   }
   
   function clearSessionsData() {
     if (!confirm('Clear ALL session history? This cannot be undone.')) return;
     SESSIONS = [];
     try { localStorage.removeItem('lelelemon_sessions'); } catch(e) {}
     renderSessionsTab();
     showToast('🗑 Session data cleared.');
   }
   
   /* ══════════════════════════════════════════════════════════════
      EXCEL EXPORT  (SheetJS)
      ══════════════════════════════════════════════════════════════ */
   function exportSalesExcel() {
     const sales = getFilteredSales();
     if (!sales.length) { showToast('⚠️ No sales data to export.'); return; }
   
     const wb = XLSX.utils.book_new();
   
     // ── Sheet 1: Daily Summary ────────────────────────────────
     const dailyMap = {};
     sales.forEach(s => {
       const d = s.date.slice(0, 10);
       if (!dailyMap[d]) dailyMap[d] = { date: d, orders: 0, subtotal: 0, tax: 0, total: 0, cash: 0, card: 0, gcash: 0 };
       dailyMap[d].orders++;
       dailyMap[d].subtotal += s.subtotal;
       dailyMap[d].tax      += s.tax;
       dailyMap[d].total    += s.total;
       dailyMap[d][s.method]++;
     });
   
     const dailyRows = [
       ['Date', 'Orders', 'Subtotal (₱)', 'Tax 12% (₱)', 'Total Revenue (₱)', 'Cash', 'Card', 'GCash'],
       ...Object.values(dailyMap).sort((a,b) => a.date.localeCompare(b.date)).map(r => [
         r.date, r.orders,
         parseFloat(r.subtotal.toFixed(2)),
         parseFloat(r.tax.toFixed(2)),
         parseFloat(r.total.toFixed(2)),
         r.cash, r.card, r.gcash,
       ]),
     ];
   
     const wsDailySummary = XLSX.utils.aoa_to_sheet(dailyRows);
     wsDailySummary['!cols'] = [14,8,16,16,18,8,8,8].map(w => ({ wch: w }));
     XLSX.utils.book_append_sheet(wb, wsDailySummary, 'Daily Summary');
   
     // ── Sheet 2: All Orders ───────────────────────────────────
     const orderRows = [
       ['Order #', 'Date', 'Time', 'Cashier', 'Payment', 'Items', 'Subtotal (₱)', 'Tax (₱)', 'Total (₱)'],
       ...sales.map(s => {
         const d = new Date(s.date);
         return [
           `#${String(s.id).padStart(4,'0')}`,
           d.toLocaleDateString('en-PH'),
           d.toLocaleTimeString('en-PH', { hour:'2-digit', minute:'2-digit' }),
           s.cashier || '—',
           s.method.charAt(0).toUpperCase() + s.method.slice(1),
           s.items.map(i => `${i.name} ×${i.qty}`).join(', '),
           s.subtotal, s.tax, s.total,
         ];
       }),
     ];
   
     const wsOrders = XLSX.utils.aoa_to_sheet(orderRows);
     wsOrders['!cols'] = [10,12,8,14,10,40,14,12,14].map(w => ({ wch: w }));
     XLSX.utils.book_append_sheet(wb, wsOrders, 'All Orders');
   
     // ── Sheet 3: Item Breakdown ───────────────────────────────
     const itemMap = {};
     sales.forEach(s => {
       s.items.forEach(item => {
         const k = item.name;
         if (!itemMap[k]) itemMap[k] = { name: item.name, emoji: item.emoji, qty: 0, revenue: 0 };
         itemMap[k].qty     += item.qty;
         itemMap[k].revenue += item.price * item.qty;
       });
     });
   
     const itemRows = [
       ['Item', 'Category Emoji', 'Units Sold', 'Revenue (₱)', 'Avg Price (₱)'],
       ...Object.values(itemMap).sort((a,b) => b.revenue - a.revenue).map(r => [
         r.name, r.emoji, r.qty,
         parseFloat(r.revenue.toFixed(2)),
         parseFloat((r.revenue / r.qty).toFixed(2)),
       ]),
     ];
   
     const wsItems = XLSX.utils.aoa_to_sheet(itemRows);
     wsItems['!cols'] = [28, 14, 12, 16, 14].map(w => ({ wch: w }));
     XLSX.utils.book_append_sheet(wb, wsItems, 'Item Breakdown');
   
     // ── Sheet 4: Payment Summary ──────────────────────────────
     const pmtMap = { cash: { orders:0, total:0 }, card: { orders:0, total:0 }, gcash: { orders:0, total:0 } };
     sales.forEach(s => { pmtMap[s.method].orders++; pmtMap[s.method].total += s.total; });
   
     const pmtRows = [
       ['Payment Method', 'Orders', 'Total Revenue (₱)', '% of Orders'],
       ...Object.entries(pmtMap).map(([k, v]) => [
         k.charAt(0).toUpperCase() + k.slice(1),
         v.orders,
         parseFloat(v.total.toFixed(2)),
         sales.length ? parseFloat((v.orders / sales.length * 100).toFixed(1)) : 0,
       ]),
       ['TOTAL', sales.length, parseFloat(sales.reduce((s,o)=>s+o.total,0).toFixed(2)), 100],
     ];
   
     const wsPmt = XLSX.utils.aoa_to_sheet(pmtRows);
     wsPmt['!cols'] = [18, 10, 18, 14].map(w => ({ wch: w }));
     XLSX.utils.book_append_sheet(wb, wsPmt, 'Payment Summary');
   
     // ── Sheet 5: Staff Sessions ──────────────────────────────
     const sessionRows = [
       ['Staff Name', 'Username', 'Role', 'Time In', 'Time Out', 'Duration (mins)', 'Duration'],
       ...getFilteredSessions().map(s => {
         function fmtDur(m) {
           if (m===null||m===undefined) return 'Active';
           return m < 60 ? `${m}m` : `${Math.floor(m/60)}h ${m%60}m`;
         }
         return [
           s.name, s.username, s.role,
           s.timeIn  ? new Date(s.timeIn).toLocaleString('en-PH')  : '—',
           s.timeOut ? new Date(s.timeOut).toLocaleString('en-PH') : 'Active',
           s.duration ?? '',
           fmtDur(s.duration),
         ];
       }),
     ];
     const wsSessions = XLSX.utils.aoa_to_sheet(sessionRows);
     wsSessions['!cols'] = [18,14,10,20,20,16,12].map(w => ({ wch: w }));
     XLSX.utils.book_append_sheet(wb, wsSessions, 'Staff Sessions');
   
     // ── Download ──────────────────────────────────────────────
     const range   = document.getElementById('analyticsRange')?.value || '30';
     const rangeLabel = range === 'all' ? 'All-Time' : `Last-${range}-Days`;
     const today   = new Date().toISOString().slice(0, 10);
     const filename = `Lelelemon-Sales-${rangeLabel}-${today}.xlsx`;
   
     XLSX.writeFile(wb, filename);
     showToast('📊 Excel exported!');
   }