// Global variables
let socket;
let map;
let markers = {};
let directionsService;
let directionsRenderer;
let currentLocation = null;
let userData = null;
let watchId = null;
let screens = {};
let enhancedDirectionsPanel = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize screens object after DOM is loaded
    screens = {
        welcome: document.getElementById('welcome-screen'),
        createFamily: document.getElementById('create-family-screen'),
        joinFamily: document.getElementById('join-family-screen'),
        app: document.getElementById('app-screen')
    };
    
    initializeEventListeners();
    initializeSocket();
});

// Initialize event listeners
function initializeEventListeners() {
    // Welcome screen buttons
    document.getElementById('create-family-btn').addEventListener('click', () => {
        showScreen('createFamily');
    });

    document.getElementById('join-family-btn').addEventListener('click', () => {
        showScreen('joinFamily');
    });

    // Form submissions
    document.getElementById('create-family-form').addEventListener('submit', handleCreateFamily);
    document.getElementById('join-family-form').addEventListener('submit', handleJoinFamily);

    // App screen buttons
    document.getElementById('sos-btn').addEventListener('click', sendSOSAlert);
    document.getElementById('leave-btn').addEventListener('click', leaveFamily);
    document.getElementById('center-map-btn').addEventListener('click', centerMapOnUser);
    document.getElementById('share-location-btn').addEventListener('click', shareLocation);

    // Chat functionality
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // SOS modal buttons
    document.getElementById('get-directions-sos-btn').addEventListener('click', () => {
        getDirectionsToMember(currentSOSMember);
        closeSOSModal();
    });

    document.getElementById('call-emergency-btn').addEventListener('click', () => {
        window.open('tel:911', '_blank');
    });
}

// Initialize Socket.IO connection
function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
        hideLoading();
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showNotification('Connection lost. Trying to reconnect...', 'warning');
    });

    socket.on('family-members', (members) => {
        updateMembersList(members);
        updateMapMarkers(members);
    });

    socket.on('member-joined', (member) => {
        showNotification(`${member.name} joined the family`, 'success');
        refreshMembersList();
    });

    socket.on('member-left', (member) => {
        showNotification(`${member.name} left the family`, 'info');
        refreshMembersList();
    });

    socket.on('member-location-updated', (data) => {
        updateMemberLocation(data);
    });

    socket.on('new-message', (message) => {
        addChatMessage(message);
    });

    socket.on('sos-alert', (data) => {
        showSOSAlert(data);
    });
}

// Screen management
function showScreen(screenId) {
    if (!screens[screenId]) {
        console.error(`Screen ${screenId} not found`);
        return;
    }
    
    Object.values(screens).forEach(screen => {
        if (screen) {
            screen.classList.remove('active');
        }
    });
    screens[screenId].classList.add('active');
}

