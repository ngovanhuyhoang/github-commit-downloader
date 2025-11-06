// Utils: lấy tab hiện tại
function getCurrentTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]));
    });
}

// Ưu tiên parse từ URL (nhanh), giống hàm bạn đưa
function getRepoNameFromUrl(url) {
    try {
        const pathName = new URL(url).pathname;
        const match = pathName.match(/\/([^\/]+\/[^\/]+)(?:\/(tree|blob|commit|issues|pull)\/[^\/]+)?/);
        if (match && match[1]) return match[1];
    } catch { }
    return null;
}

// Fallback: hỏi content script đọc từ DOM
async function getRepoFromDOM(tabId) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, { type: "GET_REPO_INFO" }, (resp) => {
            resolve(resp?.repo || null);
        });
    });
}

// Gọi GitHub API để lấy tổng commit (dựa trên Link header)
async function getTotalCommitCount(owner, repo) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`);
    const link = res.headers.get("link");
    const last = link?.match(/&page=(\d+)>; rel="last"/)?.[1];
    return Number(last || 1);
}

// Lấy commit ở index (1-based, theo trang)
async function getCommitAtIndex(owner, repo, index) {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1&page=${index}`);
    const json = await res.json();
    return json?.[0];
}

// Try auto fill khi mở popup
(async function init() {
    const tab = await getCurrentTab();
    const url = tab?.url || "";
    const repoInput = document.getElementById("repo");
    const hashInput = document.getElementById("hash");
    const status = document.getElementById("status");

    // 1) bắt từ URL
    let repo = getRepoNameFromUrl(url);

    // 2) fallback DOM nếu chưa có
    if (!repo && tab?.id) {
        repo = await getRepoFromDOM(tab.id);
    }

    if (repo) repoInput.value = repo;

    // detect hash nếu đang đứng ở trang commit
    const hashMatch = url.match(/\/commit\/([0-9a-fA-F]+)/);
    if (hashMatch) hashInput.value = hashMatch[1];

    // Nút Download ZIP
    document.getElementById("downloadBtn").onclick = () => {
        const repoVal = repoInput.value.trim();
        const hashVal = hashInput.value.trim();
        if (!repoVal) return alert("Không bắt được repo. Mở một trang GitHub repo trước nhé.");
        if (!hashVal) return alert("Nhập commit hash hoặc dùng nút First để mở commit đầu tiên.");

        const zipUrl = `https://codeload.github.com/${repoVal}/zip/${hashVal}`;
        status.textContent = "Đang tải ZIP...";
        chrome.tabs.create({ url: zipUrl });
    };

    // Nút First: mở commit đầu tiên trong repo (và đi kèm tải ZIP)
    document.getElementById("btnFirst").onclick = async () => {
        try {
            const repoVal = repoInput.value.trim();
            if (!repoVal) return alert("Không bắt được repo.");
            const [owner, reponame] = repoVal.split("/");
            status.textContent = "Đếm số lượng commit...";
            const total = await getTotalCommitCount(owner, reponame);
            status.textContent = "Lấy commit đầu tiên...";

            // commit đầu tiên = trang cuối cùng, phần tử đầu
            const firstCommit = await getCommitAtIndex(owner, reponame, total);
            if (!firstCommit?.sha) throw new Error("Không tìm thấy commit đầu tiên.");

            // Mở trang commit + tự tải ZIP theo SHA
            chrome.tabs.create({ url: firstCommit.html_url });
            chrome.tabs.create({ url: `https://codeload.github.com/${repoVal}/zip/${firstCommit.sha}` });
            status.textContent = `Đã mở commit đầu tiên (${firstCommit.sha.slice(0, 7)})`;
            document.getElementById("hash").value = firstCommit.sha;
        } catch (e) {
            alert("ERROR: " + e.message);
            status.textContent = "";
        }
    };
})();
