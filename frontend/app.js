/* ============================================================
   app.js — Logic-ga Frontend-ka ee Deeqsan Store
   Halkii localStorage, hadda wuxuu la xiriiraa backend-ka API.
   ============================================================ */

// ── Caawiye API ah (fetch wrapper) ──
const API = {
    async get(path) {
        const res = await fetch(path);
        return res.json();
    },
    async send(path, method, body) {
        const res = await fetch(path, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
        });
        let data = {};
        try { data = await res.json(); } catch (e) {}
        return { ok: res.ok, data };
    },
};

// ── Xogta lagu kaydiyo memory-ga (laga keeno server-ka) ──
let inventory = [];          // alaabta
let customers = [];          // macaamiisha
let salesLog = [];           // iibka
let users = [];              // isticmaaleyaasha (password change)

let currentUser = null;
let currentRole = null;
let activeCart = [];
let globalCurrency = "USD";
let activePaymentMethod = "";

// ═════════════════════════════════════════════════════════════
//  LOGIN
// ═════════════════════════════════════════════════════════════
async function loadLoginUsers() {
    users = await API.get("/api/users");
    const sel = document.getElementById("login-user");
    sel.innerHTML = "";
    users.forEach(u => {
        sel.innerHTML += `<option value="${u.name}">${u.displayName}</option>`;
    });
}

async function attemptLogin() {
    const user = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;

    const { ok, data } = await API.send("/api/login", "POST", { user, password: pass });
    if (!ok) { alert(data.error || "Fure khaldan!"); return; }

    currentUser = data.user;
    currentRole = data.role;

    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-app").classList.remove("hidden");
    document.getElementById("role-badge").innerText = data.displayName || currentUser;

    if (currentRole === "manager") {
        document.getElementById("manager-only-section").classList.remove("hidden");
    }

    await initApp();
    if (currentRole === "manager") setTodayDate();
}

function logout() { document.location.reload(); }

async function updateSystemPassword() {
    const u = document.getElementById("change-pass-user").value;
    const p = document.getElementById("new-sys-password").value.trim();
    if (!p) return alert("Fadlan qor password!");

    const { ok } = await API.send(`/api/users/${encodeURIComponent(u)}/password`, "PUT", { password: p });
    if (ok) {
        document.getElementById("new-sys-password").value = "";
        alert(`Password-ka ${u} waa la baddalay!`);
    }
}

// ═════════════════════════════════════════════════════════════
//  INIT — soo dejinta dhammaan xogta
// ═════════════════════════════════════════════════════════════
async function initApp() {
    [inventory, customers, salesLog] = await Promise.all([
        API.get("/api/products"),
        API.get("/api/customers"),
        API.get("/api/sales"),
    ]);

    fillPasswordUserDropdown();
    renderInventoryGrid();
    renderCustomerDropdowns();
    renderCartUI();
    renderManagerCustomerDirectory();
    renderManagerProductDirectory();
    toggleCustomerTypeUI();

    if (currentRole === "manager") {
        renderDailySummary();
        generateStatementView();
    }
}

function fillPasswordUserDropdown() {
    const sel = document.getElementById("change-pass-user");
    if (!sel) return;
    sel.innerHTML = "";
    users.forEach(u => {
        sel.innerHTML += `<option value="${u.name}">${u.name}</option>`;
    });
}

// ═════════════════════════════════════════════════════════════
//  CURRENCY (Sarrifka lacagta)
// ═════════════════════════════════════════════════════════════
async function loadExchangeRate() {
    const settings = await API.get("/api/settings");
    if (settings.exchange_rate) {
        document.getElementById("exchange-rate").value = settings.exchange_rate;
    }
}

async function saveExchangeRate() {
    const rate = getRate();
    await API.send("/api/settings", "PUT", { exchange_rate: rate });
    setGlobalCurrency(globalCurrency); // dib u soo bandhig lacagaha
}

