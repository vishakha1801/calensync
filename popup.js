document.getElementById("fetchEmails").addEventListener("click", async () => {
    document.getElementById("status").innerText = "Fetching emails...";

    chrome.runtime.sendMessage({ action: "fetchEmails" }, (response) => {
        if (response && response.success) {
            document.getElementById("status").innerText = "Emails processed and added to Calendar!";
        } else {
            document.getElementById("status").innerText = `Error: ${response.error}`;
        }
    });
});
