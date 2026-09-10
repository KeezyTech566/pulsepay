let state = {
    currentUser: null,
    currentCurrency: 'USD',
    currencySymbols: {
        'USD': '$', 'EUR': '€', 'GBP': '£', 'NGN': '₦', 
        'JPY': '¥', 'CAD': 'CA$', 'AUD': 'AU$', 'INR': '₹'
    },
    balance: 0.00,
    incoming: 0.00,
    outgoing: 0.00,
    transactions: []
};

// Get current symbol helper
function getSymbol() {
    return state.currencySymbols[state.currentCurrency] || '$';
}

// Example helper to format any amount with the active currency symbol
function formatMoney(amount) {
    return `${getSymbol()}${amount.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
}

let cashFlowChart = null;

document.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem("pulsepay_user");
    if (savedUser) {
        state.currentUser = savedUser;
        startApp();
    } else {
        showScreen('onboarding-screen');
    }
    setupAuthForms();
    initNavigation();
    setupForms();
    initChart();
});

function showScreen(screenId) {
    document.getElementById('onboarding-screen').style.display = 'none';
    document.getElementById('signup-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById(screenId).style.display = 'block';
}

function setupAuthForms() {
    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        localStorage.setItem("pulsepay_user", name);
        state.currentUser = name;
        startApp();
    });

    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const name = email.split('@')[0];
        localStorage.setItem("pulsepay_user", name);
        state.currentUser = name;
        startApp();
    });
}

function startApp() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('app-dashboard').style.display = 'flex';
    document.getElementById('user-display-name').innerText = state.currentUser;
    document.getElementById('user-avatar-initials').innerText = state.currentUser.substring(0, 2).toUpperCase();
    fetchTransactions();
}

function logout() {
    localStorage.removeItem("pulsepay_user");
    location.reload();
}

function changeCurrency(val) {
    state.currentCurrency = val;
    renderDashboard();
    renderTransactions();
}

// Fetch from Flask Backend API
async function fetchTransactions() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/transactions');
        const data = await response.json();
        if (data && data.length > 0) {
            state.transactions = data;
            recalculateMetrics();
        } else {
            state.transactions = [];
            recalculateMetrics();
        }
    } catch (err) {
        console.warn("Backend offline, using clean local state.");
        state.transactions = [];
        recalculateMetrics();
    }
    renderDashboard();
    renderTransactions();
}

function recalculateMetrics() {
    state.balance = state.transactions.reduce((acc, tx) => {
        return tx.type === 'incoming' ? acc + tx.amount : acc - tx.amount;
    }, 0.00);
}

// Chart.js Analytics Integration
function initChart() {
    const ctx = document.getElementById('cashFlowChart').getContext('2d');
    cashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Transaction Volume',
                data: [0, 0, 0, 0, 0, 0, 0],
                backgroundColor: '#6366f1',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
}

function initNavigation() {
    const navItems = document.querySelectorAll(".nav-links li");
    const sections = document.querySelectorAll(".content-section");
    const pageTitle = document.getElementById("page-title");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(nav => nav.classList.remove("active"));
            sections.forEach(sec => sec.classList.remove("active"));
            item.classList.add("active");
            document.getElementById(item.getAttribute("data-target")).classList.add("active");
            pageTitle.innerText = item.innerText.trim();
        });
    });
}

function renderDashboard() {
    document.getElementById("total-balance").innerText = formatMoney(state.balance);
    const miniList = document.getElementById("mini-transaction-list");
    miniList.innerHTML = "";

    if (state.transactions.length === 0) {
        miniList.innerHTML = `<li class="mini-item"><span>No recent activity yet. Top up to start!</span></li>`;
        return;
    }

    state.transactions.slice(0, 4).forEach(tx => {
        const isIncoming = tx.type === "incoming";
        const txSymbol = state.currencySymbols[tx.currency] || getSymbol();
        const li = document.createElement("li");
        li.className = "mini-item";
        li.innerHTML = `
            <div class="mini-item-info"><strong>${tx.name}</strong><span>${tx.date}</span></div>
            <strong style="color: ${isIncoming ? 'var(--success)' : 'var(--danger)'}">
                ${isIncoming ? '+' : '-'}${txSymbol}${tx.amount.toFixed(2)}
            </strong>`;
        miniList.appendChild(li);
    });
}

function renderTransactions(filterText = "") {
    const tbody = document.getElementById("full-transaction-tbody");
    tbody.innerHTML = "";

    if (state.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No transactions found. Top up or make a transfer to get started.</td></tr>`;
        return;
    }

    state.transactions.filter(tx => tx.name.toLowerCase().includes(filterText.toLowerCase())).forEach(tx => {
        const isIncoming = tx.type === "incoming";
        const txSymbol = state.currencySymbols[tx.currency] || getSymbol();
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>${tx.id}</code></td>
            <td>${tx.name}</td>
            <td style="color: ${isIncoming ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">
                ${isIncoming ? '+' : '-'}${txSymbol}${tx.amount.toFixed(2)}
            </td>
            <td><span class="badge ${isIncoming ? 'positive' : 'negative'}">Successful</span></td>
            <td>${tx.date}</td>`;
        tbody.appendChild(tr);
    });
}

function setupForms() {
    const processTransaction = async (name, amountStr, type) => {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");

        if (type === 'outgoing' && amount > state.balance) {
            return alert("Insufficient balance! Please top up your account first.");
        }

        const newTx = {
            id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            name: name,
            amount: amount,
            currency: state.currentCurrency,
            type: type,
            date: "Today"
        };

        // Send to Flask Backend API
        await fetch('http://127.0.0.1:5000/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTx)
        });

        state.transactions.unshift(newTx);
        recalculateMetrics();
        renderDashboard();
        renderTransactions();
        alert(`${type === 'incoming' ? 'Deposit' : 'Payment'} of ${formatMoney(amount)} processed successfully!`);
    };

    document.getElementById("quick-transfer-form").addEventListener("submit", (e) => {
        e.preventDefault();
        processTransaction(
            document.getElementById("quick-recipient").value, 
            document.getElementById("quick-amount").value, 
            "outgoing"
        );
        e.target.reset();
    });

    const sendMoneyForm = document.getElementById("send-money-form");
    if (sendMoneyForm) {
        sendMoneyForm.addEventListener("submit", (e) => {
            e.preventDefault();
            processTransaction(
                document.getElementById("send-name").value, 
                document.getElementById("send-amount").value, 
                "outgoing"
            );
            e.target.reset();
        });
    }

    const depositForm = document.getElementById("deposit-form");
    if (depositForm) {
        depositForm.addEventListener("submit", (e) => {
            e.preventDefault();
            processTransaction(
                document.getElementById("deposit-source").value, 
                document.getElementById("deposit-amount").value, 
                "incoming"
            );
            e.target.reset();
        });
    }

    // Currency OK button setup
    const currencyOkBtn = document.getElementById("currency-ok-btn");
    if (currencyOkBtn) {
        currencyOkBtn.addEventListener("click", () => {
            const selectedCurrency = document.getElementById("currency-selector").value;
            changeCurrency(selectedCurrency);
            alert(`Currency updated to ${selectedCurrency}`);
        });
    }

    // Search filter handling
    const searchInput = document.getElementById("search-transactions");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            renderTransactions(e.target.value);
        });
    }

    // Copy API key utility
    const copyBtn = document.getElementById("copy-key-btn");
    if (copyBtn) {
        copyBtn.addEventListener("click", () => {
            const apiKeyInput = document.getElementById("api-key");
            apiKeyInput.type = "text";
            apiKeyInput.select();
            document.execCommand("copy");
            apiKeyInput.type = "password";
            alert("API Key copied to clipboard!");
        });
    }
}
