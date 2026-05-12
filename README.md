# smartfarmerai
connects farmers and local buyers
***SMART FARMER AI
Smart Farmer AI is a hackathon prototype that connects farmers directly with buyers. Farmers can register, upload crop details with photos, add contact/location/UPI information, and manage their own crop listings. Buyers can view live crops, call or WhatsApp farmers, open crop locations, create UPI payment receipts, and give feedback.

The project solves a real prototype problem: browser-only storage such as localStorage works only on one device. This version uses a backend server with shared storage, so crops uploaded from one phone or laptop can be viewed from another device connected to the same server.

Project Highlights
Farmer and buyer registration/login
Shared backend data storage across devices
Farmer profile with photo, contact number, location, Maps link, and UPI ID
Crop upload with crop name, photo, quantity, unit, price, quality, harvest date, description, organic/negotiable flags, location, and upload time
Buyer marketplace with crop search, farmer details, direct call, WhatsApp, and view location
Crop delete option only for the farmer who uploaded that crop
UPI payment flow for Google Pay, PhonePe, Paytm, BHIM, and other UPI apps
Downloadable HTML payment receipt
Buyer feedback and farmer rating
English and Kannada guidance
Gemini AI assistant through backend only, keeping the API key hidden from frontend code
Responsive UI for laptop and phone demo
Tech Stack
Frontend: HTML, CSS, JavaScript
Backend: Node.js built-in HTTP server
Database: JSON file storage at data/db.json
File uploads: Saved under public/uploads
AI: Gemini API called only from the backend
Payment: UPI intent link plus downloadable receipt
Folder Structure
smart-farmer-ai/
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── data/
│   └── db.json
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── assets/
    │   └── hero-farm.svg
    └── uploads/
Setup
Install Node.js LTS from:

https://nodejs.org
Open the project folder in VS Code:

C:\Users\KOWSHIK M S\Documents\Codex\2026-05-12\i-have-one-hackathon-on-22
Open VS Code terminal and run:

node -v
If it shows a version number, Node.js is ready.

Environment Variables
Create a .env file by copying .env.example:

Copy-Item .env.example .env
notepad .env
Example .env:

PORT=3000
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=sfai-9x7k-22may-private-48392-green-market
GEMINI_API_KEY=put-your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash
MERCHANT_UPI_ID=yourupiid@bank
Important:

Do not upload .env to GitHub.
GEMINI_API_KEY is used only in server.js, not in frontend files.
MERCHANT_UPI_ID is a fallback UPI ID. Farmers should add their own UPI ID in their profile.
Run The Project
node server.js
Open:

http://localhost:3000
To stop the server:

Ctrl + C
Test On Phone
Laptop and phone must be on the same Wi-Fi.

In PowerShell:

ipconfig
Find the IPv4 address. Example:

192.168.1.8
Open this on your phone:

http://192.168.1.8:3000
Keep node server.js running on the laptop.

If forgot-password reset links should open on the phone, update .env:

APP_BASE_URL=http://192.168.1.8:3000
Then restart the server.

Demo Flow For Judges
Open Smart Farmer AI welcome page.
Register as a farmer.
Complete farmer profile with contact, location, UPI ID, and profile photo.
Upload a crop with photo, quantity, price, harvest date, and location.
Logout.
Register/login as buyer.
Open marketplace and show that the farmer crop is visible.
Use call, WhatsApp, and view location buttons.
Open UPI payment option and generate a downloadable receipt.
Submit buyer feedback.
Switch language to Kannada and show user guidance.
Ask the AI assistant a crop or buying question.
Why This Project Is Useful
Farmers often depend on middlemen and may not get direct access to buyers. Buyers may also struggle to find fresh local crops with trusted farmer contact details. Smart Farmer AI creates a direct digital bridge between both sides and improves transparency with crop photos, location, feedback, and payment receipts.

Current Prototype Limitations
Payment verification is not automatic. The prototype opens UPI apps and generates a receipt after the buyer enters payment details.
Email sending is not configured. Forgot password creates a real reset token and prints/shows the reset link for prototype demo.
JSON file storage is suitable for hackathon demo. For production, use a cloud database such as PostgreSQL, Firebase, or Supabase.
For public access outside local Wi-Fi, deploy the backend to a hosting platform.
Future Scope
Real payment gateway verification through PhonePe/Razorpay merchant APIs
OTP/email verification
Cloud database and cloud image storage
Mandi price comparison
Delivery/logistics partner integration
Crop recommendation using weather and soil data
More Indian languages
Admin dashboard for moderation
Safety Notes
Keep .env private.
Do not expose Gemini API key in frontend JavaScript.
Use test/small UPI payments during demo.
Farmers should delete sold crops to avoid confusing buyers.
License
MIT License.
