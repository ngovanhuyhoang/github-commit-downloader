(function () {
    function extractRepoFromDOM() {
        // 1) meta chuẩn của GitHub
        const metaNwo = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]');
        if (metaNwo?.content) return metaNwo.content; // "owner/repo"

        // 2) link canonical
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        if (canonical) {
            const m = canonical.match(/https:\/\/github\.com\/([^\/]+\/[^\/]+)/);
            if (m) return m[1];
        }

        // 3) breadcrumb repo link (header)
        const repoLink = document.querySelector('a[data-pjax="#repo-content-pjax-container"][href*="github.com/"]')?.href
            || document.querySelector('a[href^="/"][data-turbo="false"]')?.href;
        if (repoLink) {
            const m = repoLink.match(/github\.com\/([^\/]+\/[^\/]+)/) || repoLink.match(/^\/([^\/]+\/[^\/]+)/);
            if (m) return m[1];
        }

        // 4) URL fallback
        const m2 = location.href.match(/github\.com\/([^\/]+\/[^\/]+)/);
        if (m2) return m2[1];

        return null;
    }

    function extractCommitHashFromURL() {
        const m = location.href.match(/\/commit\/([0-9a-fA-F]+)/);
        return m ? m[1] : null;
    }

    // Trả lời popup
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.type === "GET_REPO_INFO") {
            sendResponse({
                repo: extractRepoFromDOM(),
                hash: extractCommitHashFromURL()
            });
            return true;
        }
    });
})();
