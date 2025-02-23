import imaplib
import email
from email.header import decode_header
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from datetime import datetime, timedelta
import re

SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://mail.google.com/'
]

def get_calendar_service():
    creds = None
    try:
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except FileNotFoundError:
        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
        creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    print("Calendar service initialized")
    return build('calendar', 'v3', credentials=creds)

def get_gmail_credentials():
    creds = None
    try:
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except FileNotFoundError:
        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
        creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    print("Gmail credentials obtained")
    return creds

def fetch_emails_oauth(email_address):
    print("Starting email fetch for", email_address)
    creds = get_gmail_credentials()
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        print("Connected to IMAP server")
        auth_string = f"user={email_address}\1auth=Bearer {creds.token}\1\1"
        mail.authenticate("XOAUTH2", lambda x: auth_string.encode())
        print("Authenticated with Gmail")
        mail.select("inbox")

        # Fetch unread emails from noreply+@dserec.com
        status, messages = mail.search(None, '(UNSEEN FROM "noreply+@dserec.com")')
        if status != 'OK':
            print("Search failed")
            mail.logout()
            return

        email_ids = messages[0].split()
        if not email_ids:
            print("No unread emails from noreply+@dserec.com found")
            mail.logout()
            return

        print(f"Found {len(email_ids)} unread emails from noreply+@dserec.com")

        for email_id in email_ids:
            print(f"Fetching email ID: {email_id.decode()}")
            status, msg_data = mail.fetch(email_id, "(RFC822)")
            if status != 'OK':
                print(f"Failed to fetch email ID: {email_id.decode()}")
                continue

            raw_email = None
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    raw_email = response_part[1]
                    break

            if raw_email is None:
                print(f"Could not extract content for email ID: {email_id.decode()}")
                continue

            msg = email.message_from_bytes(raw_email)
            subject = decode_header(msg["Subject"])[0][0]
            if isinstance(subject, bytes):
                subject = subject.decode()
            print(f"Processing email with subject: {subject}")

            if "Class registration successful" in subject:
                body = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == "text/plain":
                            body = part.get_payload(decode=True).decode()
                            break
                else:
                    body = msg.get_payload(decode=True).decode()

                print(f"Extracted Body: {body}")
                process_email(body)

        mail.logout()
        print("Logged out of Gmail")

    except Exception as e:
        print(f"Error in fetch_emails_oauth: {e}")

def process_email(body):
    pattern = r"(.+?) on (\d+/\d+/\d+) at (\d+:\d+[ap]m)"
    match = re.search(pattern, body)
    if match:
        class_name = match.group(1).strip()
        date_str = match.group(2)
        time_str = match.group(3)

        start_time = datetime.strptime(f"{date_str} {time_str}", "%m/%d/%Y %I:%M%p")
        end_time = start_time + timedelta(minutes=45)

        service = get_calendar_service()
        event = {
            'summary': f"Gym Class: {class_name}",
            'start': {
                'dateTime': start_time.isoformat(),
                'timeZone': 'America/New_York',
            },
            'end': {
                'dateTime': end_time.isoformat(),
                'timeZone': 'America/New_York',
            },
        }
        service.events().insert(calendarId='primary', body=event).execute()
        print(f"Added {class_name} to Google Calendar!")

if __name__ == "__main__":
    fetch_emails_oauth("vmpathak@andrew.cmu.edu")
