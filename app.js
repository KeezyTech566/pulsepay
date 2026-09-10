let state = {
    balance: 24580.50,
    incoming: 4250.00,
    outgoing: 1120.00,
    transactions: []
};

let cashFlowChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    initNavigation();
    await fetchTransactions();
    setupForms();
    initChart();
});

// Fetch from Flask Backend API
async function fetchTransactions() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/transactions');
        const data = await response.json();
        if (data.length > 0) {
            state.transactions = data;
            recalculateMetrics();
        } else {
            // Seed initial data if empty
            seedInitialData();
        }
    } catch (err) {
        console.warn("Backend offline, using local memory state.");
    }
    renderDashboard();
    renderTransactions();
}

function seedInitialData() {
    state.transactions = [
        { id: "TXN-9842", name: "Stripe Payout", amount: 1500.00, type: "incoming", date: "Sep 09, 2026" },
        { id: "TXN-9841", name: "AWS Cloud Services", amount: 120.00, type: "outgoing", date: "Sep 08, 2026" }
    ];
}

function recalculateMetrics() {
    state.balance = state.transactions.reduce((acc, tx) => tx.type === 'incoming' ? acc + tx.amount : acc - tx.amount, 24580.50);
}

// Chart.js Analytics Integration
function initChart() {
    const ctx = document.getElementById('cashFlowChart').getContext('2d');
    cashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Transaction Volume ($)',
                data: [1200, 2100, 800, 1500, 4250, 1120, 3100],
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
    document.getElementById("total-balance").innerText = `$${state.balance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    const miniList = document.getElementById("mini-transaction-list");
    miniList.innerHTML = "";

    state.transactions.slice(0, 4).forEach(tx => {
        const isIncoming = tx.type === "incoming";
        const li = document.createElement("li");
        li.className = "mini-item";
        li.innerHTML = `
            <div class="mini-item-info"><strong>${tx.name}</strong><span>${tx.date}</span></div>
            <strong style="color: ${isIncoming ? 'var(--success)' : 'var(--danger)'}">
                ${isIncoming ? '+' : '-'}$${tx.amount.toFixed(2)}
            </strong>`;
        miniList.appendChild(li);
    });
}

function renderTransactions(filterText = "") {
    const tbody = document.getElementById("full-transaction-tbody");
    tbody.innerHTML = "";
    state.transactions.filter(tx => tx.name.toLowerCase().includes(filterText.toLowerCase())).forEach(tx => {
        const isIncoming = tx.type === "incoming";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><code>${tx.id}</code></td>
            <td>${tx.name}</td>
            <td style="color: ${isIncoming ? 'var(--success)' : 'var(--danger)'}; font-weight:600;">
                ${isIncoming ? '+' : '-'}$${tx.amount.toFixed(2)}
            </td>
            <td><span class="badge ${isIncoming ? 'positive' : 'negative'}">Successful</span></td>
            <td>${tx.date}</td>`;
        tbody.appendChild(tr);
    });
}

function setupForms() {
    const handleTransfer = async (name, amountStr) => {
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) return alert("Invalid amount.");

        const newTx = {
            id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
            name: name,
            amount: amount,
            type: "outgoing",
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
        alert(`Payment of $${amount.toFixed(2)} processed successfully!`);
    };

    document.getElementById("quick-transfer-form").addEventListener("submit", (e) => {
        e.preventDefault();
        handleTransfer(document.getElementById("quick-recipient").value, document.getElementById("quick-amount").value);
        e.target.reset();
    });
}
