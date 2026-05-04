let currentAccountID = "";
let allCredentialsData = []; 

const maskText = (text) => "•".repeat(text?.length > 0 ? Math.min(text.length, 12) : 0);

const triggerLog = async (action, recordData) => {
    try {
        const payload = {
            "action": action,
            "account_id": currentAccountID,
            "affected_record": recordData 
        };
        const args = { "arguments": JSON.stringify(payload) };
        console.log("Execute ta_create_logs Payload:", payload);
        const logRes = await ZOHO.CRM.FUNCTIONS.execute("ta_create_logs", args);
        console.log("Execute ta_create_logs Result:", logRes);
    } catch (err) {
        console.error("Logging Error:", err);
    }
};

window.copyToClipboard = async (text, type) => {
    try {
        await navigator.clipboard.writeText(text);
        console.log(`${type} copied to clipboard`);
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
};

const showAlert = ({ title, message, type = 'info', confirmText = 'OK', showCancel = false }) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('alert-modal');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const actionsEl = document.getElementById('alert-actions');

        titleEl.innerText = title;
        messageEl.innerText = message;
        actionsEl.innerHTML = '';
        
        if (showCancel) {
            const bc = document.createElement('button');
            bc.className = "flex-1 px-4 py-2 text-xs font-bold text-slate-500 border rounded-lg hover:bg-slate-50";
            bc.innerText = "Cancel";
            bc.onclick = () => { modal.classList.add('hidden'); resolve(false); };
            actionsEl.appendChild(bc);
        }
        
        const bcf = document.createElement('button');
        bcf.className = `flex-1 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm ${type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-dark'}`;
        bcf.innerText = confirmText;
        bcf.onclick = () => { modal.classList.add('hidden'); resolve(true); };
        actionsEl.appendChild(bcf);
        
        modal.classList.remove('hidden');
    });
};

const setButtonState = (btn, isBusy, originalText) => {
    if (!btn) return;
    if (isBusy) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.innerHTML = `<span class="flex items-center justify-center italic">Processing...</span>`;
    } else {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.innerHTML = originalText;
    }
};

const uncheckAllCredentials = () => {
    const checkboxes = document.querySelectorAll('.credential-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    console.log("All credential checkboxes unchecked.");
};

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
    currentAccountID = Array.isArray(entity.EntityId) ? entity.EntityId[0] : entity.EntityId;
    console.log("App Loaded for Account ID:", currentAccountID);
    await loadCredentials(true);
});

async function loadCredentials(isInitialLoad = false) {
    const tableBody = document.getElementById("credential-body");
    if (isInitialLoad) {
        tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400 italic text-xs">Connecting to Secure Vault...</td></tr>`;
    }
    try {
        const payload = { "account_id": currentAccountID };
        const args = { "arguments": JSON.stringify(payload) };
        console.log("Execute ta_get_client_credentials_zc_api Payload:", payload);
        const response = await ZOHO.CRM.FUNCTIONS.execute("ta_get_client_credentials_zc_api", args);
        console.log("Execute ta_get_client_credentials_zc_api Result:", response);
        const result = JSON.parse(response.details.output);

        if (result.code === 3000 && result.data && result.data.length > 0) {
            allCredentialsData = result.data; 
            tableBody.innerHTML = "";
            result.data.forEach((item, index) => {
                const row = document.createElement("tr");
                row.className = "hover:bg-slate-50 transition-colors group text-[13px]";
                row.innerHTML = `
                    <td class="px-4 py-4 text-center">
                        <input type="checkbox" value="${item.ID}" class="credential-checkbox rounded border-slate-300 text-primary">
                    </td>
                    <td class="px-6 py-4"><span class="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 border border-slate-200">${item.Credential_Type}</span></td>
                    <td class="px-6 py-4 text-slate-700 font-medium">
                        <div class="flex items-center space-x-2">
                            <span id="u-${index}">${maskText(item.Username)}</span>
                            <button onclick="copyToClipboard('${item.Username}', 'Username')" class="text-slate-300 hover:text-primary transition-colors">
                                <i data-lucide="copy" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </td>
                    <td class="px-6 py-4 font-mono text-xs text-slate-500">
                        <div class="flex items-center space-x-2">
                            <span id="p-${index}">${maskText(item.Login_Pass1)}</span>
                            <button onclick="copyToClipboard('${item.Login_Pass1}', 'Password')" class="text-slate-300 hover:text-primary transition-colors">
                                <i data-lucide="copy" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-slate-500 text-[11px] max-w-[150px] truncate" title="${item.Notes || ''}">${item.Notes || '-'}</td>
                    <td class="px-6 py-4 text-[10px] text-slate-500 font-medium italic">${item.Created_Updated_By1 || 'System'}</td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex items-center justify-center space-x-2">
                            <button onclick="toggleRow(${index}, '${item.Username}', '${item.Login_Pass1}')" class="p-1.5 hover:text-primary border border-slate-200 rounded"><i id="i-${index}" data-lucide="eye-off" class="w-3.5 h-3.5"></i></button>
                            <button onclick='initEditModal(${JSON.stringify(item)})' class="p-1.5 hover:text-amber-500 border border-slate-200 rounded"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>
                            <button id="del-btn-${item.ID}" onclick="deleteCredential('${item.ID}')" class="p-1.5 hover:text-red-500 border border-slate-200 rounded"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                            <a href="${item.URL_Login_Link?.url || '#'}" target="_blank" class="px-3 py-1.5 bg-primary text-white text-[10px] font-bold rounded shadow hover:bg-primary-dark transition-all">Launch</a>
                        </div>
                    </td>`;
                tableBody.appendChild(row);
            });
            lucide.createIcons();
        } else {
            allCredentialsData = [];
            tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 font-medium italic">No Available Data</td></tr>`;
        }
    } catch (e) { 
        console.error("Load Credentials Error:", e);
        allCredentialsData = [];
        tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 font-medium italic">No Available Data</td></tr>`;
    }
}