function setGlobalCurrency(c) {
    globalCurrency = c;
    document.getElementById("toggle-USD").className =
        c === "USD" ? "px-2.5 py-1 rounded-md bg-white text-indigo-950 shadow" : "px-2.5 py-1 rounded-md text-indigo-300";
    document.getElementById("toggle-SlSh").className =
        c === "SlSh" ? "px-2.5 py-1 rounded-md bg-white text-indigo-950 shadow" : "px-2.5 py-1 rounded-md text-indigo-300";
    renderInventoryGrid();
    renderCartUI();
    if (currentRole === "manager") {
        renderDailySummary();
        generateStatementView();
        renderManagerProductDirectory();
    }
}

function getRate() {
    return parseFloat(document.getElementById("exchange-rate").value) || 8500;
}

function fmt(usd, forceCurrency = null) {
    const mode = forceCurrency || globalCurrency;
    return mode === "USD"
        ? `$${usd.toFixed(2)}`
        : `${Math.round(usd * getRate()).toLocaleString()} SlSh`;
}

// ═════════════════════════════════════════════════════════════
//  TABS (Maamulka)
// ═════════════════════════════════════════════════════════════
function showManagerTab(tab) {
    ["daily-summary", "statements", "settings"].forEach(t => {
        document.getElementById("panel-" + t).classList.add("hidden");
        document.getElementById("tab-" + t).classList.remove("active");
        document.getElementById("tab-" + t).classList.add("text-slate-500");
    });
    document.getElementById("panel-" + tab).classList.remove("hidden");
    document.getElementById("tab-" + tab).classList.add("active");
    document.getElementById("tab-" + tab).classList.remove("text-slate-500");
    if (tab === "daily-summary") renderDailySummary();
    if (tab === "statements") generateStatementView();
}

// ═════════════════════════════════════════════════════════════
//  CATALOG (Menu-ga alaabta)
// ═════════════════════════════════════════════════════════════
function renderInventoryGrid() {
    const grid = document.getElementById("catalog-grid");
    grid.innerHTML = "";
    inventory.forEach(item => {
        grid.innerHTML += `<div onclick="addItemToCart(${item.id})" class="p-3 bg-white border rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition cursor-pointer shadow-sm active:scale-[0.97]">
            <div class="font-bold text-slate-800 text-xs leading-tight">${item.name}</div>
            <div class="text-indigo-600 font-black text-xs mt-1">${fmt(item.priceUSD)}</div>
        </div>`;
    });
}

// ═════════════════════════════════════════════════════════════
//  CUSTOMER UI
// ═════════════════════════════════════════════════════════════
function renderCustomerDropdowns() {
    const posSel = document.getElementById("active-customer-dropdown");
    const statSel = document.getElementById("statement-cust-select");
    const type = document.getElementById("customer-type").value;
    posSel.innerHTML = "";
    customers.filter(c => c.type === type).forEach(c => {
        posSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    if (statSel) {
        statSel.innerHTML = "";
        customers.forEach(c => {
            statSel.innerHTML += `<option value="${c.id}">${c.name} (${c.type === "Daily" ? "Maalinle" : "Bille"})</option>`;
        });
    }
}

function toggleCustomerTypeUI() {
    const type = document.getElementById("customer-type").value;
    const panel = document.getElementById("daily-cash-panel");
    const statusSel = document.getElementById("transaction-status");

    renderCustomerDropdowns();

    if (type === "Daily") {
        panel.classList.remove("hidden");
        statusSel.value = "paid";
        setPaymentMethod("Cash");
    } else {
        panel.classList.add("hidden");
        statusSel.value = "tab";
    }
}

// ═════════════════════════════════════════════════════════════
//  CART (Dalabka)
// ═════════════════════════════════════════════════════════════
function addItemToCart(id) {
    const product = inventory.find(p => p.id === id);
    const item = activeCart.find(i => i.product.id === id);
    if (item) item.qty++;
    else activeCart.push({ product, qty: 1 });
    renderCartUI();
}

function adjustQty(id, delta) {
    const item = activeCart.find(i => i.product.id === id);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) activeCart = activeCart.filter(i => i.product.id !== id);
    }
    renderCartUI();
}

function toggleManualItemEntry() {
    document.getElementById("manual-item-panel").classList.toggle("hidden");
}