// Handle create family form
async function handleCreateFamily(e) {
    e.preventDefault();
    showLoading();

    const name = document.getElementById('create-name').value.trim();
    if (!name) {
        hideLoading();
        showNotification('Please enter your name', 'error');
        return;
    }

    try {
        const response = await fetch('/api/create-family', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();
        
        if (response.ok) {
            userData = data;
            joinFamilyRoom(data);
            showNotification(`Family created! Your Family ID: ${data.familyId}`, 'success');
        } else {
            showNotification(data.error || 'Failed to create family', 'error');
        }
    } catch (error) {
        console.error('Error creating family:', error);
        showNotification('Failed to create family. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Handle join family form
async function handleJoinFamily(e) {
    e.preventDefault();
    showLoading();

    const familyId = document.getElementById('join-family-id').value.trim().toUpperCase();
    const name = document.getElementById('join-name').value.trim();

    if (!familyId || !name) {
        hideLoading();
        showNotification('Please enter both Family ID and your name', 'error');
        return;
    }

    try {
        const response = await fetch('/api/join-family', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ familyId, name })
        });

        const data = await response.json();
        
        if (response.ok) {
            userData = data;
            joinFamilyRoom(data);
            showNotification(`Successfully joined family!`, 'success');
        } else {
            showNotification(data.error || 'Failed to join family', 'error');
        }
    } catch (error) {
        console.error('Error joining family:', error);
        showNotification('Failed to join family. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Join family room and initialize app
function joinFamilyRoom(data) {
    socket.emit('join-family', {
        familyId: data.familyId,
        memberId: data.memberId,
        name: data.name
    });

    // Update UI
    document.getElementById('family-id-display').textContent = data.familyId;
    document.getElementById('user-name').textContent = data.name;

    // Initialize map
    initMap();

    // Start location tracking
    startLocationTracking();

    // Show app screen
    showScreen('app');
}

// Initialize Google Maps
function initMap() {
    // Default center (will be updated with user's location)
    const defaultCenter = { lat: 40.7128, lng: -74.0060 };

    try {
        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: defaultCenter,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Initialize directions service with error handling
        try {
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true,
                polylineOptions: {
                    strokeColor: '#4285F4',
                    strokeWeight: 6,
                    strokeOpacity: 0.9
                }
            });
            directionsRenderer.setMap(map);
            console.log('Directions service initialized successfully');
        } catch (error) {
            console.error('Error initializing directions service:', error);
            showNotification('Directions service not available. Some features may not work.', 'warning');
        }

        // Get user's location and center map
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    currentLocation = pos;
                    map.setCenter(pos);
                    addUserMarker(pos);
                    console.log('User location obtained:', pos);
                },
                (error) => {
                    console.error('Error getting location:', error);
                    showNotification('Unable to get your location. Using default location.', 'warning');
                    map.setCenter(defaultCenter);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 30000
                }
            );
        } else {
            console.log('Geolocation not supported');
            showNotification('Location services not supported by your browser.', 'warning');
            map.setCenter(defaultCenter);
        }
    } catch (error) {
        console.error('Error initializing map:', error);
        showNotification('Error initializing map. Please refresh the page.', 'error');
    }
}

// Start location tracking
function startLocationTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const pos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                currentLocation = pos;
                updateUserMarker(pos);
                
                // Send location to server
                if (socket && userData) {
                    socket.emit('update-location', {
                        familyId: userData.familyId,
                        memberId: userData.memberId,
                        location: pos
                    });
                }
            },
            (error) => {
                console.error('Error watching location:', error);
                showNotification('Unable to get your location', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    }
}

// Add user marker to map
function addUserMarker(position) {
    if (!userData || !userData.name) {
        console.log('User data not available yet, skipping marker creation');
        return;
    }
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: userData.name,
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="18" fill="#667eea" stroke="white" stroke-width="2"/>
                    <text x="20" y="25" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${userData.name.charAt(0).toUpperCase()}</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20)
        }
    });

    markers[userData.memberId] = marker;
}

// Update user marker position
function updateUserMarker(position) {
    if (markers[userData.memberId]) {
        markers[userData.memberId].setPosition(position);
    }
}

// Update map markers for all family members
function updateMapMarkers(members) {
    // Clear existing markers (except user's)
    Object.keys(markers).forEach(memberId => {
        if (memberId !== userData.memberId) {
            markers[memberId].setMap(null);
            delete markers[memberId];
        }
    });

    // Add markers for other members
    members.forEach(member => {
        if (member.id !== userData.memberId && member.location) {
            addMemberMarker(member);
        }
    });
}