document.getElementById('credential-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    const originalText = "Save Record";
    const urlInput = document.getElementById('form-url').value.trim();
    if (urlInput !== "" && !/^((https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,6}(\/[^\s]*)?)$/i.test(urlInput)) {
        await showAlert({ title: "Invalid URL", message: "Please enter a valid URL", type: "danger" });
        return;
    }
    setButtonState(submitBtn, true, originalText);
    try {
        const recordId = document.getElementById('form-id').value;
        const isEdit = !!recordId;
        let senderName = "System User";
        const userRes = await ZOHO.CRM.CONFIG.getCurrentUser();
        if (userRes?.users?.length > 0) senderName = userRes.users[0].full_name;
        const payload = {
            "action_type": isEdit ? "update" : "insert",
            "credential_id": recordId,
            "credential_type": document.getElementById('form-type').value,
            "login_username": document.getElementById('form-user').value,
            "login_pass": document.getElementById('form-pass').value,
            "credential_url": urlInput,
            "notes": document.getElementById('form-notes').value,
            "Created_Updated": senderName,
            "account_id": currentAccountID
        };
        const args = { "arguments": JSON.stringify(payload) };
        console.log("Execute ta_upsert_credential_zc_api Payload:", payload);
        await ZOHO.CRM.FUNCTIONS.execute("ta_upsert_credential_zc_api", args);
        closeModal();
        triggerLog(isEdit ? "UPDATE" : "CREATE", payload);
        await loadCredentials();
        showAlert({ title: "Success", message: isEdit ? "Credential updated." : "Credential created.", type: "success" });
    } catch (err) { 
        console.error("Upsert Error:", err);
        showAlert({ title: "Error", message: "Action failed.", type: "danger" }); 
    } finally {
        setButtonState(submitBtn, false, originalText);
    }
};

window.deleteCredential = async (id) => {
    const confirm = await showAlert({
        title: "Delete Record",
        message: "Are you sure you want to delete this credential? This action cannot be undone.",
        type: "danger",
        confirmText: "Delete",
        showCancel: true
    });
    
    if (!confirm) return;

    const btn = document.getElementById(`del-btn-${id}`);
    const originalContent = btn.innerHTML;
    setButtonState(btn, true, originalContent);
    try {
        let senderName = "System User";
        const userRes = await ZOHO.CRM.CONFIG.getCurrentUser();
        if (userRes?.users?.length > 0) senderName = userRes.users[0].full_name;
        const deletedRecord = allCredentialsData.find(item => item.ID === id);
        const payload = { 
            "credential_id": id, "account_id": currentAccountID, "Created_Updated": senderName,
            "credential_type": deletedRecord?.Credential_Type, "login_username": deletedRecord?.Username, "login_pass": deletedRecord?.Login_Pass1, "notes": deletedRecord?.Notes
        };
        console.log("Execute ta_delete_credential_zc_api Payload:", payload);
        await ZOHO.CRM.FUNCTIONS.execute("ta_delete_credential_zc_api", { "arguments": JSON.stringify(payload) });
        await loadCredentials();
        triggerLog("DELETE", payload);
    } catch (err) {
        console.error("Delete Error:", err);
        showAlert({ title: "Error", message: "Deletion failed.", type: "danger" });
    } finally {
        setButtonState(btn, false, originalContent);
        lucide.createIcons();
    }
};