function addManualItemToCart() {
    const name = document.getElementById("manual-item-name").value.trim();
    const price = parseFloat(document.getElementById("manual-item-price").value);
    const qty = parseInt(document.getElementById("manual-item-qty").value) || 1;
    if (!name || isNaN(price) || price <= 0) return alert("Fadlan geli magaca iyo qiimaha!");
    activeCart.push({ product: { id: -(Date.now()), name: `✎ ${name}`, priceUSD: price }, qty });
    document.getElementById("manual-item-name").value = "";
    document.getElementById("manual-item-price").value = "";
    document.getElementById("manual-item-qty").value = "1";
    renderCartUI();
}

function addDailyCashToCart() {
    const slshVal = parseFloat(document.getElementById("daily-cash-slsh").value);
    if (isNaN(slshVal) || slshVal <= 0) return alert("Fadlan qor xaddiga lacagta SlSh!");
    const amountUSD = slshVal / getRate();
    const label = `Custom Amount (${slshVal.toLocaleString()} SlSh)`;
    activeCart.push({ product: { id: -(Date.now()), name: label, priceUSD: amountUSD }, qty: 1 });
    document.getElementById("daily-cash-slsh").value = "";
    renderCartUI();
}

function renderCartUI() {
    const container = document.getElementById("cart-container");
    container.innerHTML = "";
    let totalUSD = 0;
    if (activeCart.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-center py-8 text-xs">Dambiiluhu waa maran yahay.</p>`;
        document.getElementById("total-usd-label").innerText = "$0.00";
        document.getElementById("active-total-label").innerText = "$0.00";
        return;
    }
    activeCart.forEach(item => {
        totalUSD += item.product.priceUSD * item.qty;
        container.innerHTML += `<div class="flex justify-between items-center bg-slate-50 p-2.5 border rounded-lg text-xs gap-2">
            <div class="flex-1 min-w-0"><div class="font-bold text-slate-800 truncate">${item.product.name}</div><div class="text-slate-400 mt-0.5">${fmt(item.product.priceUSD * item.qty)}</div></div>
            <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="adjustQty(${item.product.id},-1)" class="w-6 h-6 bg-slate-200 hover:bg-rose-100 rounded-md text-center font-bold leading-6 text-sm">−</button>
                <span class="w-5 text-center font-black">${item.qty}</span>
                <button onclick="adjustQty(${item.product.id},1)" class="w-6 h-6 bg-slate-200 hover:bg-emerald-100 rounded-md text-center font-bold leading-6 text-sm">+</button>
            </div>
        </div>`;
    });
    document.getElementById("total-usd-label").innerText = `$${totalUSD.toFixed(2)}`;
    document.getElementById("active-total-label").innerText = fmt(totalUSD);
}

// ═════════════════════════════════════════════════════════════
//  PAYMENT METHOD
// ═════════════════════════════════════════════════════════════
function setPaymentMethod(m) {
    activePaymentMethod = m;
    document.querySelectorAll(".pay-btn").forEach(b => {
        b.className = "pay-btn p-2.5 border rounded-lg font-bold text-xs bg-slate-50 hover:bg-indigo-50 transition";
    });
    const targetBtn = document.getElementById(`pay-${m}`);
    if (targetBtn) targetBtn.className = "pay-btn p-2.5 border-2 border-indigo-600 rounded-lg font-black text-xs bg-indigo-50 text-indigo-700 shadow-sm";
}

// ═════════════════════════════════════════════════════════════
//  SUBMIT SALE (Kaydi iibka)
// ═════════════════════════════════════════════════════════════
async function submitTransaction() {
    if (activeCart.length === 0 || !activePaymentMethod)
        return alert("Ku dar wax dambiisha, doorna qaabka lacagta!");

    const type = document.getElementById("customer-type").value;
    const status = document.getElementById("transaction-status").value;
    const custId = parseInt(document.getElementById("active-customer-dropdown").value);

    const { ok } = await API.send("/api/sales", "POST", {
        cashier: currentUser,
        customerType: type,
        customerId: custId,
        status,
        paymentMethod: activePaymentMethod,
        items: JSON.parse(JSON.stringify(activeCart)),
    });

    if (!ok) return alert("Khalad ayaa dhacay markii la kaydinayay iibka.");

    activeCart = [];
    activePaymentMethod = "";
    document.querySelectorAll(".pay-btn").forEach(b => {
        b.className = "pay-btn p-2.5 border rounded-lg font-bold text-xs bg-slate-50 hover:bg-indigo-50 transition";
    });
    await initApp();
    alert("✅ Iibka si guul leh baa loo kaydiyay!");
}