// Helper: get a unique color for each user
function getUserColor(memberId) {
    // Simple hash to pick a color from palette
    const palette = [
        '#4285F4', // blue
        '#EA4335', // red
        '#FBBC05', // yellow
        '#34A853', // green
        '#A142F4', // purple
        '#F44292', // pink
        '#00B8D9', // teal
        '#FF6D01', // orange
        '#46BD62', // light green
        '#8E24AA'  // deep purple
    ];
    let hash = 0;
    for (let i = 0; i < memberId.length; i++) {
        hash = memberId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = palette[Math.abs(hash) % palette.length];
    return color;
}

// Add marker for a family member
function addMemberMarker(member) {
    // Determine if the location is old (last update > 2 minutes ago)
    let isStale = false;
    if (member.lastSeen) {
        const lastSeen = new Date(member.lastSeen);
        isStale = (Date.now() - lastSeen.getTime()) > 2 * 60 * 1000; // 2 minutes
    }

    // Choose marker color/icon
    let markerSvg;
    if (isStale) {
        // Gray circle with clock icon for stale location
        markerSvg = `
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="#b0b0b0" stroke="white" stroke-width="2"/>
                <text x="20" y="25" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${member.name.charAt(0).toUpperCase()}</text>
                <g>
                    <circle cx="32" cy="32" r="5" fill="#fff"/>
                    <path d="M32 29 v3 l2 2" stroke="#b0b0b0" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                </g>
            </svg>
        `;
    } else {
        // Unique color for each user
        const userColor = getUserColor(member.id || member.memberId || member.name || 'X');
        markerSvg = `
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="18" fill="${userColor}" stroke="white" stroke-width="2"/>
                <text x="20" y="25" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${member.name.charAt(0).toUpperCase()}</text>
            </svg>
        `;
    }

    const marker = new google.maps.Marker({
        position: member.location,
        map: map,
        title: member.name + (isStale ? ' (last seen a while ago)' : ''),
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(markerSvg),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20)
        }
    });

    // Add click listener for directions
    marker.addListener('click', () => {
        getDirectionsToMember(member);
    });

    markers[member.id] = marker;
}

// Update member location
function updateMemberLocation(data) {
    if (data.memberId !== userData.memberId) {
        if (markers[data.memberId]) {
            markers[data.memberId].setPosition(data.location);
        } else {
            // Add new marker if it doesn't exist
            addMemberMarker({
                id: data.memberId,
                name: data.name,
                location: data.location
            });
        }
    }
}

// Get directions to a family member
function getDirectionsToMember(member) {
    if (!currentLocation || !member.location) {
        showNotification('Unable to get directions. Location not available.', 'error');
        return;
    }

    if (!directionsService) {
        showNotification('Directions service not available. Please refresh the page.', 'error');
        return;
    }

    console.log('Getting directions from:', currentLocation, 'to:', member.location);

    // Show loading state
    showDirectionsLoading();

    const request = {
        origin: currentLocation,
        destination: member.location,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true
    };

    directionsService.route(request, (result, status) => {
        hideDirectionsLoading();
        
        if (status === 'OK') {
            displayEnhancedRoute(member, result);
        } else {
            displayEnhancedFallback(member);
        }
    });
}