window.processNotification = async () => {
    const btn = document.getElementById('notify-btn');
    const originalText = "Send Now";
    const email = document.getElementById('client-email').value;
    const selectedCheckboxes = document.querySelectorAll('.credential-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    setButtonState(btn, true, originalText);
    try {
        let senderName = "System User";
        const userRes = await ZOHO.CRM.CONFIG.getCurrentUser();
        if (userRes?.users?.length > 0) senderName = userRes.users[0].full_name; senderEmail = userRes.users[0].email;
        const selectedCredentials = allCredentialsData.filter(item => selectedIds.includes(item.ID));
        const payload = { 
            "client_email": email, "account_id": currentAccountID, "Created_Updated": senderName,
            "selected_credentials": selectedCredentials, "Created_Updated_Email": senderEmail
        };
        console.log("Execute ta_notify_bulk_update_api Payload:", payload);
        const response = await ZOHO.CRM.FUNCTIONS.execute("ta_notify_bulk_update_api", { "arguments": JSON.stringify(payload) });
        const outputObj = JSON.parse(response.details.output);
        if (outputObj.value === "existing pending request") {
            showAlert({ title: "ERROR", message: "Not Allowed. There is an existing pending request for this email.", type: "danger" });
        } else {
            triggerLog("NOTIFY", payload);
            uncheckAllCredentials();
            showAlert({ title: "Success", message: `Sent to ${email}`, type: "success" });
        }
        closeNotifyModal();
    } catch (err) {
        console.error("Notification Error:", err);
        showAlert({ title: "Error", message: "Notify failed.", type: "danger" });
    } finally {
        setButtonState(btn, false, originalText);
    }
};

window.initAddModal = () => {
    document.getElementById('modal-title').innerText = "Add New Credential";
    document.getElementById('credential-form').reset();
    document.getElementById('form-id').value = ""; 
    document.getElementById('modal-backdrop').classList.remove('hidden');
};

window.initEditModal = (data) => {
    document.getElementById('modal-title').innerText = "Edit Credential";
    document.getElementById('form-id').value = data.ID;
    document.getElementById('form-type').value = data.Credential_Type;
    document.getElementById('form-user').value = data.Username;
    document.getElementById('form-pass').value = data.Login_Pass1;
    document.getElementById('form-url').value = data.URL_Login_Link?.url || "";
    document.getElementById('form-notes').value = data.Notes || "";
    document.getElementById('modal-backdrop').classList.remove('hidden');
};

window.closeModal = () => document.getElementById('modal-backdrop').classList.add('hidden');

window.openNotifyModal = async () => {
    const hasCredentials = allCredentialsData.length > 0;
    const sel = document.querySelectorAll('.credential-checkbox:checked').length;
    console.log("openNotifyModal — hasCredentials:", hasCredentials, "| selected:", sel);

    if (!hasCredentials) {
        // No credentials on the account — open modal directly so they can still send an email
        console.log("openNotifyModal — No credentials found, opening modal directly.");
        document.getElementById('selected-count').innerText = 0;
        document.getElementById('notify-modal').classList.remove('hidden');
        return;
    }

    if (sel === 0) {
        // Has credentials but none ticked — warn, offer to proceed anyway
        console.log("openNotifyModal — Credentials exist but none selected, prompting user.");
        const proceed = await showAlert({
            title: "No Credentials Selected",
            message: "You haven't selected any credentials. Do you still want to notify the client? (e.g. the client will provide new credentials themselves)",
            type: "info",
            confirmText: "Proceed Anyway",
            showCancel: true
        });
        console.log("openNotifyModal — User chose to proceed:", proceed);
        if (!proceed) return;
    }

    document.getElementById('selected-count').innerText = sel;
    document.getElementById('notify-modal').classList.remove('hidden');
};

window.closeNotifyModal = () => document.getElementById('notify-modal').classList.add('hidden');
window.toggleSelectAll = (s) => document.querySelectorAll('.credential-checkbox').forEach(c => c.checked = s.checked);
window.toggleRow = (idx, u, p) => {
    const uE = document.getElementById(`u-${idx}`);
    const pE = document.getElementById(`p-${idx}`);
    const iE = document.getElementById(`i-${idx}`);
    const isMasked = uE.textContent.includes("•");
    uE.textContent = isMasked ? u : maskText(u);
    pE.textContent = isMasked ? p : maskText(p);
    iE.setAttribute('data-lucide', isMasked ? 'eye' : 'eye-off');
    lucide.createIcons();
};

ZOHO.embeddedApp.init();