// ═════════════════════════════════════════════════════════════
//  MANUAL CREDIT PAYMENT (Lacag deyn laga gooyo)
// ═════════════════════════════════════════════════════════════
async function collectManualPayment(currency) {
    const targetId = parseInt(document.getElementById("statement-cust-select").value);
    let amountUSD = 0, displayNote = "";

    if (currency === "USD") {
        const raw = parseFloat(document.getElementById("direct-payment-usd").value);
        if (isNaN(raw) || raw <= 0) return alert("Fadlan qor lacag sax ah (USD).");
        amountUSD = raw;
        displayNote = `$${raw.toFixed(2)} USD`;
        document.getElementById("direct-payment-usd").value = "";
    } else {
        const raw = parseFloat(document.getElementById("direct-payment-slsh").value);
        if (isNaN(raw) || raw <= 0) return alert("Fadlan qor lacag sax ah (SlSh).");
        amountUSD = raw / getRate();
        displayNote = `${raw.toLocaleString()} SlSh (~$${amountUSD.toFixed(2)})`;
        document.getElementById("direct-payment-slsh").value = "";
    }

    const { ok } = await API.send("/api/payments", "POST", {
        cashier: currentUser,
        customerId: targetId,
        currency,
        amountUSD,
        note: displayNote,
    });

    if (!ok) return alert("Khalad ayaa dhacay markii la diiwaangelinayay lacagta.");

    salesLog = await API.get("/api/sales");
    generateStatementView();
    alert(`✅ Lacagta ${displayNote} waa laga gooyay deynta!`);
}

// ═════════════════════════════════════════════════════════════
//  DAILY SUMMARY (Warbixinta maalineed)
// ═════════════════════════════════════════════════════════════
function nowDateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowDateLabel() {
    const d = new Date();
    const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${M[d.getMonth()]} ${d.getFullYear()}`;
}

function setTodayDate() {
    document.getElementById("daily-summary-date").value = nowDateKey();
    renderDailySummary();
}

function renderDailySummary() {
    const dateKey = document.getElementById("daily-summary-date").value;
    const records = salesLog.filter(s => s.dateKey === dateKey && !s.isManualCredit);
    let totalPaid = 0, totalTab = 0;
    const count = records.length;
    const cashierMap = {};

    records.forEach(s => {
        const orderTotal = s.items.reduce((sum, i) => sum + i.product.priceUSD * i.qty, 0);
        if (s.status === "paid") totalPaid += orderTotal; else totalTab += orderTotal;
        if (!cashierMap[s.cashier]) cashierMap[s.cashier] = { paid: 0, tab: 0, count: 0 };
        cashierMap[s.cashier].count++;
        if (s.status === "paid") cashierMap[s.cashier].paid += orderTotal;
        else cashierMap[s.cashier].tab += orderTotal;
    });

    document.getElementById("ds-count").innerText = count;
    document.getElementById("ds-paid").innerText = fmt(totalPaid);
    document.getElementById("ds-tab").innerText = fmt(totalTab);
    document.getElementById("ds-total").innerText = fmt(totalPaid + totalTab);

    const brk = document.getElementById("ds-cashier-breakdown");
    brk.innerHTML = "";
    if (Object.keys(cashierMap).length === 0) {
        brk.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Wax cashier ah kuma shaqayn maalintaan.</p>';
    }
    Object.entries(cashierMap).forEach(([name, d]) => {
        brk.innerHTML += `<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white rounded-lg border px-3 py-2 text-xs gap-1">
            <span class="font-bold text-slate-700">${name}</span>
            <div class="flex flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <span class="text-slate-400">${d.count} iib</span>
                <span class="text-emerald-600 font-bold">${fmt(d.paid)} paid</span>
                <span class="text-rose-500 font-bold">${fmt(d.tab)} tab</span>
            </div>
        </div>`;
    });

    const tbody = document.getElementById("ds-transactions-body");
    const empty = document.getElementById("ds-empty-msg");
    tbody.innerHTML = "";
    if (records.length === 0) { empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");

    records.forEach((s, idx) => {
        const cust = customers.find(c => c.id === s.customerId);
        const custName = cust ? cust.name : `Macamiil #${s.customerId}`;
        let total = 0, itemsList = "";
        s.items.forEach(i => {
            total += i.product.priceUSD * i.qty;
            itemsList += `${i.product.name}${i.qty > 1 ? " x" + i.qty : ""}, `;
        });
        itemsList = itemsList.replace(/,\s*$/, "");
        tbody.innerHTML += `<tr class="hover:bg-slate-50 text-xs">
            <td class="p-2 text-slate-400 font-bold">${idx + 1}</td>
            <td class="p-2 font-semibold text-slate-700">${custName}</td>
            <td class="p-2 text-slate-500 max-w-[160px] truncate" title="${itemsList}">${itemsList}</td>
            <td class="p-2 text-right font-black ${s.status === "paid" ? "text-emerald-700" : "text-rose-600"}">${fmt(total)}</td>
            <td class="p-2 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${s.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}">${s.status === "paid" ? "Paid" : "Deyn"}</span></td>
            <td class="p-2 text-center text-slate-500">${s.paymentMethod || "—"}</td>
            <td class="p-2 text-center text-slate-400">${s.cashier}</td>
        </tr>`;
    });
}