// Show directions loading
function showDirectionsLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'directions-loading-overlay';
    overlay.innerHTML = `
        <div class="loading-card">
            <div class="loading-spinner">
                <i class="fas fa-route fa-spin"></i>
            </div>
            <h3>Calculating Route</h3>
            <p>Finding the best way...</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

// Hide directions loading
function hideDirectionsLoading() {
    const overlay = document.querySelector('.directions-loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Display enhanced route
function displayEnhancedRoute(member, result) {
    const route = result.routes[0];
    const leg = route.legs[0];
    
    // Display route on map
    directionsRenderer.setDirections(result);
    
    // Fit map to show entire route with padding
    const bounds = new google.maps.LatLngBounds();
    route.overview_path.forEach(point => {
        bounds.extend(point);
    });
    map.fitBounds(bounds);
    
    // Create enhanced directions panel
    createDirectionsPanel(member, leg, false);
}

// Display enhanced fallback
function displayEnhancedFallback(member) {
    const distance = calculateDistance(currentLocation, member.location);
    const bearing = calculateBearing(currentLocation, member.location);
    
    // Draw route line
    const routeLine = new google.maps.Polyline({
        path: [currentLocation, member.location],
        geodesic: true,
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
    });
    
    // Fit map
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(currentLocation);
    bounds.extend(member.location);
    map.fitBounds(bounds);
    
    // Create fallback panel
    createDirectionsPanel(member, { 
        distance: { text: `${distance.toFixed(2)} km` }, 
        duration: { text: 'Unknown' }, 
        steps: [] 
    }, true);
    
    // Store route line
    window.currentRouteLine = routeLine;
}

// Create directions panel
function createDirectionsPanel(member, leg, isFallback) {
    const panel = document.createElement('div');
    panel.className = 'enhanced-directions-panel';
    if (isFallback) panel.classList.add('fallback');
    
    panel.innerHTML = `
        <div class="panel-header">
            <button class="back-panel-btn" onclick="closeDirectionsPanel()" title="Back" style="margin-right:1.2rem;background:rgba(255,255,255,0.22);border:none;color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;cursor:pointer;"><i class="fas fa-arrow-left"></i></button>
            <div class="header-content">
                <div class="route-icon">
                    <i class="fas fa-${isFallback ? 'compass' : 'route'}"></i>
                </div>
                <div class="route-info">
                    <h2>${isFallback ? 'Basic Route' : 'Route'} to ${member.name}</h2>
                    <p class="route-summary">${leg.distance.text} • ${leg.duration.text}</p>
                </div>
            </div>
            <button class="close-panel-btn" onclick="closeDirectionsPanel()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="panel-actions">
            ${!isFallback ? `
                <button class="action-btn primary" onclick="startNavigation('${member.name}')">
                    <i class="fas fa-play"></i>
                    Start Navigation
                </button>
            ` : `
                <button class="action-btn primary" onclick="openInGoogleMaps('${member.location.lat}', '${member.location.lng}')">
                    <i class="fas fa-external-link-alt"></i>
                    Open in Google Maps
                </button>
            `}
            <button class="action-btn secondary" onclick="shareRoute('${member.name}', '${leg.distance.text}', '${leg.duration.text}')">
                <i class="fas fa-share"></i>
                Share
            </button>
            <button class="action-btn secondary" onclick="clearDirectionsRoute()">
                <i class="fas fa-times"></i>
                Clear Route
            </button>
        </div>
        
        <div class="directions-list">
            <div class="list-header">
                <h3>${isFallback ? 'Basic directions' : 'Step-by-step directions'}</h3>
                <span class="step-count">${isFallback ? '1' : leg.steps.length} step${isFallback ? '' : 's'}</span>
            </div>
            <div class="steps-container">
                ${isFallback ? getFallbackSteps(member) : getRouteSteps(leg.steps)}
            </div>
        </div>
        
        ${isFallback ? `
            <div class="fallback-notice">
                <i class="fas fa-info-circle"></i>
                <span>For detailed turn-by-turn directions, use Google Maps or your preferred navigation app.</span>
            </div>
        ` : ''}
    `;
    
    document.body.appendChild(panel);
    enhancedDirectionsPanel = panel;
    setTimeout(() => panel.classList.add('active'), 100);
}

// Get route steps
function getRouteSteps(steps) {
    return steps.map((step, index) => `
        <div class="direction-step" onclick="highlightStep(${index})">
            <div class="step-marker">
                <span class="step-number">${index + 1}</span>
            </div>
            <div class="step-details">
                <div class="step-instruction">${step.instructions}</div>
                <div class="step-meta">
                    <span class="step-distance">${step.distance ? step.distance.text : ''}</span>
                    <span class="step-duration">${step.duration ? step.duration.text : ''}</span>
                </div>
            </div>
            <div class="step-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');
}

