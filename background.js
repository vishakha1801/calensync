import CONFIG from "./config.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "fetchEmails") {
        (async () => {
            try {
                const token = await getAuthToken();
                const gmailMessages = await fetchUnreadEmails(token);
                for (const msg of gmailMessages) {
                    const fullMessage = await fetchEmailDetails(token, msg.id);
                    if (isFromTargetSender(fullMessage)) {
                        const classInfo = parseEmail(fullMessage);
                        if (classInfo) {
                            await addEventToCalendar(token, classInfo);
                            await markEmailAsRead(token, msg.id);
                        }
                    }
                }
                sendResponse({ success: true });
            } catch (error) {
                console.error("Error during fetchEmails:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(chrome.runtime.lastError || new Error("Failed to retrieve token"));
            } else {
                resolve(token);
            }
        });
    });
}

async function fetchUnreadEmails(token) {
    const query = `from:${CONFIG.TARGET_SENDER} is:unread`;
    const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    return data.messages || [];
}

async function fetchEmailDetails(token, messageId) {
    const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Failed to fetch email details: ${response.status}`);
    return await response.json();
}

function isFromTargetSender(email) {
    const fromHeader = email.payload.headers.find(header => header.name.toLowerCase() === "from");
    return fromHeader && fromHeader.value.includes(CONFIG.TARGET_SENDER);
}

function parseEmail(email) {
    let emailBody = "";
    if (email.payload.parts) {
        const textPart = email.payload.parts.find(part => part.mimeType === "text/plain");
        if (textPart && textPart.body.data) {
            emailBody = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
    } else if (email.payload.body.data) {
        emailBody = atob(email.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    }
    const pattern = /(.+?) on (\d+\/\d+\/\d+) at (\d+:\d+[ap]m)/i;
    const match = pattern.exec(emailBody);
    if (match) {
        const className = match[1].trim();
        const dateStr = match[2];
        const timeStr = match[3];
        const [month, day, year] = dateStr.split('/').map(Number);
        const [time, period] = timeStr.match(/(\d+:\d+)([ap]m)/i).slice(1);
        let [hours, minutes] = time.split(':').map(Number);
        if (period.toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (period.toLowerCase() === 'am' && hours === 12) hours = 0;
        const startTime = new Date(year, month - 1, day, hours, minutes);
        const endTime = new Date(startTime.getTime() + 45 * 60000);
        return {
            className,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
        };
    }
    return null;
}

async function addEventToCalendar(token, eventDetails) {
    const event = {
        summary: `Gym Class: ${eventDetails.className}`,
        start: { dateTime: eventDetails.startTime, timeZone: CONFIG.CALENDAR_TIMEZONE },
        end: { dateTime: eventDetails.endTime, timeZone: CONFIG.CALENDAR_TIMEZONE },
    };
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add event: ${response.status} - ${errorText}`);
    }
    console.log(`Added "${event.summary}" to calendar`);
}

async function markEmailAsRead(token, messageId) {
    const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            removeLabelIds: ["UNREAD"]
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to mark email as read: ${response.status} - ${errorText}`);
    }
    console.log(`Marked email ${messageId} as read`);
}