// ═════════════════════════════════════════════════════════════
//  STATEMENT VIEW
// ═════════════════════════════════════════════════════════════
function refreshStatementPeriods() {
    const sel = document.getElementById("statement-period-select");
    if (!sel) return;
    const current = sel.value;
    const months = [...new Set(salesLog.map(s => s.monthKey).filter(Boolean))].sort().reverse();
    sel.innerHTML = '<option value="All">Dhammaan waqtiga</option>';
    months.forEach(m => { sel.innerHTML += `<option value="${m}">${m}</option>`; });
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function generateStatementView() {
    refreshStatementPeriods();
    const sel = document.getElementById("statement-cust-select");
    if (!sel || !sel.value) return;
    const targetId = parseInt(sel.value);
    const period = document.getElementById("statement-period-select").value;
    const viewStatus = document.getElementById("statement-show-select").value;
    const client = customers.find(c => c.id === targetId);
    if (!client) return;

    const statementCurrency = client.type === "Monthly" ? "USD" : "SlSh";

    let records = salesLog.filter(s => s.customerId === targetId);
    if (period !== "All") records = records.filter(s => s.monthKey === period);
    if (viewStatus !== "All") records = records.filter(s => s.status === viewStatus);

    let paidUSD = 0, tabUSD = 0;
    const tbody = document.getElementById("print-table-rows");
    const tbodyP = document.getElementById("print-table-rows-pdf");
    tbody.innerHTML = "";
    if (tbodyP) tbodyP.innerHTML = "";

    records.forEach((s, idx) => {
        let total = 0, html = `<div class="space-y-0.5">`;
        if (s.isManualCredit) {
            total = s.creditAmountUSD; paidUSD += total;
            html += `<div class="font-bold text-emerald-700">Lacag la helay: ${s.creditNote || "$" + total.toFixed(2)}</div>`;
        } else {
            s.items.forEach(i => {
                html += `<div>${i.product.name}${i.qty > 1 ? " x" + i.qty : ""}</div>`;
                total += i.product.priceUSD * i.qty;
            });
            if (s.status === "paid") paidUSD += total; else tabUSD += total;
        }
        html += `</div>`;
        const row = `<tr class="border-b align-top text-slate-700 text-xs">
            <td class="p-2 text-slate-400 font-bold">${idx + 1}</td>
            <td class="p-2">${s.date}</td>
            <td class="p-2">${html}</td>
            <td class="p-2 text-right font-bold">${fmt(total, statementCurrency)}</td>
            <td class="p-2 text-center"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${s.status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}">${s.status === "paid" ? "Paid" : "Deyn"}</span></td>
            <td class="p-2 text-right text-slate-400">${s.cashier}</td>
        </tr>`;
        tbody.innerHTML += row;
        if (tbodyP) tbodyP.innerHTML += row;
    });

    let due = tabUSD;
    records.forEach(s => { if (s.isManualCredit) due -= s.creditAmountUSD; });
    if (due < 0) due = 0;

    document.getElementById("summary-visits").innerText = records.length;
    document.getElementById("summary-paid").innerText = fmt(paidUSD, statementCurrency);
    document.getElementById("summary-tab").innerText = fmt(due, statementCurrency);

    ["print-subtotal-paid", "print-subtotal-tab", "print-total-due"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = id === "print-subtotal-paid" ? fmt(paidUSD, statementCurrency) : fmt(due, statementCurrency);
    });
    ["print-cust-name", "print-cust-phone", "print-cust-address", "print-period", "print-date"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (id === "print-cust-name") el.innerText = client.name + ` (${client.type === "Monthly" ? "Bille / USD" : "Maalinle / SlSh"})`;
        if (id === "print-cust-phone") el.innerText = client.phone;
        if (id === "print-cust-address") el.innerText = client.address || "Hargeisa";
        if (id === "print-period") el.innerText = period === "All" ? "Dhammaan" : period;
        if (id === "print-date") el.innerText = nowDateLabel();
    });
}