// Get fallback steps
function getFallbackSteps(member) {
    const distance = calculateDistance(currentLocation, member.location);
    const bearing = calculateBearing(currentLocation, member.location);
    
    return `
        <div class="direction-step">
            <div class="step-marker">
                <span class="step-number">1</span>
            </div>
            <div class="step-details">
                <div class="step-instruction">Head ${getDirectionFromBearing(bearing)} towards ${member.name}</div>
                <div class="step-meta">
                    <span class="step-distance">${distance.toFixed(2)} km</span>
                </div>
            </div>
            <div class="step-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;
}

// Close directions modal (compatibility function)
function closeDirectionsModal() {
    closeDirectionsPanel();
}

// Close directions panel
function closeDirectionsPanel() {
    // Try to find the panel in the DOM if the reference is missing
    let panel = enhancedDirectionsPanel || document.querySelector('.enhanced-directions-panel');
    if (panel) {
        panel.classList.remove('active');
        setTimeout(() => {
            if (panel.parentNode) {
                panel.parentNode.removeChild(panel);
            }
            if (panel === enhancedDirectionsPanel) {
                enhancedDirectionsPanel = null;
            }
        }, 300);
    }
    // Only clear the route if the panel is being closed by the cross button
    clearDirectionsRoute();
}

// Clear directions route (but do NOT close the panel)
function clearDirectionsRoute() {
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }
    if (window.currentRouteLine) {
        window.currentRouteLine.setMap(null);
        window.currentRouteLine = null;
    }
    if (currentLocation) {
        map.setCenter(currentLocation);
        map.setZoom(15);
    }
}

// Start navigation
function startNavigation(memberName) {
    showNotification(`Starting navigation to ${memberName}...`, 'success');
    // Future: Integrate with device GPS navigation
}

// Share route
function shareRoute(memberName, distance, duration) {
    const text = `Route to ${memberName}: ${distance}, ${duration}`;
    if (navigator.share) {
        navigator.share({
            title: `Route to ${memberName}`,
            text: text,
            url: window.location.href
        }).catch(() => copyToClipboard(text));
    } else {
        copyToClipboard(text);
    }
}

// Open in Google Maps
function openInGoogleMaps(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
}

// Highlight step
function highlightStep(stepIndex) {
    console.log(`Highlighting step ${stepIndex + 1}`);
    // Future: Highlight specific route segment
}

// Update members list
function updateMembersList(members) {
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = '';

    members.forEach(member => {
        const memberItem = document.createElement('div');
        memberItem.className = `member-item ${member.isOnline ? 'online' : ''}`;
        
        memberItem.innerHTML = `
            <div class="member-avatar" style="position:relative;">
                ${member.name.charAt(0).toUpperCase()}
                ${member.isOnline ? '<span class="member-status-dot"></span>' : ''}
            </div>
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-status ${member.isOnline ? 'online' : 'offline'}">
                    ${member.isOnline ? 'Online' : 'Offline'}
                </div>
            </div>
            <div class="member-actions">
                ${member.location ? `
                    <button class="btn btn-small" onclick="getDirectionsToMember(${JSON.stringify(member).replace(/"/g, '&quot;')})" title="Get Directions">
                        <i class="fas fa-route"></i>
                    </button>
                ` : ''}
                <button class="btn btn-small" onclick="messageMember('${member.id}', '${member.name}')" title="Message">
                    <i class="fas fa-comment-dots"></i>
                </button>
                <button class="btn btn-small" onclick="pingMember('${member.id}', '${member.name}')" title="Ping">
                    <i class="fas fa-bell"></i>
                </button>
            </div>
        `;
        
        membersList.appendChild(memberItem);
    });
}

// Refresh members list from server
async function refreshMembersList() {
    if (!userData) return;

    try {
        const response = await fetch(`/api/family/${userData.familyId}/members`);
        const data = await response.json();
        
        if (response.ok) {
            updateMembersList(data.members);
            updateMapMarkers(data.members);
        }
    } catch (error) {
        console.error('Error refreshing members:', error);
    }
}

// Send chat message
function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (message && socket && userData) {
        socket.emit('send-message', {
            familyId: userData.familyId,
            message: message
        });
        
        // Add own message to chat
        addChatMessage({
            memberId: userData.memberId,
            name: userData.name,
            message: message,
            timestamp: new Date()
        });
        
        input.value = '';
    }
}

// Add chat message to UI
function addChatMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';

    const time = new Date(message.timestamp).toLocaleTimeString();
    const initial = message.name ? message.name.charAt(0).toUpperCase() : '?';

    messageDiv.innerHTML = `
        <div class="chat-message-avatar">
            <div class="chat-avatar-circle">${initial}</div>
        </div>
        <div class="chat-message-content">
            <div class="chat-message-header">
                <span class="chat-message-name">${message.name}</span>
                <span class="chat-message-time">${time}</span>
            </div>
            <div class="chat-message-text">${message.message}</div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send SOS alert
function sendSOSAlert() {
    if (!currentLocation || !socket || !userData) {
        showNotification('Unable to send SOS. Location not available.', 'error');
        return;
    }

    socket.emit('send-sos', {
        familyId: userData.familyId,
        location: currentLocation
    });

    showNotification('SOS alert sent to family members!', 'success');
}

// Show SOS alert modal
let currentSOSMember = null;

function showSOSAlert(data) {
    currentSOSMember = data;
    
    document.getElementById('sos-member-name').textContent = data.name;
    document.getElementById('sos-location').textContent = 
        `${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}`;
    document.getElementById('sos-time').textContent = 
        new Date(data.timestamp).toLocaleString();
    
    document.getElementById('sos-modal').style.display = 'flex';
    
    // Play alert sound (if supported)
    if ('Audio' in window) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        audio.play().catch(() => {}); // Ignore errors
    }
}

