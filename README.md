# 🛰️ LiveConnect - Real-Time Family & Friends Tracker

LiveConnect is a real-time web application that allows users to create or join a family group using a unique Family ID, share their live location, and see others on a map in real-time. Members can also get live directions to any other member, enhancing coordination and safety.

## ✨ Features

### 👪 Family Management
- **Create New Family**: Generate a unique Family ID for your group
- **Join Existing Family**: Use an existing Family ID to join a family
- **Name-based Identity**: No registration/login required - just enter your name

### 🗺️ Real-Time Location Tracking
- **Live Location Sharing**: Share your location in real-time with family members
- **Interactive Map**: View all family members on a shared Google Maps interface
- **Location History**: See when members were last active

### 🧭 Navigation & Directions
- **Get Directions**: Click on any member's pin to get live directions to them
- **Route Planning**: Real-time route calculation with distance and duration
- **Multiple Travel Modes**: Driving directions with turn-by-turn instructions

### 🚨 Safety Features
- **SOS Alert System**: One-click emergency alert notifies all family members
- **Emergency Contact**: Quick access to emergency services
- **Location Sharing**: Automatic location sharing with SOS alerts

### 💬 Communication
- **Live Group Chat**: Real-time messaging within your family group
- **Message History**: View chat history during your session
- **Member Notifications**: Get notified when members join/leave

### 🔒 Privacy & Security
- **No Registration Required**: Simple name-based identification
- **Group Isolation**: Each family has its own isolated Socket.IO room
- **Temporary Sessions**: Family groups are automatically cleaned up after 24 hours

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **Maps & Navigation**: Google Maps API
- **Styling**: Modern CSS with responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Google Maps API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd liveconnect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Google Maps API**
   - Get a Google Maps API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Enable the following APIs:
     - Maps JavaScript API
     - Directions API
     - Geocoding API
   - Replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` in `public/index.html` with your actual API key

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the application**
   - Navigate to `http://localhost:3000` in your browser
   - Allow location access when prompted

### Development Mode
```bash
npm run dev
```

## 📱 Usage Guide

### Creating a Family
1. Click "Create New Family" on the welcome screen
2. Enter your name
3. Click "Create Family"
4. Share the generated Family ID with your family members

### Joining a Family
1. Click "Join Existing Family" on the welcome screen
2. Enter the Family ID provided by the family creator
3. Enter your name
4. Click "Join Family"

### Using the App
- **View Members**: See all family members in the sidebar
- **Share Location**: Your location is automatically shared with family members
- **Get Directions**: Click on any member's pin on the map
- **Send Messages**: Use the chat feature to communicate with family
- **SOS Alert**: Click the SOS button in an emergency

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:
```
PORT=3000
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Google Maps API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the required APIs:
   - Maps JavaScript API
   - Directions API
   - Geocoding API
4. Create credentials (API key)
5. Restrict the API key to your domain for security

## 📁 Project Structure

```
liveconnect/
├── public/
│   ├── index.html          # Main HTML file
│   ├── styles.css          # CSS styles
│   └── app.js             # Frontend JavaScript
├── server.js              # Backend server
├── package.json           # Dependencies
└── README.md             # This file
```

## 🔒 Security Considerations

- **API Key Security**: Restrict your Google Maps API key to your domain
- **HTTPS**: Use HTTPS in production for secure location sharing
- **Input Validation**: All user inputs are validated on both client and server
- **Rate Limiting**: Consider implementing rate limiting for production use

## 🚀 Deployment

### Heroku
1. Create a Heroku app
2. Set environment variables in Heroku dashboard
3. Deploy using Git:
   ```bash
   git push heroku main
   ```

### Vercel
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### DigitalOcean
1. Create a Droplet
2. Install Node.js and PM2
3. Clone repository and run with PM2

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the code comments

## 🔮 Future Enhancements

- [ ] Push notifications
- [ ] Location history tracking
- [ ] Geofencing alerts
- [ ] Photo sharing
- [ ] Voice messages
- [ ] Offline support
- [ ] Multiple family groups per user
- [ ] Advanced privacy controls

---

**Made with ❤️ for families and friends to stay connected safely.** 