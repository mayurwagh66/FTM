// Configuration file for LiveConnect
module.exports = {
    // Google Maps API Key - Replace with your actual API key
    GOOGLE_MAPS_API_KEY: 'AIzaSyAiWmrxhGk3y0H7muBi_Tt--5vVHNAFMlI',
    
    // Server configuration
    PORT: process.env.PORT || 3000,
    
    // Family group settings
    FAMILY_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour
    FAMILY_MAX_AGE: 24 * 60 * 60 * 1000, // 24 hours
    
    // Location tracking settings
    LOCATION_UPDATE_INTERVAL: 30000, // 30 seconds
    LOCATION_HIGH_ACCURACY: true,
    LOCATION_TIMEOUT: 10000,
    LOCATION_MAX_AGE: 30000
}; 