function triggerPrintRoutine() {
    generateStatementView();
    setTimeout(() => window.print(), 300);
}

// ═════════════════════════════════════════════════════════════
//  MANAGER LISTS (Liisaska maamulka)
// ═════════════════════════════════════════════════════════════
function renderManagerCustomerDirectory() {
    const box = document.getElementById("manager-customer-list");
    if (!box) return;
    box.innerHTML = "";
    customers.forEach(c => {
        box.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded text-xs border">
            <span class="font-bold text-slate-700 truncate">${c.name} <span class="text-slate-400 font-normal">(${c.type === "Daily" ? "Maalinle" : "Bille"})</span></span>
            <button onclick="deleteCustomer(${c.id})" class="text-rose-500 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded border border-rose-200 ml-2 shrink-0">❌</button>
        </div>`;
    });
}

function renderManagerProductDirectory() {
    const box = document.getElementById("manager-product-list");
    if (!box) return;
    box.innerHTML = "";
    inventory.forEach(item => {
        box.innerHTML += `<div class="flex justify-between items-center bg-white p-2 rounded text-xs border">
            <span class="font-bold text-slate-700 truncate">${item.name} <span class="text-indigo-600">${fmt(item.priceUSD)}</span></span>
            <button onclick="deleteProduct(${item.id})" class="text-rose-500 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded border border-rose-200 ml-2 shrink-0">❌</button>
        </div>`;
    });
}

async function deleteCustomer(id) {
    if (!confirm("Tirtir macamiilkan?")) return;
    await API.send(`/api/customers/${id}`, "DELETE");
    await initApp();
}

async function deleteProduct(id) {
    if (!confirm("Tirtir alaabtan menu-ga?")) return;
    await API.send(`/api/products/${id}`, "DELETE");
    await initApp();
}

async function addNewProduct() {
    const name = document.getElementById("new-item-name").value.trim();
    const price = parseFloat(document.getElementById("new-item-price").value);
    if (!name || isNaN(price)) return alert("Fadlan geli magaca iyo qiimaha!");

    await API.send("/api/products", "POST", { name, priceUSD: price });
    document.getElementById("new-item-name").value = "";
    document.getElementById("new-item-price").value = "";
    await initApp();
}

async function addNewCustomer() {
    const name = document.getElementById("new-cust-name").value.trim();
    const phone = document.getElementById("new-cust-phone").value.trim();
    const type = document.getElementById("new-cust-type").value;
    const address = document.getElementById("new-cust-address").value.trim();
    if (!name || !phone) return alert("Fadlan geli Magaca iyo Telefoonka!");

    await API.send("/api/customers", "POST", { name, phone, type, address });
    document.getElementById("new-cust-name").value = "";
    document.getElementById("new-cust-phone").value = "";
    document.getElementById("new-cust-address").value = "";
    await initApp();
    alert("✅ Macamiil cusub baa la abuuray!");
}

// ═════════════════════════════════════════════════════════════
//  BILOWGA (marka bogga la furo)
// ═════════════════════════════════════════════════════════════
window.addEventListener("DOMContentLoaded", async () => {
    await loadLoginUsers();
    await loadExchangeRate();
});
