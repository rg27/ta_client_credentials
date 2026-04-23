let currentAccountID = "";
let allCredentialsData = []; 

const maskText = (text) => "•".repeat(Math.min(text?.length || 0, 12));

const setButtonState = (btn, isBusy, originalText) => {
    if (!btn) return;
    if (isBusy) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        btn.innerHTML = `<span class="flex items-center justify-center italic">Processing...</span>`;
    } else {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
        btn.innerHTML = originalText;
    }
};

ZOHO.embeddedApp.on("PageLoad", async (entity) => {
    currentAccountID = Array.isArray(entity.EntityId) ? entity.EntityId[0] : entity.EntityId;
    await loadCredentials(true);
});

async function loadCredentials(isInitialLoad = false) {
    const tableBody = document.getElementById("credential-body");
    
    if (isInitialLoad) {
        tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400 italic text-xs">Connecting to Secure Vault...</td></tr>`;
    }
    
    try {
        const req_data = { "arguments": JSON.stringify({ "account_id": currentAccountID }) };
        
        console.log("Fetching Credentials - Payload:", req_data);
        const response = await ZOHO.CRM.FUNCTIONS.execute("ta_get_client_credentials_zc_api", req_data);
        console.log("Fetching Credentials - Response:", response);

        const result = JSON.parse(response.details.output);

        if (result.code === 3000 && result.data && result.data.length > 0) {
            allCredentialsData = result.data; 
            tableBody.innerHTML = "";
            result.data.forEach((item, index) => {
                const row = document.createElement("tr");
                row.className = "hover:bg-slate-50 transition-colors group";
                row.innerHTML = `
                    <td class="px-4 py-4 text-center">
                        <input type="checkbox" value="${item.ID}" class="credential-checkbox rounded border-slate-300 text-primary">
                    </td>
                    <td class="px-6 py-4"><span class="px-2 py-1 bg-slate-100 rounded text-[10px] font-bold text-slate-600 border border-slate-200">${item.Credential_Type}</span></td>
                    <td class="px-6 py-4 text-slate-700 font-medium"><span id="u-${index}">${maskText(item.Username)}</span></td>
                    <td class="px-6 py-4 font-mono text-xs text-slate-500"><span id="p-${index}">${maskText(item.Login_Pass1)}</span></td>
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
            tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 font-medium italic">No Available Data</td></tr>`;
        }
    } catch (e) { 
        console.error("Load Credentials Error:", e);
        tableBody.innerHTML = `<tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 font-medium italic">No Available Data</td></tr>`;
    }
}

document.getElementById('credential-form').onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    const originalText = "Save Record";

    const urlInput = document.getElementById('form-url').value.trim();
    
    if (urlInput !== "") {
        const urlPattern = /^((https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,6}(\/[^\s]*)?)$/i;
        if (!urlPattern.test(urlInput)) {
            await showAlert({ 
                title: "Invalid URL", 
                message: "Please enter a valid URL (e.g., google.com or https://google.com)", 
                type: "danger" 
            });
            return;
        }
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
            "updated_by": senderName,
            "account_id": currentAccountID
        };
    
        console.log("Upserting Credential - Payload:", payload);
        const response = await ZOHO.CRM.FUNCTIONS.execute("ta_upsert_credential_zc_api", { "arguments": JSON.stringify(payload) });
        console.log("Upserting Credential - Response:", response);

        closeModal();
        const msg = isEdit ? "Credential successfully updated." : "Credential successfully created.";
        await showAlert({ title: "Success", message: msg, type: "success" });
        await loadCredentials();
    } catch (err) { 
        console.error("Upsert Error:", err);
        await showAlert({ title: "Error", message: "Action failed.", type: "danger" }); 
    } finally {
        setButtonState(submitBtn, false, originalText);
    }
};

window.deleteCredential = async (id) => {
    const btn = document.getElementById(`del-btn-${id}`);
    const originalContent = btn.innerHTML;
    const confirm = await showAlert({ title: "Confirm", message: "Delete this record?", type: "danger", confirmText: "Delete", showCancel: true });
    
    if (confirm) {
        setButtonState(btn, true, originalContent);
        try {
            const deletePayload = { "credential_id": id, "account_id": currentAccountID };
            console.log("Deleting Credential - Payload:", deletePayload);
            const response = await ZOHO.CRM.FUNCTIONS.execute("ta_delete_credential_zc_api", { "arguments": JSON.stringify(deletePayload) });
            console.log("Deleting Credential - Response:", response);

            await loadCredentials();
            await showAlert({ title: "Deleted", message: "Credential successfully deleted.", type: "success" });
        } catch (err) {
            console.error("Delete Error:", err);
            await showAlert({ title: "Error", message: "Deletion failed.", type: "danger" });
        } finally {
            setButtonState(btn, false, originalContent);
            lucide.createIcons();
        }
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
        if (userRes?.users?.length > 0) senderName = userRes.users[0].full_name;

        const selectedCredentials = allCredentialsData.filter(item => selectedIds.includes(item.ID));
        const args = { 
            "client_email": email, 
            "account_id": currentAccountID, 
            "sender_name": senderName,
            "selected_credentials": selectedCredentials 
        };
        
        console.log("Triggering Notification - Payload:", args);
        const response = await ZOHO.CRM.FUNCTIONS.execute("ta_notify_bulk_update_api", { "arguments": JSON.stringify(args) });
        console.log("Triggering Notification - Response:", response);
        
        const outputObj = JSON.parse(response.details.output);
        const resultValue = outputObj.value;

        if (resultValue === "existing pending request") {
            await showAlert({ 
                title: "Existing Request", 
                message: "This cannot be sent as there is already a pending request for this client.", 
                type: "danger" 
            });
        } else if (resultValue === "failed to send") {
            await showAlert({ 
                title: "Failed", 
                message: "Notification failed to send. Please try again later.", 
                type: "danger" 
            });
        } else if (resultValue === "successfully sent") {
            await showAlert({ 
                title: "Success", 
                message: `Credentials sent to ${email}`, 
                type: "success" 
            });
        }

        selectedCheckboxes.forEach(cb => cb.checked = false);
        const selectAllToggle = document.getElementById('select-all');
        if (selectAllToggle) selectAllToggle.checked = false;

        closeNotifyModal();
    } catch (err) {
        console.error("Notification Execute Error:", err);
        await showAlert({ title: "Error", message: "Notify failed.", type: "danger" });
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
window.openNotifyModal = () => {
    const sel = document.querySelectorAll('.credential-checkbox:checked').length;
    if (sel === 0) return showAlert({ title: "Selection Required", message: "Select items.", type: "info" });
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

const showAlert = ({ title, message, type = 'info', confirmText = 'OK', showCancel = false }) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('alert-modal');
        document.getElementById('alert-title').innerText = title;
        document.getElementById('alert-message').innerText = message;
        const actions = document.getElementById('alert-actions');
        actions.innerHTML = '';
        if (showCancel) {
            const bc = document.createElement('button');
            bc.className = "flex-1 px-4 py-2 text-xs font-bold text-slate-500 border rounded-lg";
            bc.innerText = "Cancel";
            bc.onclick = () => { modal.classList.add('hidden'); resolve(false); };
            actions.appendChild(bc);
        }
        const bcf = document.createElement('button');
        bcf.className = `flex-1 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm ${type === 'danger' ? 'bg-red-500' : 'bg-primary'}`;
        bcf.innerText = confirmText;
        bcf.onclick = () => { modal.classList.add('hidden'); resolve(true); };
        actions.appendChild(bcf);
        modal.classList.remove('hidden');
    });
};

ZOHO.embeddedApp.init();