// Close SOS modal
function closeSOSModal() {
    document.getElementById('sos-modal').style.display = 'none';
    currentSOSMember = null;
}

// Leave family
function leaveFamily() {
    if (confirm('Are you sure you want to leave this family?')) {
        // Stop location tracking
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        // Clear markers
        Object.values(markers).forEach(marker => {
            marker.setMap(null);
        });
        markers = {};
        
        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }
        
        // Reset user data
        userData = null;
        currentLocation = null;
        
        // Show welcome screen
        showScreen('welcome');
        
        // Clear forms
        document.getElementById('create-family-form').reset();
        document.getElementById('join-family-form').reset();
        
        showNotification('You have left the family', 'info');
    }
}

// Center map on user
function centerMapOnUser() {
    if (currentLocation && map) {
        map.setCenter(currentLocation);
        map.setZoom(15);
    }
}

// Share location
function shareLocation() {
    if (navigator.share && currentLocation) {
        navigator.share({
            title: 'My Location',
            text: `I'm at ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`,
            url: `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`
        }).catch(() => {
            // Fallback: copy to clipboard
            copyToClipboard(`${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`);
        });
    } else if (currentLocation) {
        copyToClipboard(`${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`);
    }
}

// Copy text to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Location copied to clipboard', 'success');
    }).catch(() => {
        showNotification('Unable to copy location', 'error');
    });
}

// Show notification
function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Show/hide loading overlay
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden, stop location updates
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
    } else {
        // Page is visible, restart location tracking
        if (userData && !watchId) {
            startLocationTracking();
        }
    }
});

// Handle beforeunload
window.addEventListener('beforeunload', () => {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }
});

// At the end of app.js, add:
window.closeDirectionsPanel = closeDirectionsPanel;
window.closeDirectionsModal = closeDirectionsModal;
window.clearDirectionsRoute = clearDirectionsRoute;
window.startNavigation = startNavigation;
window.shareRoute = shareRoute;
window.openInGoogleMaps = openInGoogleMaps;
window.highlightStep = highlightStep;

// Add quick action handlers
window.messageMember = function(memberId, memberName) {
    showNotification(`Message to ${memberName} (feature coming soon!)`, 'info');
}
window.pingMember = function(memberId, memberName) {
    showNotification(`Ping sent to ${memberName} (feature coming soon!)`, 'success');
}

// Returns compass direction (N, NE, E, etc.) from a bearing in degrees
function getDirectionFromBearing(bearing) {
    const directions = [
        'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'
    ];
    const index = Math.round((((bearing % 360) + 360) % 360) / 45);
    return directions[index];
} 